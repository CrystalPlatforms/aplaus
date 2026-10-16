/**
 * API client: device token, silent renewal, and the offline layer.
 *
 * On a proxy 401 (code SESSION_EXPIRED) the client re-logs in with the
 * device-held credentials, renews the server-side jar, then retries the
 * original request exactly once. A definitive rejection (server answered)
 * drops the session: the auth gate shows the login screen. A network
 * failure (offline, dead server) keeps the session and falls back to the
 * IndexedDB offline cache — never a logout while offline.
 */
import { clearCredentials, getActiveAccountId, getCredentials, setLoggedOut } from "./credentials";
import { offlineCacheClear, offlineCacheGet, offlineCachePut } from "./offline-cache";

const API_URL = import.meta.env.VITE_API_URL ?? "";
const TOKEN_KEY = "aplaus.deviceToken";
/** Codes that mean "the Librus jar is stale — renew and retry once". */
const RENEWAL_CODES = new Set(["SESSION_EXPIRED"]);
const RENEW_PATH = "/api/accounts/refresh";
/** Login and renewal themselves never renew — no refresh loops. */
const RENEWAL_EXEMPT = new Set(["/api/login", RENEW_PATH]);

/** api.ts dispatches this when a request was served from the offline cache. */
export const API_OFFLINE_USED_EVENT = "aplaus:offline-used";
/** api.ts dispatches this on the first network success after a fallback. */
export const API_RESTORED_EVENT = "aplaus:api-restored";

/** True when the error is "offline and nothing cached", not a server error. */
export function isOfflineError(error: unknown): boolean {
	return error instanceof ApiError && error.status === 0 && error.code === "OFFLINE";
}

class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string,
	) {
		super(message);
		this.name = "ApiError";
	}
}

/**
 * Internal signal thrown when fetch itself failed (offline, dead server) or
 * when renewal could not run for the same reason. Routes the request into
 * the offline fallback instead of surfacing as a server error. HTTP errors
 * never become this — only a thrown network error does.
 */
class OfflineSignal extends Error {
	constructor() {
		super("offline");
		this.name = "OfflineSignal";
	}
}

/** GET without an explicit method, or an explicit "GET" — the only requests that use the offline cache. */
function isGetRequest(init?: RequestInit): boolean {
	return !init?.method || init.method.toUpperCase() === "GET";
}

/** Cache key scoped to the active account so two accounts never share offline data. */
function cacheKey(path: string): string {
	return `${getActiveAccountId() ?? "anon"}:${path}`;
}

export function getToken(): string | null {
	try {
		return localStorage.getItem(TOKEN_KEY);
	} catch {
		return null;
	}
}

export function setToken(token: string): void {
	try {
		localStorage.setItem(TOKEN_KEY, token);
	} catch {
		/* private mode: session-only login */
	}
}

type RenewalOutcome = "renewed" | "rejected" | "offline";

let renewalInFlight: Promise<RenewalOutcome> | null = null;

/**
 * One silent renewal for the active account. Concurrent callers share the
 * promise. Tri-state: "renewed" — retry makes sense; "rejected" — the server
 * refused or there is nothing to renew with (drops the session); "offline" —
 * the network itself failed, the session stays untouched.
 */
async function renewSession(): Promise<RenewalOutcome> {
	if (renewalInFlight) return renewalInFlight;
	renewalInFlight = (async () => {
		const accountId = getActiveAccountId();
		const credentials = accountId ? getCredentials(accountId) : null;
		if (!accountId || !credentials) return "rejected";
		try {
			const response = await plainFetch(RENEW_PATH, {
				method: "POST",
				body: JSON.stringify(credentials),
			});
			// A non-2xx renewal (e.g. wrong stored password) is a definitive
			// rejection: drop the session and the offline cache with it — no
			// account data lingers on a shared device. The device token stays
			// so the next login re-attaches to the same device and accounts.
			if (!response.ok) {
				void offlineCacheClear();
				clearCredentials(accountId);
				setLoggedOut(true);
				window.dispatchEvent(new CustomEvent("aplaus:session-expired"));
				return "rejected";
			}
			return "renewed";
		} catch {
			// Only a network failure lands here (plainFetch has no other throws);
			// the session stays untouched — never a logout while offline.
			return "offline";
		}
	})().finally(() => {
		renewalInFlight = null;
	});
	return renewalInFlight;
}

/** fetch without renewal logic — used by the renewal call itself. */
async function plainFetch(path: string, init?: RequestInit): Promise<Response> {
	const headers = new Headers(init?.headers);
	const token = getToken();
	if (token) headers.set("Authorization", `Bearer ${token}`);
	if (init?.body) headers.set("Content-Type", "application/json");
	return fetch(`${API_URL}${path}`, { ...init, headers });
}

/**
 * plainFetch with offline classification: fetch throwing (offline, dead
 * server) becomes OfflineSignal and routes the request into the offline
 * fallback. HTTP errors stay Responses; other throws are our bugs and
 * propagate.
 */
async function networkFetch(path: string, init?: RequestInit): Promise<Response> {
	try {
		return await plainFetch(path, init);
	} catch (error) {
		if (error instanceof TypeError) throw new OfflineSignal();
		throw error;
	}
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const isGet = isGetRequest(init);
	try {
		let response = await networkFetch(path, init);
		if (response.status === 401 && !RENEWAL_EXEMPT.has(path)) {
			const payload = await readErrorPayload(response);
			if (payload?.code && RENEWAL_CODES.has(payload.code)) {
				const renewal = await renewSession();
				if (renewal === "renewed") response = await networkFetch(path, init);
				// Renewal could not run (offline): route into the fallback too —
				// a GET serves the last data, anything else fails cleanly.
				if (renewal === "offline") throw new OfflineSignal();
				// "rejected" falls through: the original 401 surfaces below.
			}
		}
		if (!response.ok) {
			const payload = await readErrorPayload(response);
			throw new ApiError(
				response.status,
				payload?.code ?? "UNKNOWN",
				payload?.error ?? "Coś poszło nie tak.",
			);
		}
		// 204/205 (and any empty body) have no JSON to parse — hand back
		// undefined instead of throwing on "Unexpected end of JSON input".
		const text = await response.text();
		const data = (text ? JSON.parse(text) : undefined) as T;
		if (isGet) void offlineCachePut(cacheKey(path), data);
		maybeRestore();
		return data;
	} catch (error) {
		if (!(error instanceof OfflineSignal)) throw error;
		markOfflineUsed();
		if (!isGet) {
			throw new ApiError(0, "OFFLINE", "Brak połączenia — spróbuj ponownie, gdy wróci internet.");
		}
		const cached = await offlineCacheGet<T>(cacheKey(path));
		if (cached === null) {
			throw new ApiError(0, "OFFLINE", "Brak połączenia i zapisanych danych.");
		}
		return cached;
	}
}

/** Flags the offline state and fires the banner event once per outage. */
let offlineUsed = false;
function markOfflineUsed(): void {
	if (offlineUsed) return;
	offlineUsed = true;
	window.dispatchEvent(new CustomEvent(API_OFFLINE_USED_EVENT));
}

/** First network success after an outage clears the flag and hides the banner. */
function maybeRestore(): void {
	if (!offlineUsed) return;
	offlineUsed = false;
	window.dispatchEvent(new CustomEvent(API_RESTORED_EVENT));
}

/**
 * Downloads a binary proxy response as a file: fetches with the device token,
 * saves under the given name. Renewal is skipped on purpose — a failed
 * download is retried by tapping again.
 */
export async function apiDownload(path: string, fileName: string): Promise<void> {
	const response = await networkFetch(path);
	if (!response.ok) {
		const payload = await readErrorPayload(response);
		throw new ApiError(
			response.status,
			payload?.code ?? "UNKNOWN",
			payload?.error ?? "Nie udało się pobrać pliku.",
		);
	}
	const blob = await response.blob();
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = fileName;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
}

async function readErrorPayload(
	response: Response,
): Promise<{ code?: string; error?: string } | null> {
	try {
		return (await response.clone().json()) as { code?: string; error?: string };
	} catch {
		return null;
	}
}

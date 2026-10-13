/**
 * API client: device token + auto silent-renewal.
 *
 * On a proxy 401 (code SESSION_EXPIRED) the client re-logs in with the
 * device-held credentials, renews the server-side jar, then retries the
 * original request exactly once. A failed renewal drops the session: the
 * auth gate shows the login screen.
 */
import { clearCredentials, getActiveAccountId, getCredentials, setLoggedOut } from "./credentials";

const API_URL = import.meta.env.VITE_API_URL ?? "";
const TOKEN_KEY = "aplaus.deviceToken";
/** Codes that mean "the Librus jar is stale — renew and retry once". */
const RENEWAL_CODES = new Set(["SESSION_EXPIRED"]);
const RENEW_PATH = "/api/accounts/refresh";
/** Login and renewal themselves never renew — no refresh loops. */
const RENEWAL_EXEMPT = new Set(["/api/login", RENEW_PATH]);

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

let renewalInFlight: Promise<boolean> | null = null;

/**
 * One silent renewal for the active account. Concurrent callers share the
 * promise. True when renewed (retry makes sense); false drops the session.
 */
function renewSession(): Promise<boolean> {
	if (renewalInFlight) return renewalInFlight;
	renewalInFlight = (async () => {
		const accountId = getActiveAccountId();
		const credentials = accountId ? getCredentials(accountId) : null;
		if (!accountId || !credentials) return false;
		try {
			const response = await plainFetch(RENEW_PATH, {
				method: "POST",
				body: JSON.stringify(credentials),
			});
			// A non-2xx renewal (e.g. wrong stored password) is a failure, not
			// a success — plainFetch resolves with the Response either way.
			if (!response.ok) {
				throw new Error("renewal rejected");
			}
			return true;
		} catch {
			// Second failure: drop the session but keep the device token — the
			// next login re-attaches to the same device, so the account list
			// survives. The gate shows the login screen; stale credentials go.
			clearCredentials(accountId);
			setLoggedOut(true);
			window.dispatchEvent(new CustomEvent("aplaus:session-expired"));
			return false;
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

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
	let response = await plainFetch(path, init);
	const isExempt = RENEWAL_EXEMPT.has(path);
	if (response.status === 401 && !isExempt) {
		const payload = await readErrorPayload(response);
		if (payload?.code && RENEWAL_CODES.has(payload.code)) {
			const renewed = await renewSession();
			if (renewed) response = await plainFetch(path, init);
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
	return (await response.json()) as T;
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

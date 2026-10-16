/**
 * The offline layer of apiFetch (issue #12): a thrown network error serves
 * the last cached GET response (and fires the banner event), a cache miss
 * fails cleanly as ApiError OFFLINE, and a renewal that cannot run because
 * of the network never drops the session. IndexedDB is mocked at the
 * platform boundary (jsdom has none); fetch is the network boundary.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_OFFLINE_USED_EVENT, API_RESTORED_EVENT, apiFetch, isOfflineError } from "./api";
import { getCredentials, setActiveAccountId, setCredentials } from "./credentials";

/** jsdom has no localStorage under Node 26 without a flag — same stub as App.test. */
const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => void storage.set(key, value),
	removeItem: (key: string) => void storage.delete(key),
	clear: () => void storage.clear(),
});

/** Minimal in-memory IndexedDB speaking the event-handler surface api.ts uses. */
class FakeRequest {
	result: unknown = undefined;
	error: unknown = null;
	onsuccess: (() => void) | null = null;
	onerror: (() => void) | null = null;
	constructor(work: () => unknown) {
		queueMicrotask(() => {
			try {
				this.result = work();
			} catch (error) {
				this.error = error;
				this.onerror?.();
				return;
			}
			this.onsuccess?.();
		});
	}
}

const stores = new Map<string, Map<string, unknown>>();
const fakeDatabase = {
	objectStoreNames: { contains: (name: string) => stores.has(name) },
	createObjectStore: (name: string) => void stores.set(name, new Map()),
	transaction: (_name: string, _mode: IDBTransactionMode) => ({
		objectStore: () => ({
			get: (key: string) => new FakeRequest(() => stores.get(_name)?.get(key)),
			put: (value: unknown, key: string) =>
				new FakeRequest(() => stores.get(_name)?.set(key, value)),
			clear: () => new FakeRequest(() => stores.get(_name)?.clear()),
		}),
	}),
};
vi.stubGlobal("indexedDB", {
	open: () => {
		const request = {
			result: null as unknown,
			error: null as unknown,
			onupgradeneeded: null as (() => void) | null,
			onsuccess: null as (() => void) | null,
			onerror: null as (() => void) | null,
		};
		queueMicrotask(() => {
			request.result = fakeDatabase;
			request.onupgradeneeded?.();
			request.onsuccess?.();
		});
		return request;
	},
});

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const GRADES = { grades: [{ id: 1 }], categories: [], comments: [], subjects: [] };

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

/** fetch that answers like the API, or dies like a dead network. */
function routeFetch(behavior: "live" | "dead"): void {
	fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
		const path = String(input).replace(/^https?:\/\/[^/]+/, "");
		if (behavior === "dead") throw new TypeError("Failed to fetch");
		if (path === "/api/grades") return jsonResponse(GRADES);
		if (path === "/api/accounts/refresh") return jsonResponse({ ok: true });
		return jsonResponse({ error: "brak", code: "NOT_FOUND" }, 404);
	});
}

let offlineEvents = 0;
let restoredEvents = 0;

beforeEach(() => {
	// Clear the DATA but keep the store: the module-level DB connection is
	// already open, so onupgradeneeded (which creates the store) never re-runs.
	for (const store of stores.values()) store.clear();
	storage.clear();
	offlineEvents = 0;
	restoredEvents = 0;
	fetchMock.mockReset();
	window.addEventListener(API_OFFLINE_USED_EVENT, onOffline);
	window.addEventListener(API_RESTORED_EVENT, onRestored);
	setActiveAccountId("acc-1");
	setCredentials("acc-1", { login: "login", password: "pass" });
});

function onOffline() {
	offlineEvents++;
}
function onRestored() {
	restoredEvents++;
}

afterEach(() => {
	window.removeEventListener(API_OFFLINE_USED_EVENT, onOffline);
	window.removeEventListener(API_RESTORED_EVENT, onRestored);
});

describe("apiFetch — offline fallback", () => {
	it("caches successful GETs and serves the cache when the network dies", async () => {
		routeFetch("live");
		await expect(apiFetch<typeof GRADES>("/api/grades")).resolves.toEqual(GRADES);

		routeFetch("dead");
		await expect(apiFetch<typeof GRADES>("/api/grades")).resolves.toEqual(GRADES);
		expect(offlineEvents).toBeGreaterThan(0); // the banner event fired
	});

	it("fails cleanly as ApiError OFFLINE on a cache miss", async () => {
		routeFetch("dead");
		const error = await apiFetch("/api/never-seen").catch((cause: unknown) => cause);
		expect(isOfflineError(error)).toBe(true);
	});

	it("gives non-GET actions a clean offline error instead of cache", async () => {
		routeFetch("dead");
		const error = await apiFetch("/api/accounts/switch", {
			method: "POST",
			body: JSON.stringify({ accountId: "acc-2" }),
		}).catch((cause: unknown) => cause);
		expect(isOfflineError(error)).toBe(true);
	});

	it("fires the restored event on the first success after a fallback", async () => {
		// Burn any pending offline flag left by earlier tests, then measure
		// exactly one restore across one fallback -> success cycle.
		routeFetch("live");
		await apiFetch<typeof GRADES>("/api/grades");
		const before = restoredEvents;

		routeFetch("dead");
		await apiFetch<typeof GRADES>("/api/grades"); // fallback -> flagged
		routeFetch("live");
		await apiFetch<typeof GRADES>("/api/grades"); // success -> restored
		expect(restoredEvents).toBe(before + 1);
	});

	it("never drops the session when renewal cannot run offline", async () => {
		routeFetch("live");
		await apiFetch<typeof GRADES>("/api/grades"); // something cached

		// First the GET answers 401 SESSION_EXPIRED, then the renewal POST
		// dies on the network: the request falls back to the cache and the
		// stored credentials stay put.
		fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
			const path = String(input).replace(/^https?:\/\/[^/]+/, "");
			if (path === "/api/accounts/refresh") throw new TypeError("Failed to fetch");
			if (init?.method === undefined || init.method === "GET") {
				return jsonResponse({ error: "Sesja wygasła", code: "SESSION_EXPIRED" }, 401);
			}
			throw new TypeError("Failed to fetch");
		});
		await expect(apiFetch<typeof GRADES>("/api/grades")).resolves.toEqual(GRADES);
		expect(getCredentials("acc-1")).toEqual({ login: "login", password: "pass" });
	});
});

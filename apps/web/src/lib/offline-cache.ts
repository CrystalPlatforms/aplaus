/**
 * Offline cache: a tiny IndexedDB key-value of successful GET responses.
 * Written from api.ts: after every successful GET (fire-and-forget), and
 * read only when the network fetch throws. Keys are `${account}:${path}` —
 * account-scoped, so switching accounts never leaks one account's data as
 * another's offline copy. Every op degrades to a no-op when IndexedDB is
 * unavailable (private mode, jsdom) — never a crash.
 */

const DB_NAME = "aplaus-offline";
const VERSION = 1;
const STORE = "api-cache";

let dbPromise: Promise<IDBDatabase> | null = null;

/** Opens the DB once per page load. Null when indexedDB is unavailable. */
function openDb(): Promise<IDBDatabase> | null {
	if (typeof indexedDB === "undefined") return null;
	if (!dbPromise) {
		dbPromise = new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, VERSION);
			request.onupgradeneeded = () => {
				if (!request.result.objectStoreNames.contains(STORE)) {
					request.result.createObjectStore(STORE);
				}
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => {
				dbPromise = null;
				reject(request.error ?? new Error("IndexedDB open failed"));
			};
		});
	}
	return dbPromise;
}

/** Resolves undefined on any failure — best-effort by contract. */
function toPromise<T>(request: IDBRequest<T>): Promise<T | undefined> {
	return new Promise((resolve) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => resolve(undefined);
	});
}

/** Cached GET response or null (miss, or storage failure). */
export async function offlineCacheGet<T>(key: string): Promise<T | null> {
	const db = await openDb()?.catch(() => null);
	if (!db) return null;
	try {
		const request = db.transaction(STORE, "readonly").objectStore(STORE).get(String(key));
		const result = await toPromise(request);
		return (result as T | undefined) ?? null;
	} catch {
		return null;
	}
}

/** Stores a GET response. Fire-and-forget: failures are swallowed on purpose. */
export async function offlineCachePut(key: string, value: unknown): Promise<void> {
	const db = await openDb()?.catch(() => null);
	if (!db) return;
	try {
		const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(value, String(key));
		await toPromise(request);
	} catch {
		/* best-effort by contract */
	}
}

/** Removes every cached response (logout, session expiry). */
export async function offlineCacheClear(): Promise<void> {
	const db = await openDb()?.catch(() => null);
	if (!db) return;
	try {
		const request = db.transaction(STORE, "readwrite").objectStore(STORE).clear();
		await toPromise(request);
	} catch {
		/* best-effort by contract */
	}
}

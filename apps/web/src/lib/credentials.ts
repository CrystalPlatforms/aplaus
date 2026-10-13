/**
 * Device-held credentials: the password lives only on the device (localStorage),
 * so the silent-renewal flow can re-log in without the user retyping it.
 * The server never sees the password except at login/refresh time and never
 * stores it (KV holds jars and meta only).
 */

export interface StoredCredentials {
	login: string;
	password: string;
}

const CREDENTIALS_KEY = "aplaus.credentials";
const ACTIVE_ACCOUNT_KEY = "aplaus.activeAccountId";

function readStore(): Record<string, StoredCredentials> {
	try {
		const raw = localStorage.getItem(CREDENTIALS_KEY);
		return raw ? (JSON.parse(raw) as Record<string, StoredCredentials>) : {};
	} catch {
		return {};
	}
}

function writeStore(store: Record<string, StoredCredentials>): void {
	try {
		localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(store));
	} catch {
		/* private mode: no silent renewal */
	}
}

/** Credentials of one account (by server account id) or null. */
export function getCredentials(accountId: string): StoredCredentials | null {
	return readStore()[accountId] ?? null;
}

export function setCredentials(accountId: string, credentials: StoredCredentials): void {
	const store = readStore();
	store[accountId] = credentials;
	writeStore(store);
}

/** Drops the stored credentials of one account (e.g. after a failed renewal). */
export function clearCredentials(accountId: string): void {
	const store = readStore();
	delete store[accountId];
	writeStore(store);
}

export function clearAllCredentials(): void {
	try {
		localStorage.removeItem(CREDENTIALS_KEY);
	} catch {
		/* noop */
	}
}

/** The account the device currently proxies as. */
export function getActiveAccountId(): string | null {
	try {
		return localStorage.getItem(ACTIVE_ACCOUNT_KEY);
	} catch {
		return null;
	}
}

export function setActiveAccountId(accountId: string): void {
	try {
		if (accountId) localStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
	} catch {
		/* noop */
	}
}

export function clearActiveAccountId(): void {
	try {
		localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
	} catch {
		/* noop */
	}
}

/**
 * "Logged out" marks the UI state, not the device: the device token survives
 * so the next login re-attaches to the same device and its account list.
 * Every write is paired with a query reset that re-renders the auth gate.
 */
const LOGGED_OUT_KEY = "aplaus.loggedOut";

export function isLoggedOut(): boolean {
	try {
		return localStorage.getItem(LOGGED_OUT_KEY) === "1";
	} catch {
		return false;
	}
}

export function setLoggedOut(value: boolean): void {
	try {
		if (value) {
			localStorage.setItem(LOGGED_OUT_KEY, "1");
		} else {
			localStorage.removeItem(LOGGED_OUT_KEY);
		}
	} catch {
		/* private mode: session-only state */
	}
}

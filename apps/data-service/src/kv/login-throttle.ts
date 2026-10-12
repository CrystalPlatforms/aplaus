/**
 * Per-login failed-attempt counter in KV.
 *
 * The platform rate limiter (RATE_LIMIT_AUTH, IP-based, 20/min) throttles an
 * address; this counter throttles a target login. Five wrong passwords for the
 * same login inside the window -> 429 until the window passes; a successful
 * login clears the counter.
 */
const MAX_FAILS = 5;
const WINDOW_SECONDS = 900;

interface FailRecord {
	count: number;
}

const PREFIX = "login-fail:";

async function keyFor(login: string): Promise<string> {
	return `${PREFIX}${await sha256Hex(login)}`;
}

/** Counts a failure and returns the new count. */
export async function registerFailedLogin(kv: KVNamespace, login: string): Promise<number> {
	const key = await keyFor(login);
	const existing = await kv.get(key);
	const current = existing ? (JSON.parse(existing) as FailRecord).count : 0;
	const count = current + 1;
	await kv.put(key, JSON.stringify({ count }), { expirationTtl: WINDOW_SECONDS });
	return count;
}

/** Clears the counter after a successful login. */
export async function resetFailedLogins(kv: KVNamespace, login: string): Promise<void> {
	await kv.delete(await keyFor(login));
}

/** True when the login has >= MAX_FAILS failures in the window. */
export async function isLoginThrottled(kv: KVNamespace, login: string): Promise<boolean> {
	const raw = await kv.get(await keyFor(login));
	if (!raw) return false;
	return (JSON.parse(raw) as FailRecord).count >= MAX_FAILS;
}

/** Key is a SHA-256 of the login, so raw logins never sit in KV keys. */
async function sha256Hex(input: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

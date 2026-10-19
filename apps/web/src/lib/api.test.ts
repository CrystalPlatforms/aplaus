/**
 * The silent-renewal loop of the API client, at the fetch boundary:
 * proxy 401 -> one renewal with device-held credentials -> one retry -> OK.
 * A failed renewal drops the session (clears the token) — the auth gate then
 * shows the login screen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, getToken, setToken } from "./api";
import { setActiveAccountId, setCredentials } from "./credentials";

/**
 * Node's experimental global localStorage is unavailable without a CLI flag
 * and shadows jsdom's copy — the tests run against an in-memory stub.
 */
const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => void storage.set(key, value),
	removeItem: (key: string) => void storage.delete(key),
	clear: () => void storage.clear(),
});

const TOKEN = "device-token-1";
const SESSION_EXPIRED_401 = () =>
	new Response(JSON.stringify({ error: "Sesja Librusa wygasła.", code: "SESSION_EXPIRED" }), {
		status: 401,
	});
const OK = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("apiFetch silent renewal", () => {
	beforeEach(() => {
		localStorage.clear();
		setToken(TOKEN);
		setCredentials("librus:7", { login: "adam", password: "secret" });
		setActiveAccountId("librus:7");
	});

	afterEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
	});

	it("renews once and retries the original request on 401 SESSION_EXPIRED", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(SESSION_EXPIRED_401())
			.mockResolvedValueOnce(OK({ accounts: [], activeAccountId: "librus:7" })) // stale-account probe
			.mockResolvedValueOnce(OK({ ok: true })) // POST /api/accounts/refresh
			.mockResolvedValueOnce(OK({ grades: [] })); // retry
		vi.spyOn(window, "fetch").mockImplementation(fetchMock);

		const data = await apiFetch<{ grades: number[] }>("/api/grades");
		expect(data).toEqual({ grades: [] });
		// Probe + one renewal + one retry — never more.
		expect(fetchMock).toHaveBeenCalledTimes(4);
		expect(String(fetchMock.mock.calls[2]?.[0])).toContain("/api/accounts/refresh");
		expect(String(fetchMock.mock.calls[3]?.[0])).toContain("/api/grades");
		// The renewal carries the device-held credentials.
		const refreshInit = fetchMock.mock.calls[2]?.[1] as RequestInit;
		expect(String(refreshInit.body)).toContain("secret");
	});

	it("renews the server-active account when the browser pointer disagrees", async () => {
		// The browser still points at librus:7, but the server switched to
		// librus:9 — renewing 7 would "succeed" forever while requests die.
		setCredentials("librus:9", { login: "filip", password: "pass9" });
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(SESSION_EXPIRED_401())
			.mockResolvedValueOnce(OK({ accounts: [], activeAccountId: "librus:9" })) // probe
			.mockResolvedValueOnce(OK({ ok: true })) // refresh
			.mockResolvedValueOnce(OK({ grades: [] })); // retry
		vi.spyOn(window, "fetch").mockImplementation(fetchMock);

		const data = await apiFetch<{ grades: number[] }>("/api/grades");
		expect(data).toEqual({ grades: [] });
		const refreshInit = fetchMock.mock.calls[2]?.[1] as RequestInit;
		expect(String(refreshInit.body)).toContain("pass9");
	});

	it("shares one renewal between concurrent requests", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(SESSION_EXPIRED_401())
			.mockResolvedValueOnce(SESSION_EXPIRED_401())
			.mockResolvedValueOnce(OK({ accounts: [], activeAccountId: "librus:7" })) // probe
			.mockResolvedValueOnce(OK({ ok: true })) // shared renewal
			.mockResolvedValueOnce(OK({ a: 1 })) // retry grades
			.mockResolvedValueOnce(OK({ b: 2 })); // retry me
		vi.spyOn(window, "fetch").mockImplementation(fetchMock);

		const [first, second] = await Promise.all([apiFetch("/api/grades"), apiFetch("/api/me")]);
		expect(first).toEqual({ a: 1 });
		expect(second).toEqual({ b: 2 });
		// 2 originals + 1 probe + 1 shared renewal + 2 retries; renewal ran exactly once.
		expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("refresh"))).toHaveLength(1);
	});

	it("drops the session when the renewal fails (second failure -> login screen)", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(SESSION_EXPIRED_401())
			.mockResolvedValueOnce(OK({ accounts: [], activeAccountId: "librus:7" })) // probe
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ error: "Złe hasło", code: "WRONG_CREDENTIALS" }), {
					status: 401,
				}),
			);
		vi.spyOn(window, "fetch").mockImplementation(fetchMock);

		await expect(apiFetch("/api/grades")).rejects.toThrow();
		// Original + probe + failed renewal; no retry.
		expect(fetchMock).toHaveBeenCalledTimes(3);
		// The session drops (the gate shows the login screen), but the device
		// token survives: the next login re-attaches to the same device, so
		// the account list is not lost.
		expect(getToken()).toBe("device-token-1");
		expect(localStorage.getItem("aplaus.loggedOut")).toBe("1");
		const credentials = JSON.parse(
			(localStorage.getItem("aplaus.credentials") as string) ?? "{}",
		) as Record<string, unknown>;
		expect(credentials["librus:7"]).toBeUndefined();
	});

	it("never renews the login path itself (no loops)", async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(
			new Response(JSON.stringify({ error: "Złe hasło", code: "WRONG_CREDENTIALS" }), {
				status: 401,
			}),
		);
		vi.spyOn(window, "fetch").mockImplementation(fetchMock);

		await expect(
			apiFetch("/api/login", {
				method: "POST",
				body: JSON.stringify({ login: "x", password: "y" }),
			}),
		).rejects.toThrow();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

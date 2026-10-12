/**
 * Login integration on the real App (workerd + KV simulation). The Librus
 * HTTP dance is mocked at the only permitted boundary: the external API.
 */
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loginToLibrusMock = vi.hoisted(() => vi.fn());

vi.mock("@repo/librus-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@repo/librus-client")>();
	return { ...actual, loginToLibrus: loginToLibrusMock };
});

import { App } from "../app";

const JAR_DTO = [{ name: "synergiaSid", value: "abc", domain: "synergia.librus.pl", path: "/" }];
/** The real login returns a CookieJar instance; the mock mirrors its DTO shape. */
const JAR = { toDTO: () => JAR_DTO };
const ACCOUNT = { id: 7, firstName: "Adam", lastName: "Testowy", login: "adam7", groupId: 8 };

const loginRequest = (ip: string, body: unknown) =>
	App.request(
		"/api/login",
		{
			method: "POST",
			headers: { "Content-Type": "application/json", "cf-connecting-ip": ip },
			body: JSON.stringify(body),
		},
		env,
	);

beforeEach(() => {
	loginToLibrusMock.mockReset();
});

describe("POST /api/login", () => {
	it("returns a device token; the token authorizes /api/me; no token gets 401", async () => {
		loginToLibrusMock.mockResolvedValue({ jar: JAR, account: ACCOUNT });
		const res = await loginRequest("198.51.101.1", { login: "adam-good", password: "secret" });
		expect(res.status).toBe(201);
		const body = (await res.json()) as {
			deviceToken: string;
			account: { firstName: string; role: string };
		};
		expect(body.deviceToken).toBeTruthy();
		expect(body.account.firstName).toBe("Adam");
		expect(body.account.role).toBe("Uczeń");

		const me = await App.request(
			"/api/me",
			{ headers: { Authorization: `Bearer ${body.deviceToken}` } },
			env,
		);
		expect(me.status).toBe(200);
		const meBody = (await me.json()) as { firstName: string; role: string };
		expect(meBody.firstName).toBe("Adam");
		expect(meBody.role).toBe("Uczeń");

		const anonymous = await App.request("/api/me", {}, env);
		expect(anonymous.status).toBe(401);
	});

	it("persists jar + account meta in KV, never the password", async () => {
		loginToLibrusMock.mockResolvedValue({ jar: JAR, account: ACCOUNT });
		const res = await loginRequest("198.51.101.2", {
			login: "adam-kv",
			password: "SUPER-SECRET-123",
		});
		expect(res.status).toBe(201);

		const keys = (await env.KV.list()).keys.map((k) => k.name);
		const deviceKeys = keys.filter((k) => k.startsWith("device:"));
		const accountKeys = keys.filter((k) => k.startsWith("account:"));
		expect(deviceKeys.length).toBeGreaterThan(0);
		expect(accountKeys.length).toBeGreaterThan(0);

		for (const key of [...deviceKeys, ...accountKeys]) {
			const raw = await env.KV.get(key);
			expect(raw).not.toContain("SUPER-SECRET-123");
			expect(raw).not.toContain("password");
		}
		const accountRaw = await env.KV.get(accountKeys[0] as string);
		const account = JSON.parse(accountRaw ?? "{}") as {
			jar?: unknown[];
			firstName?: string;
			groupId?: number;
		};
		expect(account.jar).toEqual(JAR_DTO);
		expect(account.firstName).toBe("Adam");
		expect(account.groupId).toBe(8);
	});

	it("maps wrong credentials to 401 with the Polish message", async () => {
		const { LibrusError } = await import("@repo/librus-client");
		loginToLibrusMock.mockRejectedValue(new LibrusError("WRONG_CREDENTIALS", 403));
		const res = await loginRequest("198.51.101.3", { login: "adam-wrong", password: "bad" });
		expect(res.status).toBe(401);
		const body = (await res.json()) as { code: string; error: string };
		expect(body.code).toBe("WRONG_CREDENTIALS");
		expect(body.error).toBe("Nieprawidłowy login lub hasło.");
	});

	it("throttles a login after five failed attempts with 429", async () => {
		const { LibrusError } = await import("@repo/librus-client");
		loginToLibrusMock.mockRejectedValue(new LibrusError("WRONG_CREDENTIALS", 403));
		const ip = "198.51.101.4";
		for (let i = 0; i < 5; i++) {
			const res = await loginRequest(ip, { login: "adam-bruteforce", password: "bad" });
			expect(res.status).toBe(401);
		}
		const throttled = await loginRequest(ip, { login: "adam-bruteforce", password: "bad" });
		expect(throttled.status).toBe(429);
		const body = (await throttled.json()) as { code: string; error: string };
		expect(body.code).toBe("LOGIN_THROTTLED");
		expect(body.error).toContain("Zbyt wiele");

		// A different login is not affected by the per-login counter.
		const other = await loginRequest(ip, { login: "adam-other", password: "bad" });
		expect(other.status).toBe(401);
	});
});

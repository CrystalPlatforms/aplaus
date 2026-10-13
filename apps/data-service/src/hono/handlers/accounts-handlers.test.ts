/**
 * Multi-account integration on the real App (workerd + KV simulation). The
 * Librus HTTP dance and readers are mocked at the only permitted boundary:
 * the external API.
 */
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loginToLibrusMock = vi.hoisted(() => vi.fn());
const readGradesMock = vi.hoisted(() => vi.fn());
const readGradeCategoriesMock = vi.hoisted(() => vi.fn());
const readGradeCommentsMock = vi.hoisted(() => vi.fn());
const readTeachersMock = vi.hoisted(() => vi.fn());

vi.mock("@repo/librus-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@repo/librus-client")>();
	return {
		...actual,
		loginToLibrus: loginToLibrusMock,
		readGrades: readGradesMock,
		readGradeCategories: readGradeCategoriesMock,
		readGradeComments: readGradeCommentsMock,
		readTeachers: readTeachersMock,
	};
});

import { LibrusError } from "@repo/librus-client";
import { App } from "../app";

const JAR_1 = [{ name: "synergiaSid", value: "jar-one", domain: "synergia.librus.pl", path: "/" }];
const JAR_2 = [{ name: "synergiaSid", value: "jar-two", domain: "synergia.librus.pl", path: "/" }];
const JAR = (dto: typeof JAR_1) => ({ toDTO: () => dto });
const ACCOUNT_A = { id: 7, firstName: "Adam", lastName: "Testowy", login: "adam7", groupId: 8 };
const ACCOUNT_B = { id: 9, firstName: "Filip", lastName: "Drugi", login: "filip9", groupId: 5 };

const loginRequest = (ip: string, body: unknown, token?: string) =>
	App.request(
		"/api/login",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"cf-connecting-ip": ip,
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
			body: JSON.stringify(body),
		},
		env,
	);

const authed = (path: string, token: string, init?: RequestInit) =>
	App.request(
		path,
		{
			headers: {
				Authorization: `Bearer ${token}`,
				...(init?.body ? { "Content-Type": "application/json" } : {}),
			},
			...init,
		},
		env,
	);

async function loginTwoAccounts(ip: string): Promise<{ token: string; idA: string; idB: string }> {
	loginToLibrusMock.mockResolvedValueOnce({ jar: JAR(JAR_1), account: ACCOUNT_A });
	const resA = await loginRequest(ip, { login: "adam", password: "pw-a" });
	expect(resA.status).toBe(201);
	const { deviceToken, account } = (await resA.json()) as {
		deviceToken: string;
		account: { id: string };
	};
	loginToLibrusMock.mockResolvedValueOnce({ jar: JAR(JAR_2), account: ACCOUNT_B });
	const resB = await loginRequest(ip, { login: "filip", password: "pw-b" }, deviceToken);
	expect(resB.status).toBe(201);
	return { token: deviceToken, idA: account.id, idB: "librus:9" };
}

beforeEach(() => {
	loginToLibrusMock.mockReset();
	readGradesMock.mockReset();
	readGradeCategoriesMock.mockReset();
	readGradeCommentsMock.mockReset();
	readTeachersMock.mockReset();
	readGradeCategoriesMock.mockResolvedValue([]);
	readGradeCommentsMock.mockResolvedValue([]);
	readTeachersMock.mockResolvedValue([]);
});

describe("multi-account device", () => {
	it("holds two accounts; switching changes the proxy data context (different /Me)", async () => {
		const { token, idA, idB } = await loginTwoAccounts("198.51.102.1");

		const list = await authed("/api/accounts", token);
		expect(list.status).toBe(200);
		const listBody = (await list.json()) as {
			accounts: { id: string; firstName: string; role: string }[];
			activeAccountId: string | null;
		};
		expect(listBody.accounts.map((a) => a.id)).toEqual([idA, idB]);
		expect(listBody.accounts.map((a) => a.firstName)).toEqual(["Adam", "Filip"]);
		expect(listBody.activeAccountId).toBe(idB);

		// Switch back to A: /Me answers in A's context...
		const switchA = await authed("/api/accounts/switch", token, {
			method: "POST",
			body: JSON.stringify({ accountId: idA }),
		});
		expect(switchA.status).toBe(200);
		const meA = await authed("/api/me", token);
		expect(((await meA.json()) as { firstName: string }).firstName).toBe("Adam");

		// ...and forward to B again.
		const switchB = await authed("/api/accounts/switch", token, {
			method: "POST",
			body: JSON.stringify({ accountId: idB }),
		});
		expect(switchB.status).toBe(200);
		const meB = await authed("/api/me", token);
		expect(((await meB.json()) as { firstName: string }).firstName).toBe("Filip");
	});

	it("rejects switching to an account the device does not own", async () => {
		const { token } = await loginTwoAccounts("198.51.102.2");
		const res = await authed("/api/accounts/switch", token, {
			method: "POST",
			body: JSON.stringify({ accountId: "librus:9999" }),
		});
		expect(res.status).toBe(404);
	});
});

describe("silent renewal (server side)", () => {
	it("invalidated jar -> 401 -> refresh -> new jar in KV -> retry succeeds once", async () => {
		const { token } = await loginTwoAccounts("198.51.102.3");

		// The active account is B (last added). Invalidate the jar: the reader
		// answers 401 for the stale jar, then 200 after the renewal.
		readGradesMock
			.mockRejectedValueOnce(new LibrusError("SESSION_EXPIRED", 401))
			.mockResolvedValueOnce([]);
		const stale = await authed("/api/grades", token);
		expect(stale.status).toBe(401);
		expect(((await stale.json()) as { code: string }).code).toBe("SESSION_EXPIRED");

		// The device re-logs in with the held credentials; the jar swaps in KV.
		loginToLibrusMock.mockResolvedValueOnce({ jar: JAR(JAR_2), account: ACCOUNT_B });
		const refresh = await authed("/api/accounts/refresh", token, {
			method: "POST",
			body: JSON.stringify({ login: "filip", password: "pw-b" }),
		});
		expect(refresh.status).toBe(200);
		const jarInKv = JSON.parse((await env.KV.get("account:librus:9")) ?? "{}") as { jar: unknown };
		expect(jarInKv.jar).toEqual(JAR_2);

		// The retry now succeeds.
		const retry = await authed("/api/grades", token);
		expect(retry.status).toBe(200);
		expect(await retry.json()).toEqual({ grades: [], categories: [], comments: [], subjects: [] });
	});

	it("second failure answers 401 again (the device then shows the login screen)", async () => {
		const { token } = await loginTwoAccounts("198.51.102.4");

		readGradesMock.mockRejectedValue(new LibrusError("SESSION_EXPIRED", 401));
		const stale = await authed("/api/grades", token);
		expect(stale.status).toBe(401);

		// Renewal with wrong credentials fails with 401.
		loginToLibrusMock.mockRejectedValue(new LibrusError("WRONG_CREDENTIALS", 403));
		const refresh = await authed("/api/accounts/refresh", token, {
			method: "POST",
			body: JSON.stringify({ login: "filip", password: "WRONG" }),
		});
		expect(refresh.status).toBe(401);
		expect(((await refresh.json()) as { code: string }).code).toBe("WRONG_CREDENTIALS");
	});

	it("refuses to renew an account the device does not own", async () => {
		const { token } = await loginTwoAccounts("198.51.102.5");

		const OUTSIDER = { id: 99, firstName: "Obcy", lastName: "Konto", login: "obcy", groupId: 8 };
		loginToLibrusMock.mockResolvedValue({ jar: JAR(JAR_1), account: OUTSIDER });
		const refresh = await authed("/api/accounts/refresh", token, {
			method: "POST",
			body: JSON.stringify({ login: "obcy", password: "pw-x" }),
		});
		expect(refresh.status).toBe(403);
	});
});

describe("KV never stores the password", () => {
	it("writes after adding a second account carry no password material", async () => {
		const secrets = ["pw-a", "pw-b", "SUPER-SECRET", "password"];
		const { token } = await loginTwoAccounts("198.51.102.6");

		const keys = (await env.KV.list()).keys.map((k) => k.name);
		expect(keys.filter((k) => k.startsWith("device:")).length).toBeGreaterThanOrEqual(1);
		expect(keys.filter((k) => k.startsWith("account:")).length).toBeGreaterThanOrEqual(2);

		// The switcher works from the persisted state and still nothing leaks.
		const switchRes = await authed("/api/accounts/switch", token, {
			method: "POST",
			body: JSON.stringify({ accountId: "librus:7" }),
		});
		expect(switchRes.status).toBe(200);

		for (const key of keys) {
			const raw = (await env.KV.get(key)) ?? "";
			for (const secret of secrets) {
				expect(raw).not.toContain(secret);
			}
		}
	});
});

/**
 * Re-login on an existing device: the server-side active account must move
 * to the account just logged in — otherwise the browser renews account X
 * while the proxy serves account Y's (stale) jar, and every Librus call
 * dies with SESSION_EXPIRED.
 */
import { env } from "cloudflare:workers";
import { CookieJar, type CookieJarDTO } from "@repo/librus-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loginToLibrusMock = vi.hoisted(() => vi.fn());
vi.mock("@repo/librus-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@repo/librus-client")>();
	return { ...actual, loginToLibrus: loginToLibrusMock };
});

import { App } from "../app";

const JAR: CookieJarDTO = [{ name: "sid", value: "s", domain: "synergia.librus.pl", path: "/" }];
const ACCOUNT_A = { id: 101, firstName: "Adam", lastName: "A", groupId: 8 };
const ACCOUNT_B = { id: 102, firstName: "Bartek", lastName: "B", groupId: 5 };

function outcomeFor(account: typeof ACCOUNT_A) {
	return { jar: CookieJar.fromDTO(JAR), account };
}

async function seedDevice(token: string, accountIds: string[], activeAccountId: string) {
	await env.KV.put(`device:${token}`, JSON.stringify({ accountIds, activeAccountId }));
}

async function deviceRecord(
	token: string,
): Promise<{ accountIds: string[]; activeAccountId: string | null }> {
	const raw = await env.KV.get(`device:${token}`);
	return JSON.parse(raw ?? "{}");
}

describe("POST /api/login with an existing device token", () => {
	const TOKEN = "test-device-token";

	beforeEach(() => {
		loginToLibrusMock.mockReset();
	});

	it("moves the server-side active account to the one just logged in", async () => {
		await env.KV.delete(`device:${TOKEN}`);
		await seedDevice(TOKEN, ["librus:101", "librus:102"], "librus:101");
		loginToLibrusMock.mockResolvedValue(outcomeFor(ACCOUNT_B));

		const res = await App.request(
			"/api/login",
			{
				method: "POST",
				headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
				body: JSON.stringify({ login: "bartek", password: "secret" }),
			},
			env,
		);

		expect(res.status, `body=${await res.clone().text()}`).toBe(201);
		const device = await deviceRecord(TOKEN);
		expect(device.activeAccountId).toBe("librus:102");
	});

	it("keeps a fresh login minting its device with the logged-in account active", async () => {
		await env.KV.delete("device:fresh-login-token");
		loginToLibrusMock.mockResolvedValue(outcomeFor(ACCOUNT_A));

		const res = await App.request(
			"/api/login",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ login: "adam", password: "secret" }),
			},
			env,
		);

		expect(res.status, `body=${await res.clone().text()}`).toBe(201);
		const body = (await res.json()) as { deviceToken: string };
		const device = await deviceRecord(body.deviceToken);
		expect(device.activeAccountId).toBe("librus:101");
	});
});

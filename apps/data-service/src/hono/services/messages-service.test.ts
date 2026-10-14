/**
 * The M session lifecycle in the proxy: absent mJar is established from the G
 * jar once and persisted; an M 401 re-establishes exactly once and retries
 * the read.
 */
import { env } from "cloudflare:workers";
import { CookieJar, type CookieJarDTO, LibrusError } from "@repo/librus-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const establishMock = vi.hoisted(() => vi.fn());
const readInboxMock = vi.hoisted(() => vi.fn());
const readDetailMock = vi.hoisted(() => vi.fn());

vi.mock("@repo/librus-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@repo/librus-client")>();
	return {
		...actual,
		establishMessagesSession: establishMock,
		readInboxMessages: readInboxMock,
		readMessageDetail: readDetailMock,
	};
});

import { App } from "../app";
import { getInbox } from "./messages-service";

const G_JAR: CookieJarDTO = [
	{ name: "synergiaSid", value: "g1", domain: "synergia.librus.pl", path: "/" },
];
const M_JAR: CookieJarDTO = [
	{ name: "session_m", value: "m1", domain: ".wiadomosci.librus.pl", path: "/" },
];

async function seedAccount(accountId: string, mJar: CookieJarDTO | null): Promise<void> {
	await env.KV.put(
		`account:${accountId}`,
		JSON.stringify({
			id: accountId,
			firstName: "Adam",
			lastName: "Testowy",
			groupId: 8,
			jar: G_JAR,
			mJar,
			createdAt: "2026-10-13T00:00:00.000Z",
		}),
	);
}

describe("getInbox M-session lifecycle", () => {
	beforeEach(() => {
		establishMock.mockReset();
		readInboxMock.mockReset();
		establishMock.mockResolvedValue(CookieJar.fromDTO(M_JAR));
		readInboxMock.mockResolvedValue({ messages: [], total: 7 });
	});

	it("establishes the M jar from the G jar once and persists it", async () => {
		const accountId = "librus:301";
		await seedAccount(accountId, null);
		const result = await getInbox(env.KV, accountId, { page: 1, limit: 20 });
		expect(result.ok).toBe(true);
		expect(readInboxMock).toHaveBeenCalledTimes(1);
		expect(establishMock).toHaveBeenCalledTimes(1);
		const stored = await env.KV.get(`account:${accountId}`);
		const account = JSON.parse(stored ?? "{}") as { mJar?: CookieJarDTO };
		expect(account.mJar).toEqual(M_JAR);
	});

	it("reuses the stored M jar without re-establishing", async () => {
		const accountId = "librus:302";
		await seedAccount(accountId, M_JAR);
		const result = await getInbox(env.KV, accountId, { page: 1, limit: 20 });
		expect(result.ok).toBe(true);
		expect(establishMock).not.toHaveBeenCalled();
	});

	it("re-establishes M exactly once on 401 and retries the read", async () => {
		const accountId = "librus:303";
		await seedAccount(accountId, M_JAR);
		readInboxMock
			.mockRejectedValueOnce(new LibrusError("SESSION_EXPIRED", 401))
			.mockResolvedValueOnce({ messages: [], total: 3 });
		const result = await getInbox(env.KV, accountId, { page: 1, limit: 20 });
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.data.total).toBe(3);
		expect(establishMock).toHaveBeenCalledTimes(1);
		expect(readInboxMock).toHaveBeenCalledTimes(2);
	});
});

describe("GET /api/messages/outbox/:id (route regression)", () => {
	it("serves the SENT message detail over HTTP - the route must exist", async () => {
		const token = "tok-outbox-detail";
		const accountId = "librus:401";
		await env.KV.put(
			`device:${token}`,
			JSON.stringify({ accountIds: [accountId], activeAccountId: accountId }),
		);
		await seedAccount(accountId, M_JAR);
		readDetailMock.mockResolvedValue({
			messageId: "2001",
			senderName: "Ja",
			topic: "Wysłana",
			content: "Pełna treść wysłanej.",
			sendDate: "2026-10-13 10:00:00",
			readDate: null,
			hasAttachments: false,
			attachments: [],
		});
		const res = await App.request(
			"/api/messages/outbox/2001",
			{ headers: { Authorization: `Bearer ${token}` } },
			{ KV: env.KV },
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { content?: string };
		expect(body.content).toBe("Pełna treść wysłanej.");
		expect(readDetailMock).toHaveBeenCalledWith(expect.anything(), "outbox", "2001");
	});
});

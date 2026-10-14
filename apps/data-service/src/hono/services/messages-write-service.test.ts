/**
 * Serwis zapisu (Faza 9): wysyłka wykonuje DOKŁADNIE JEDNO wywołanie
 * librus-clienta przy błędzie/niejednoznacznym wyniku (brak automatycznego
 * retry wysyłki), a cykl życia szkica przechodzi create→read→update→delete.
 */
import { env } from "cloudflare:workers";
import { CookieJar, type CookieJarDTO, LibrusError } from "@repo/librus-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const establishMock = vi.hoisted(() => vi.fn());
const createDraftMock = vi.hoisted(() => vi.fn());
const readDraftMock = vi.hoisted(() => vi.fn());
const updateDraftMock = vi.hoisted(() => vi.fn());
const deleteDraftMock = vi.hoisted(() => vi.fn());
const listDraftsMock = vi.hoisted(() => vi.fn());
const sendMessageMock = vi.hoisted(() => vi.fn());

vi.mock("@repo/librus-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@repo/librus-client")>();
	return {
		...actual,
		establishMessagesSession: establishMock,
		createDraft: createDraftMock,
		readDraft: readDraftMock,
		updateDraft: updateDraftMock,
		deleteDraft: deleteDraftMock,
		listDrafts: listDraftsMock,
		sendMessage: sendMessageMock,
	};
});

import {
	createDraft,
	deleteDraft,
	getDraft,
	listDrafts,
	sendMessage,
	updateDraft,
} from "./messages-write-service";

const G_JAR: CookieJarDTO = [
	{ name: "synergiaSid", value: "g1", domain: "synergia.librus.pl", path: "/" },
];
const M_JAR: CookieJarDTO = [
	{ name: "session_m", value: "m1", domain: ".wiadomosci.librus.pl", path: "/" },
];
const ACCOUNT = "librus:write-test";

async function seedAccount(): Promise<void> {
	await env.KV.put(
		`account:${ACCOUNT}`,
		JSON.stringify({
			id: ACCOUNT,
			firstName: "Adam",
			lastName: "Testowy",
			groupId: 8,
			jar: G_JAR,
			mJar: M_JAR,
			createdAt: "2026-10-13T00:00:00.000Z",
		}),
	);
}

const BODY = {
	receivers: [{ typeId: "schoolReceivers", accountId: "301" }],
	topic: "Test",
	content: "Tresc testowa",
	storageId: null,
};

describe("sendMessage — brak automatycznego retry", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		establishMock.mockResolvedValue(CookieJar.fromDTO(M_JAR));
		await seedAccount();
	});

	it("błąd Librusa (UNEXPECTED_RESPONSE) → dokładnie jedno wywołanie i błąd do klienta", async () => {
		sendMessageMock.mockRejectedValue(new LibrusError("UNEXPECTED_RESPONSE", 502));
		const result = await sendMessage(env.KV, ACCOUNT, BODY);
		expect(result.ok).toBe(false);
		expect(sendMessageMock).toHaveBeenCalledTimes(1); // zero ponowień
		if (!result.ok) expect(result.error.code).toBe("LIBRUS_UNAVAILABLE");
	});

	it(" sukces przechodzi dokładnie raz i zwraca {messageId, status}", async () => {
		sendMessageMock.mockResolvedValue({ messageId: "77", status: "sent" });
		const result = await sendMessage(env.KV, ACCOUNT, BODY);
		expect(result.ok).toBe(true);
		expect(sendMessageMock).toHaveBeenCalledTimes(1);
		if (result.ok) expect(result.data).toEqual({ messageId: "77", status: "sent" });
	});

	it("401 sesji M: odnawia sesję raz i ponawia (401 = nic nie zostało dostarczone)", async () => {
		sendMessageMock
			.mockRejectedValueOnce(new LibrusError("SESSION_EXPIRED", 401))
			.mockResolvedValueOnce({ messageId: "5", status: "sent" });
		const result = await sendMessage(env.KV, ACCOUNT, BODY);
		expect(result.ok).toBe(true);
		expect(sendMessageMock).toHaveBeenCalledTimes(2); // 1 próba + 1 po odnowieniu sesji
		expect(establishMock).toHaveBeenCalledTimes(1);
	});

	it("401 dwukrotnie: dokładnie dwa wywołania, potem błąd (bez dalszych ponowień)", async () => {
		sendMessageMock.mockRejectedValue(new LibrusError("SESSION_EXPIRED", 401));
		const result = await sendMessage(env.KV, ACCOUNT, BODY);
		expect(result.ok).toBe(false);
		expect(sendMessageMock).toHaveBeenCalledTimes(2);
		expect(establishMock).toHaveBeenCalledTimes(1);
	});
});

describe("szkic: create→read→update→delete przez serwis", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		establishMock.mockResolvedValue(CookieJar.fromDTO(M_JAR));
		await seedAccount();
	});

	it("utrzymuje treść po update i usuwa", async () => {
		createDraftMock.mockResolvedValue({
			identifier: "9",
			topic: "Test",
			body: "Stara",
			receivers: [],
			storageId: null,
			hasAttachments: false,
			type: null,
			dateAdded: null,
			parentMessageIdentifier: null,
		});
		readDraftMock.mockResolvedValueOnce({
			identifier: "9",
			topic: "Test",
			body: "Stara",
			receivers: [],
			storageId: null,
			hasAttachments: false,
			type: null,
			dateAdded: null,
			parentMessageIdentifier: null,
		});
		updateDraftMock.mockResolvedValue({
			identifier: "9",
			topic: "Test",
			body: "Nowa",
			receivers: [],
			storageId: null,
			hasAttachments: false,
			type: null,
			dateAdded: null,
			parentMessageIdentifier: null,
		});
		readDraftMock.mockResolvedValueOnce({
			identifier: "9",
			topic: "Test",
			body: "Nowa",
			receivers: [],
			storageId: null,
			hasAttachments: false,
			type: null,
			dateAdded: null,
			parentMessageIdentifier: null,
		});
		deleteDraftMock.mockResolvedValue(undefined);

		const created = await createDraft(env.KV, ACCOUNT, BODY);
		expect(created.ok).toBe(true);
		const r1 = await getDraft(env.KV, ACCOUNT, "9");
		expect(r1.ok && r1.data?.body).toBe("Stara");
		const updated = await updateDraft(env.KV, ACCOUNT, "newOne", "9", BODY);
		expect(updated.ok && updated.data?.body).toBe("Nowa");
		const r2 = await getDraft(env.KV, ACCOUNT, "9");
		expect(r2.ok && r2.data?.body).toBe("Nowa");
		const removed = await deleteDraft(env.KV, ACCOUNT, "9");
		expect(removed.ok).toBe(true);
		expect(deleteDraftMock).toHaveBeenCalledWith(CookieJar.fromDTO(M_JAR), "9");
	});

	it("lista szkiców przekazuje page/limit", async () => {
		listDraftsMock.mockResolvedValue({ drafts: [], total: 0 });
		const result = await listDrafts(env.KV, ACCOUNT, { page: 2, limit: 10 });
		expect(result.ok).toBe(true);
		expect(listDraftsMock).toHaveBeenCalledWith(CookieJar.fromDTO(M_JAR), 2, 10);
	});
});

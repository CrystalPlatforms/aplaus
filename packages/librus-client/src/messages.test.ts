/**
 * M readers on the audited fixture shapes: inbox/outbox normalize
 * `{data, total}` with page/limit; the unread counter issues exactly ONE
 * request (metadata only — never message content); dictionaries are read
 * defensively.
 */
import { describe, expect, it, vi } from "vitest";
import { CookieJar } from "./cookie-jar";
import type { HttpDeps } from "./http";
import {
	decodeMaybeBase64,
	fetchAttachment,
	readCustomReceiverGroups,
	readInboxMessages,
	readMessageDetail,
	readMessagesMe,
	readOutboxMessages,
	readReceiverTypes,
	readTags,
	readUnreadMessagesCount,
} from "./messages";

const INBOX_FIXTURE = {
	data: [
		{
			messageId: "1001",
			senderFirstName: "Anna",
			senderLastName: "Kowalska",
			senderName: "Anna Kowalska",
			topic: "Wywiadówka",
			content: "Zapraszam",
			sendDate: "2026-10-11 18:00:00",
			readDate: null,
			tags: [],
			category: null,
			otherNodeUuid: null,
			otherNodeAccountId: null,
			isAnyFileAttached: true,
		},
	],
	total: 37,
};

/**
 * Serves the M API by path. The registry records every requested URL so the
 * "counter without content" test can assert the exact call set.
 */
function depsServingM(routes: Record<string, unknown>): { deps: HttpDeps; requests: string[] } {
	const requests: string[] = [];
	const deps: HttpDeps = {
		fetch: vi.fn(async (input: string | URL | Request) => {
			const url =
				typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
			requests.push(url);
			for (const [path, body] of Object.entries(routes)) {
				if (url.includes(path)) return Response.json(body);
			}
			return Response.json({}, { status: 404 });
		}),
		now: () => 0,
		randomPart: () => "",
	};
	return { deps, requests };
}

describe("readInboxMessages / readOutboxMessages", () => {
	it("normalizes {data, total} and requests the page/limit params", async () => {
		const { deps, requests } = depsServingM({ "inbox/messages": INBOX_FIXTURE });
		const page = await readInboxMessages(CookieJar.empty(), 2, 20, deps);
		expect(page.total).toBe(37);
		expect(page.messages).toEqual([
			{
				messageId: "1001",
				senderName: "Anna Kowalska",
				topic: "Wywiadówka",
				content: "Zapraszam",
				sendDate: "2026-10-11 18:00:00",
				readDate: null,
				hasAttachments: true,
			},
		]);
		expect(requests[0]).toContain("/api/inbox/messages?page=2&limit=20");
	});

	it("falls back to senderFirstName + senderLastName without senderName", async () => {
		const { deps } = depsServingM({
			"inbox/messages": {
				data: [{ messageId: "9", senderFirstName: "Jan", senderLastName: "Nowak" }],
				total: 1,
			},
		});
		const page = await readInboxMessages(CookieJar.empty(), 1, 20, deps);
		expect(page.messages[0]?.senderName).toBe("Jan Nowak");
	});

	it("reads the outbox from outbox/messages", async () => {
		const { deps } = depsServingM({ "outbox/messages": { data: [], total: 0 } });
		const page = await readOutboxMessages(CookieJar.empty(), 1, 20, deps);
		expect(page.messages).toEqual([]);
		expect(page.total).toBe(0);
	});
});

describe("readUnreadMessagesCount", () => {
	it("reads inbox from the counter with EXACTLY ONE request - no content endpoints", async () => {
		const { deps, requests } = depsServingM({
			"inbox/unreadMessagesCount": {
				data: {
					inbox: 3,
					notes: 0,
					alerts: 1,
					substitutions: 0,
					absences: 0,
					justifications: 0,
					trash: 0,
					archiveInbox: 0,
				},
			},
		});
		const counts = await readUnreadMessagesCount(CookieJar.empty(), deps);
		expect(counts.inbox).toBe(3);
		expect(counts.others.alerts).toBe(1);
		expect(requests.length).toBe(1);
		expect(requests[0]).toContain("/api/inbox/unreadMessagesCount");
		// Metadata only: no message-list or message-detail call may happen.
		expect(requests.some((u) => u.includes("messages?page=") || /\/messages\/\d/.test(u))).toBe(
			false,
		);
	});

	it("normalizes a missing counter to zero", async () => {
		const { deps } = depsServingM({ "inbox/unreadMessagesCount": { data: {} } });
		const counts = await readUnreadMessagesCount(CookieJar.empty(), deps);
		expect(counts.inbox).toBe(0);
		expect(counts.others).toEqual({});
	});
});

describe("readMessageDetail", () => {
	it("normalizes the detail; content falls back to `body`, names to any filename-shaped string", async () => {
		const { deps } = depsServingM({
			"inbox/messages/1001": {
				data: {
					messageId: "1001",
					topic: "Wywiadówka",
					body: "Zapraszam na zebranie.",
					attachments: [{ FileName: "plan.pdf" }, { originalName: "opis.docx" }, {}],
				},
			},
		});
		const detail = await readMessageDetail(CookieJar.empty(), "inbox", "1001", deps);
		expect(detail?.content).toBe("Zapraszam na zebranie.");
		expect(detail?.attachments).toEqual([
			{ fileName: "plan.pdf", id: null },
			{ fileName: "opis.docx", id: null },
			{ fileName: null, id: null },
		]);
	});

	it("falls back to the folder-qualified archive path when the folder path answers 404", async () => {
		const requests: string[] = [];
		const deps: HttpDeps = {
			fetch: vi.fn(async (input: string | URL | Request) => {
				const url =
					typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
				requests.push(url);
				if (url.endsWith("/api/outbox/messages/2002")) {
					return Response.json({}, { status: 404 });
				}
				if (url.endsWith("/api/archive/outbox/messages/2002")) {
					return Response.json({ data: { messageId: "2002", Message: "QXJjaGl3dW0=" } });
				}
				return Response.json({}, { status: 404 });
			}),
			now: () => 0,
			randomPart: () => "",
		};
		const detail = await readMessageDetail(CookieJar.empty(), "outbox", "2002", deps);
		expect(detail?.content).toBe("Archiwum");
		expect(requests.some((u) => u.includes("/api/outbox/messages/2002"))).toBe(true);
		// The official client's read route is the folder-qualified archive path.
		expect(requests.some((u) => u.includes("/api/archive/outbox/messages/2002"))).toBe(true);
		// Plain /archive/messages is only the official DELETE route — never read.
		expect(requests.some((u) => u.includes("/api/archive/messages/2002"))).toBe(false);
	});

	it("uses the requested id when the archive payload omits messageId", async () => {
		const { deps } = depsServingM({
			"archive/inbox/messages/7001": {
				data: {
					topic: "Z archiwum",
					Message: Buffer.from("Stara treść.", "utf8").toString("base64"),
				},
			},
		});
		const detail = await readMessageDetail(CookieJar.empty(), "inbox", "7001", deps);
		expect(detail?.messageId).toBe("7001");
		expect(detail?.topic).toBe("Z archiwum");
		expect(detail?.content).toBe("Stara treść.");
	});

	it("returns null when the data object is missing on both paths", async () => {
		const { deps } = depsServingM({
			"inbox/messages/404": { data: null },
			"messages/404": { data: null },
		});
		const detail = await readMessageDetail(CookieJar.empty(), "inbox", "404", deps);
		expect(detail).toBeNull();
	});
});

describe("dictionaries", () => {
	it("reads receiver types from data.list", async () => {
		const { deps } = depsServingM({
			"receivers/types": { data: { defaultGroup: "1", list: [{ id: "1", name: "Wychowawcy" }] } },
		});
		const types = await readReceiverTypes(CookieJar.empty(), deps);
		expect(types).toEqual([{ id: "1", name: "Wychowawcy" }]);
	});

	it("reads tags and custom groups; unobserved shapes yield empty lists", async () => {
		const { deps } = depsServingM({
			tags: { data: [] },
			"receivers/custom-groups": { groups: [] },
		});
		expect(await readTags(CookieJar.empty(), deps)).toEqual([]);
		expect(await readCustomReceiverGroups(CookieJar.empty(), deps)).toEqual([]);
	});

	it("reads the M /me meta", async () => {
		const { deps } = depsServingM({
			"/api/me": {
				firstName: "Anna",
				lastName: "Kowalska",
				groupId: "PARENT",
				groupName: "Rodzic",
				accountId: 42,
				originSystem: "SYNERGIA",
			},
		});
		const me = await readMessagesMe(CookieJar.empty(), deps);
		expect(me).toEqual({
			accountId: 42,
			firstName: "Anna",
			lastName: "Kowalska",
			groupId: "PARENT",
			groupName: "Rodzic",
			originSystem: "SYNERGIA",
		});
	});
});

describe("decodeMaybeBase64", () => {
	it("decodes the live-account Base64 body (UTF-8, Polish diacritics)", async () => {
		// Real body captured in HITL: "Dzień dobry \n\nProśbę o wysłanie kartki..."
		const encoded =
			"RHppZcWEIGRvYnJ5IAoKUHJvc3rEmSBvIHd5c8WCYW5pZSB rYXJ0a2kgeiB0ZW1hdGFtaSBvIGt0w7NyeWNoIHBhbmkgbcOzd2nFgmEgeiBrdMOzcnljaCBtb2fEmSB6cm9iaQ".replace(
				" ",
				"",
			);
		const { deps } = depsServingM({
			"inbox/messages": {
				data: [{ messageId: "3001", topic: "VGVzdCB0ZW11", content: encoded }],
				total: 1,
			},
		});
		const page = await readInboxMessages(CookieJar.empty(), 1, 20, deps);
		expect(page.messages[0]?.content.startsWith("Dzień dobry")).toBe(true);
		expect(page.messages[0]?.content).toContain("kartki z tematami");
		expect(page.messages[0]?.topic).toBe("Test temu");
	});

	it("keeps plain text, diacritics and short strings untouched", () => {
		expect(decodeMaybeBase64("Witaj świecie")).toBe("Witaj świecie");
		expect(decodeMaybeBase64("Test")).toBe("Test"); // valid alphabet, invalid UTF-8 when decoded
		expect(decodeMaybeBase64("")).toBe("");
	});

	it("keeps strings with spaces and punctuation as they are", () => {
		expect(decodeMaybeBase64("Dzień dobry, proszę o kartkę.")).toBe(
			"Dzień dobry, proszę o kartkę.",
		);
	});
});

describe("detail body source (official client contract)", () => {
	it("prefers the Message field (capital M) and unwraps the <Content> XML envelope", async () => {
		const encoded = Buffer.from("<Content>Pełna treść z pola Message.</Content>", "utf8").toString(
			"base64",
		);
		const { deps } = depsServingM({
			"inbox/messages/5001": {
				data: {
					messageId: "5001",
					topic: "Temat",
					content: "Ucięty podgląd",
					Message: encoded,
				},
			},
		});
		const detail = await readMessageDetail(CookieJar.empty(), "inbox", "5001", deps);
		expect(detail?.content).toBe("Pełna treść z pola Message.");
	});

	it("keeps plain decoded text without the envelope", async () => {
		const { deps } = depsServingM({
			"messages/5002": {
				data: {
					messageId: "5002",
					Message: Buffer.from("Zwykła treść bez koperty.", "utf8").toString("base64"),
				},
			},
		});
		const detail = await readMessageDetail(CookieJar.empty(), "outbox", "5002", deps);
		expect(detail?.content).toBe("Zwykła treść bez koperty.");
	});

	it("reads attachment ids for the download call", async () => {
		const { deps } = depsServingM({
			"inbox/messages/5003": {
				data: {
					messageId: "5003",
					topic: "Z plikiem",
					Message: Buffer.from("Tekst", "utf8").toString("base64"),
					attachments: [{ Id: 77, FileName: "plan.pdf" }, { attachmentId: "88" }],
				},
			},
		});
		const detail = await readMessageDetail(CookieJar.empty(), "inbox", "5003", deps);
		expect(detail?.attachments).toEqual([
			{ fileName: "plan.pdf", id: "77" },
			{ fileName: null, id: "88" },
		]);
	});
});

describe("fetchAttachment", () => {
	it("downloads via attachments/{fileId}/messages/{messageId}", async () => {
		const requests: string[] = [];
		const deps: HttpDeps = {
			fetch: vi.fn(async (input: string | URL | Request) => {
				const url =
					typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
				requests.push(url);
				return new Response("PDF-BYTES", {
					status: 200,
					headers: {
						"Content-Type": "application/pdf",
						"Content-Disposition": 'attachment; filename="plan.pdf"',
					},
				});
			}),
			now: () => 0,
			randomPart: () => "",
		};
		const file = await fetchAttachment(CookieJar.empty(), "77", "5003", deps);
		expect(new TextDecoder().decode(file.bytes)).toBe("PDF-BYTES");
		expect(file.contentType).toBe("application/pdf");
		expect(file.fileName).toBe("plan.pdf");
		expect(requests[0]).toContain("/api/attachments/77/messages/5003");
	});
});

describe("Message/CDATA envelope (live-account shape)", () => {
	const ENVELOPE =
		"<Message><Content><![CDATA[Dzień dobry\n\nPełna treść wiadomości.]]></Content><Actions></Actions></Message>";
	const b64 = (text: string) => Buffer.from(text, "utf8").toString("base64");

	it("extracts the first Content CDATA from the <Message> envelope (detail)", async () => {
		const { deps } = depsServingM({
			"inbox/messages/6001": {
				data: { messageId: "6001", topic: "T", Message: b64(ENVELOPE) },
			},
		});
		const detail = await readMessageDetail(CookieJar.empty(), "inbox", "6001", deps);
		expect(detail?.content).toBe("Dzień dobry\n\nPełna treść wiadomości.");
	});

	it("list preview keeps clean text: envelope unwrapped there too", async () => {
		const { deps } = depsServingM({
			"inbox/messages": { data: [{ messageId: "6002", content: b64(ENVELOPE) }], total: 1 },
		});
		const page = await readInboxMessages(CookieJar.empty(), 1, 20, deps);
		expect(page.messages[0]?.content).toBe("Dzień dobry\n\nPełna treść wiadomości.");
	});

	it("truncated preview shows the partial text, not the XML tags", async () => {
		// The live list caps the preview (~100 bytes) — the envelope gets cut.
		const full = b64(ENVELOPE);
		const truncated = full.slice(0, 60); // cuts inside the base64 → partial payload
		const partialDecoded = Buffer.from(`${truncated}===`, "base64").toString("utf8");
		const { deps } = depsServingM({
			"inbox/messages": { data: [{ messageId: "6003", content: truncated }], total: 1 },
		});
		const page = await readInboxMessages(CookieJar.empty(), 1, 20, deps);
		const shown = page.messages[0]?.content ?? "";
		expect(shown).not.toContain("<Content");
		expect(shown).not.toContain("<Message");
		expect(shown.startsWith("Dzień dobry")).toBe(true);
		void partialDecoded;
	});

	it("plain text without any envelope passes through untouched", async () => {
		const { deps } = depsServingM({
			"inbox/messages": {
				data: [
					{ messageId: "6004", content: Buffer.from("Zwykła treść.", "utf8").toString("base64") },
				],
				total: 1,
			},
		});
		const page = await readInboxMessages(CookieJar.empty(), 1, 20, deps);
		expect(page.messages[0]?.content).toBe("Zwykła treść.");
	});

	it("picks the LONGEST body field - a short content cannot mask a full Message", async () => {
		const envelope =
			"<Message><Content><![CDATA[Pełna treść wiadomości z wieloma zdaniami.]]></Content><Actions></Actions></Message>";
		const { deps } = depsServingM({
			"inbox/messages/8001": {
				data: {
					messageId: "8001",
					content: "Skrót.",
					Message: Buffer.from(envelope, "utf8").toString("base64"),
				},
			},
		});
		const detail = await readMessageDetail(CookieJar.empty(), "inbox", "8001", deps);
		expect(detail?.content).toBe("Pełna treść wiadomości z wieloma zdaniami.");
	});

	it("strips residual XML when no Content node is extractable (official parsererror path)", async () => {
		const { deps } = depsServingM({
			"outbox/messages/8002": {
				data: {
					messageId: "8002",
					Message: Buffer.from("<p>Akapit pierwszy.</p><p>Drugi.</p>", "utf8").toString("base64"),
				},
			},
		});
		const detail = await readMessageDetail(CookieJar.empty(), "outbox", "8002", deps);
		expect(detail?.content).toBe("Akapit pierwszy.Drugi.");
	});
});

describe("M session death (non-JSON success)", () => {
	it("throws SESSION_EXPIRED when a dead session answers 200 with HTML", async () => {
		const deps: HttpDeps = {
			fetch: vi.fn(
				async () =>
					new Response("<html>Strona logowania</html>", {
						status: 200,
						headers: { "Content-Type": "text/html; charset=utf-8" },
					}),
			),
			now: () => 0,
			randomPart: () => "",
		};
		await expect(readInboxMessages(CookieJar.empty(), 1, 20, deps)).rejects.toMatchObject({
			code: "SESSION_EXPIRED",
		});
	});
});

describe("readCustomReceiverGroups — HITL r.4 kształty", () => {
	it("czyta grupy z {data: [...]}, gdy {groups: []} nie zawiera niczego", async () => {
		const { deps } = depsServingM({
			"receivers/custom-groups": { data: [{ id: 7, name: "Moja grupa" }] },
		});
		expect(await readCustomReceiverGroups(CookieJar.empty(), deps)).toEqual([
			{ id: "7", name: "Moja grupa" },
		]);
	});
});
it("czyta grupy z {Groups: [...]} i kluczami groupId/groupName", async () => {
	const { deps } = depsServingM({
		"receivers/custom-groups": { Groups: [{ groupId: 9, groupName: "Szersza" }] },
	});
	expect(await readCustomReceiverGroups(CookieJar.empty(), deps)).toEqual([
		{ id: "9", name: "Szersza" },
	]);
});

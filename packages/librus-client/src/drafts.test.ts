/**
 * Kontraktowe testy zapisu M (Fazy 9–10): body szkica i wysyłki dokładnie wg
 * audytu (Base64 topic/content, receivers grouped by typeId, storageId,
 * category), cykl życia szkica na mockach, brak retry wysyłki oraz kontekst
 * reply/forward przenoszony jako STRING.
 */
import { describe, expect, it, vi } from "vitest";
import { CookieJar } from "./cookie-jar";
import {
	createContextDraft,
	createDraft,
	deleteDraft,
	listDrafts,
	readDraft,
	sendMessage,
	updateDraft,
} from "./drafts";
import type { HttpDeps } from "./http";

interface Recorded {
	url: string;
	method: string;
	body: string | FormData | undefined;
}

/** Serves fixture routes and records every request (url, method, body). */
function depsServingM(routes: Record<string, { status?: number; body?: unknown } | unknown>): {
	deps: HttpDeps;
	requests: Recorded[];
} {
	const requests: Recorded[] = [];
	const deps: HttpDeps = {
		fetch: vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
			const url =
				typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
			requests.push({
				url,
				method: init?.method ?? "GET",
				body: init?.body as string | FormData | undefined,
			});
			for (const [path, route] of Object.entries(routes)) {
				const body =
					(route as { body?: unknown }).body !== undefined
						? (route as { body?: unknown }).body
						: route;
				const status = (route as { status?: number }).status ?? 200;
				if (url.includes(path)) {
					// body: null symuluje PUSTE body (Librus tak odpowiada na część zapisów).
					if (body === null)
						return new Response(null, { status, headers: { "content-type": "application/json" } });
					return Response.json(body, { status });
				}
			}
			return Response.json({}, { status: 404 });
		}),
		now: () => 0,
		randomPart: () => "",
	};
	return { deps, requests };
}

/** btoa-safe Base64 of UTF-8 text (fixtures carry Polish characters). */
function b64(text: string): string {
	const bytes = new TextEncoder().encode(text);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

const JAR = CookieJar.empty();

describe("createDraft — kontrakt body z audytu", () => {
	it("wysyła receivers.schoolReceivers, Base64 topic/content i storageId null", async () => {
		const { deps, requests } = depsServingM({
			"drafts/newOne": {
				status: 201,
				body: {
					data: { identifier: 42, topic: "VGVzdA==", body: "VHJlc2MgdGVzdG93YQ==", receivers: [] },
				},
			},
		});
		const draft = await createDraft(
			JAR,
			{
				receivers: [{ typeId: "schoolReceivers", accountId: "301" }],
				topic: "Test",
				content: "Tresc testowa",
				storageId: null,
			},
			deps,
		);
		expect(draft.identifier).toBe("42");
		const recorded = requests[0];
		expect(recorded?.url).toContain("https://wiadomosci.librus.pl/api/drafts/newOne");
		expect(recorded?.method).toBe("POST");
		const body = JSON.parse(recorded?.body as string) as Record<string, unknown>;
		expect(body).toEqual({
			receivers: { schoolReceivers: [{ accountId: "301" }] },
			topic: "VGVzdA==", // Base64 UTF-8 "Test" — jak w audycie
			content: "VHJlc2MgdGVzdG93YQ==", // Base64 UTF-8 "Tresc testowa"
			storageId: null,
		});
	});

	it("escape'uje znaki HTML treści przed kodowaniem Base64", async () => {
		const { deps, requests } = depsServingM({
			"drafts/newOne": { body: { data: { identifier: 1, receivers: [] } } },
		});
		await createDraft(
			JAR,
			{ receivers: [], topic: "T", content: "a<b & c", storageId: null },
			deps,
		);
		const firstRequest = requests[0];
		const body = JSON.parse(firstRequest?.body as string) as { content: string };
		const decoded = atob(body.content);
		expect(decoded).toBe("a&lt;b &amp; c");
	});
});

describe("sendMessage — POST /messages, dokładnie jedno żądanie", () => {
	it("wysyła receivers/topic/content/storageId/category wg kontraktu klienta Librusa", async () => {
		const { deps, requests } = depsServingM({
			"/api/messages": { status: 201, body: { data: { messageId: 77, status: "sent" } } },
		});
		const sent = await sendMessage(
			JAR,
			{
				receivers: [{ typeId: "schoolReceivers", accountId: "301" }],
				topic: "Test",
				content: "Tresc",
				storageId: null,
			},
			deps,
		);
		expect(sent).toEqual({ messageId: "77", status: "sent" });
		expect(requests).toHaveLength(1); // zawsze dokładnie jedno żądanie wysyłki
		const sendRequest = requests[0];
		const body = JSON.parse(sendRequest?.body as string) as Record<string, unknown>;
		expect(body.category).toBe("normal");
		expect(body.storageId).toBeNull();
		expect(body.topic).toBe("VGVzdA==");
	});

	it("NIE ponowi wysyłki przy błędzie/niejednoznacznym wyniku (502 → dokładnie jedno żądanie)", async () => {
		const { deps, requests } = depsServingM({
			"/api/messages": { status: 502, body: { error: "x" } },
		});
		await expect(
			sendMessage(JAR, { receivers: [], topic: "T", content: "C", storageId: null }, deps),
		).rejects.toMatchObject({ code: "UNEXPECTED_RESPONSE" });
		expect(requests).toHaveLength(1);
	});

	it("nie ponowi nawet gdy odpowiedź jest niejednoznacznym HTML-em (martwa sesja)", async () => {
		const requests: Recorded[] = [];
		const deps: HttpDeps = {
			fetch: vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
				requests.push({
					url: String(input),
					method: init?.method ?? "GET",
					body: init?.body as string | undefined,
				});
				return new Response("<html>login</html>", {
					status: 200,
					headers: { "content-type": "text/html" },
				});
			}),
			now: () => 0,
			randomPart: () => "",
		};
		await expect(
			sendMessage(JAR, { receivers: [], topic: "T", content: "C", storageId: null }, deps),
		).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
		expect(requests).toHaveLength(1);
	});
});

describe("szkic: create→read→update→read→delete na mockach", () => {
	it("utrzymuje treść po update (request content vs response body)", async () => {
		// Rejestr tras jest mutowalny: pierwsze GET zwraca starą treść, po update nową.
		const routes: Record<string, unknown> = {
			// Nowsze/dłuższe trasy najpierw — dopasowanie działa przez includes().
			"drafts/newOne/9": {
				status: 200,
				body: {
					data: { identifier: 9, topic: "VGVzdA==", body: b64("Nowa treść"), receivers: [] },
				},
			},
			"drafts/9": {
				body: {
					data: { identifier: 9, topic: "VGVzdA==", body: b64("Stara treść"), receivers: [] },
				},
			},
			"drafts/newOne": {
				status: 201,
				body: {
					data: { identifier: 9, topic: "VGVzdA==", body: b64("Stara treść"), receivers: [] },
				},
			},
		};
		const { deps, requests } = depsServingM(routes);
		const created = await createDraft(
			JAR,
			{
				receivers: [{ typeId: "schoolReceivers", accountId: "301" }],
				topic: "Test",
				content: "Stara treść",
				storageId: null,
			},
			deps,
		);
		const afterCreate = await readDraft(JAR, created.identifier, deps);
		expect(afterCreate?.body).toBe("Stara treść");

		// Po update Librus zwraca nową treść.
		routes["drafts/9"] = {
			body: { data: { identifier: 9, topic: "VGVzdA==", body: b64("Nowa treść"), receivers: [] } },
		};
		const updated = await updateDraft(
			JAR,
			"newOne",
			created.identifier,
			{ receivers: [], topic: "Test", content: "Nowa treść", storageId: null },
			deps,
		);
		expect(updated?.body).toBe("Nowa treść");
		const reread = await readDraft(JAR, "9", deps);
		expect(reread?.body).toBe("Nowa treść");
		expect(requests.some((r) => r.method === "DELETE" && r.url.includes("/api/drafts/9"))).toBe(
			false,
		);

		await deleteDraft(JAR, "9", deps);
		expect(requests.some((r) => r.method === "DELETE" && r.url.includes("/api/drafts/9"))).toBe(
			true,
		);
	});

	it("readDraft zwraca null przy 404 (szkic usunięty)", async () => {
		const { deps } = depsServingM({ "drafts/5": { status: 404, body: {} } });
		expect(await readDraft(JAR, "5", deps)).toBeNull();
	});
});

describe("listDrafts", () => {
	it("normalizuje {data, total} i używa page/limit", async () => {
		const { deps, requests } = depsServingM({
			"drafts?": {
				body: { data: [{ identifier: 3, topic: "VGVzdA==", isAnyFileAttached: false }], total: 11 },
			},
		});
		const page = await listDrafts(JAR, 2, 20, deps);
		expect(page.total).toBe(11);
		expect(page.drafts[0]?.identifier).toBe("3");
		expect(page.drafts[0]?.topic).toBe("Test");
		expect(requests[0]?.url).toContain("drafts?page=2&limit=20");
	});
});

describe("kontekst reply/forward — id jako STRING (Faza 10)", () => {
	it("createContextDraft wysyła repliedToMessageId jako string", async () => {
		const { deps, requests } = depsServingM({
			"drafts/reply": {
				status: 201,
				body: {
					data: { identifier: 12, receivers: [], type: "reply", parentMessageIdentifier: 456 },
				},
			},
		});
		await createContextDraft(
			JAR,
			"reply",
			"456",
			{ receivers: [], topic: "Re:", content: "OK", storageId: null },
			deps,
		);
		const body = JSON.parse(requests[0]?.body as string) as Record<string, unknown>;
		expect(body.repliedToMessageId).toBe("456");
		expect(typeof body.repliedToMessageId).toBe("string");
	});

	it("createContextDraft wysyła forwardedMessageId jako string", async () => {
		const { deps, requests } = depsServingM({
			"drafts/forward": {
				status: 201,
				body: { data: { identifier: 13, receivers: [], type: "forward" } },
			},
		});
		await createContextDraft(
			JAR,
			"forward",
			"789",
			{ receivers: [], topic: "Fwd:", content: "OK", storageId: null },
			deps,
		);
		const body = JSON.parse(requests[0]?.body as string) as Record<string, unknown>;
		expect(body.forwardedMessageId).toBe("789");
		expect(typeof body.forwardedMessageId).toBe("string");
	});

	it("sendMessage dołącza repliedToMessageId (string) gdy podany", async () => {
		const { deps, requests } = depsServingM({
			"/api/messages": { status: 201, body: { data: { messageId: 1, status: "sent" } } },
		});
		await sendMessage(
			JAR,
			{ receivers: [], topic: "T", content: "C", storageId: null, repliedToMessageId: "42" },
			deps,
		);
		const body = JSON.parse(requests[0]?.body as string) as Record<string, unknown>;
		expect(body.repliedToMessageId).toBe("42");
		expect(typeof body.repliedToMessageId).toBe("string");
	});
});

describe("HITL r.1 — tolerancja pustych odpowiedzi zapisu", () => {
	it("createDraft z pustym echem 201 wybiera identyfikator z listy szkiców", async () => {
		const routes: Record<string, unknown> = {
			"drafts?page=1&limit=20": {
				body: { data: [{ identifier: 91, topic: "VGVzdA==", isAnyFileAttached: false }], total: 1 },
			},
			"drafts/newOne": { status: 201, body: {} },
		};
		const { deps } = depsServingM(routes);
		const created = await createDraft(
			JAR,
			{ receivers: [], topic: "Test", content: "Treść", storageId: null },
			deps,
		);
		expect(created.identifier).toBe("91");
	});

	it("PUT update z pustym body 200 nie rzuca (updateDraft → null)", async () => {
		const { deps } = depsServingM({ "drafts/newOne/3": { status: 200, body: {} } });
		const updated = await updateDraft(
			JAR,
			"newOne",
			"3",
			{ receivers: [], topic: "T", content: "C", storageId: null },
			deps,
		);
		expect(updated).toBeNull();
	});

	it("DELETE z pustym body 200 nie rzuca (deleteDraft)", async () => {
		const { deps } = depsServingM({ "drafts/3": { status: 200, body: {} } });
		await expect(deleteDraft(JAR, "3", deps)).resolves.toBeUndefined();
	});

	it("wysyłka 201 z pustym body = sukces bez potwierdzenia (bez błędu — zero pokusy ponowienia)", async () => {
		const { deps } = depsServingM({ "/api/messages": { status: 201, body: null } });
		const sent = await sendMessage(
			JAR,
			{ receivers: [], topic: "T", content: "C", storageId: null },
			deps,
		);
		expect(sent).toEqual({ messageId: "", status: "unknown" });
	});
});

describe("HITL r.2 — ciała zgodne z audytem i diagnostyka", () => {
	it("szkic bez odbiorców jedzie jako receivers {schoolReceivers: []} (kształt z audytu)", async () => {
		const { deps, requests } = depsServingM({
			"drafts/newOne": { status: 201, body: { data: { identifier: 7, receivers: [] } } },
		});
		await createDraft(JAR, { receivers: [], topic: "T", content: "C", storageId: null }, deps);
		const body = JSON.parse(requests[0]?.body as string) as { receivers: unknown };
		expect(body.receivers).toEqual({ schoolReceivers: [] });
	});

	it("nieczytelne echo i pusta lista szkiców → błąd z fragmentem odpowiedzi Librusa", async () => {
		const { deps } = depsServingM({
			"drafts?page=1&limit=20": { body: { data: [], total: 0 } },
			"drafts/newOne": { status: 201, body: null },
		});
		await expect(
			createDraft(JAR, { receivers: [], topic: "T", content: "C", storageId: null }, deps),
		).rejects.toThrow(/Fragment odpowiedzi/);
	});
});

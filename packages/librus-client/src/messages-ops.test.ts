/**
 * Operacje zapisu M (Faza 10 / issue #11): sekwencja załączników
 * (files-storage → upload multipart → delete), CRUD podpisów/etykiet/grup
 * (404 podpisów = pusta lista) oraz kosz (przenieś → przywróć → usuń trwale).
 */
import { describe, expect, it, vi } from "vitest";
import { CookieJar } from "./cookie-jar";
import type { HttpDeps } from "./http";
import {
	createAttachmentStorage,
	createReceiverGroup,
	createSignature,
	createTag,
	deleteMessagePermanently,
	deleteReceiverGroup,
	deleteSignature,
	deleteStoredAttachment,
	deleteTag,
	moveMessageToTrash,
	readSignatures,
	readTrashMessages,
	restoreMessageFromTrash,
	updateReceiverGroup,
	updateSignature,
	updateTag,
	uploadAttachment,
} from "./messages-ops";

interface Recorded {
	url: string;
	method: string;
	body: string | FormData | undefined;
}

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

const JAR = CookieJar.empty();

describe("załączniki: storage → upload multipart → delete", () => {
	it("tworzy magazyn i czyta data.storageId", async () => {
		const { deps, requests } = depsServingM({
			"files-storage/attachments": { status: 201, body: { data: { storageId: "st-1" } } },
		});
		const storage = await createAttachmentStorage(JAR, deps);
		expect(storage.storageId).toBe("st-1");
		expect(requests[0]?.method).toBe("POST");
		expect(String(requests[0]?.body)).toBe("{}"); // pusty JSON — body-less POST dostał 403 (HITL r.2)
	});

	it("upload wysyła multipart storageId/fileToStore/temporaryFileId i czyta fileId", async () => {
		const { deps, requests } = depsServingM({
			"/api/attachments": { status: 201, body: { data: { fileId: 5 } } },
		});
		const stored = await uploadAttachment(
			JAR,
			{ name: "plan.pdf", contentType: "application/pdf", bytes: new Uint8Array([1, 2, 3]).buffer },
			"st-1",
			"tmp-42",
			deps,
		);
		expect(stored).toEqual({ fileId: "5", name: "plan.pdf" });
		const form = requests[0]?.body as FormData;
		expect(requests[0]?.method).toBe("POST");
		expect(form.get("storageId")).toBe("st-1");
		expect(form.get("temporaryFileId")).toBe("tmp-42");
		const file = form.get("fileToStore");
		expect(file).toBeInstanceOf(File);
		expect((file as File).name).toBe("plan.pdf");
	});

	it("usuwa plik z magazynu (DELETE bez body)", async () => {
		const { deps, requests } = depsServingM({ "/api/attachments/5/storage/st-1": { body: {} } });
		await deleteStoredAttachment(JAR, "5", "st-1", deps);
		expect(requests[0]?.method).toBe("DELETE");
		expect(requests[0]?.url).toContain("/api/attachments/5/storage/st-1");
		expect(requests[0]?.body).toBeUndefined();
	});

	it("pełna sekwencja: storage → upload → delete przechodzi na mockach", async () => {
		const { deps, requests } = depsServingM({
			"files-storage/attachments": { status: 201, body: { data: { storageId: "st-9" } } },
			"/api/attachments": { status: 201, body: { data: { fileId: 7 } } },
		});
		const storage = await createAttachmentStorage(JAR, deps);
		const stored = await uploadAttachment(
			JAR,
			{ name: "a.txt", contentType: "text/plain", bytes: new ArrayBuffer(2) },
			storage.storageId,
			"tmp-1",
			deps,
		);
		await deleteStoredAttachment(JAR, stored.fileId ?? "", storage.storageId, deps);
		expect(requests).toHaveLength(3);
		expect(requests[2]?.url).toContain("/api/attachments/7/storage/st-9");
	});
});

describe("podpisy: lista (404 = pusta), create, modify, delete", () => {
	it("404 listy podpisów zwraca pustą listę (nie błąd)", async () => {
		const { deps } = depsServingM({});
		const list = await readSignatures(JAR, deps);
		expect(list).toEqual([]);
	});

	it("200 z listą normalizuje elementy", async () => {
		const { deps } = depsServingM({
			signatures: {
				body: { data: [{ id: 3, name: "Domowy", content: "Adam K.", defaultForNewThreads: true }] },
			},
		});
		const list = await readSignatures(JAR, deps);
		expect(list).toEqual([
			{
				id: "3",
				name: "Domowy",
				content: "Adam K.",
				defaultForNewThreads: true,
				defaultForReplies: null,
			},
		]);
	});

	it("create wysyła pola formularza i normalizuje echo", async () => {
		const { deps, requests } = depsServingM({
			"signatures/create": {
				status: 201,
				body: { data: { id: 8, name: "Domowy", content: "A." } },
			},
		});
		const created = await createSignature(
			JAR,
			{ name: "Domowy", content: "A.", defaultForNewThreads: true, defaultForReplies: false },
			deps,
		);
		expect(created?.id).toBe("8");
		const body = JSON.parse(requests[0]?.body as string) as Record<string, unknown>;
		expect(body).toEqual({
			name: "Domowy",
			content: "A.",
			defaultForNewThreads: true,
			defaultForReplies: false,
		});
	});

	it("modify PUT-uje te same pola pod /signatures/modify/{id}", async () => {
		const { deps, requests } = depsServingM({
			"signatures/modify/8": { body: { data: { id: 8, name: "Dom", content: "B." } } },
		});
		await updateSignature(
			JAR,
			"8",
			{ name: "Dom", content: "B.", defaultForNewThreads: false, defaultForReplies: true },
			deps,
		);
		expect(requests[0]?.method).toBe("PUT");
		expect(requests[0]?.url).toContain("/api/signatures/modify/8");
	});

	it("delete idzie pod /signatures/delete/{id} bez body", async () => {
		const { deps, requests } = depsServingM({ "signatures/delete/8": { body: {} } });
		await deleteSignature(JAR, "8", deps);
		expect(requests[0]?.method).toBe("DELETE");
		expect(requests[0]?.body).toBeUndefined();
	});
});

describe("etykiety i grupy odbiorców: CRUD na mockach", () => {
	it("create/update/delete etykiety", async () => {
		const { deps, requests } = depsServingM({
			"/api/tags": { status: 201, body: { data: { id: 4, name: "Ważne" } } },
			"/api/tags/4": { body: { data: { id: 4, name: "Bardzo ważne" } } },
		});
		const created = await createTag(JAR, { name: "Ważne", colorRgb: "#4285f4" }, deps);
		expect(created).toEqual({ id: "4", name: "Ważne" });
		await updateTag(JAR, "4", { name: "Bardzo ważne", colorRgb: "#4285f4" }, deps);
		expect(requests[1]?.method).toBe("PUT");
		// Pierwszy kandydat trasy modyfikacji to tags/modify/{id}.
		expect(requests[1]?.url).toContain("/api/tags/modify/4");
		await deleteTag(JAR, "4", deps);
		expect(requests[2]?.method).toBe("DELETE");
		expect(requests[2]?.body).toBeUndefined();
	});

	it("create/update/delete grupy odbiorców ({name})", async () => {
		const { deps, requests } = depsServingM({
			"receivers/custom-groups": { status: 201, body: { group: { id: 2, name: "Nauczyciele" } } },
			"receivers/custom-groups/2": { body: { group: { id: 2, name: "Wychowawcy" } } },
		});
		const created = await createReceiverGroup(JAR, "Nauczyciele", deps);
		expect(created).toEqual({ id: "2", name: "Nauczyciele" });
		await updateReceiverGroup(JAR, "2", "Wychowawcy", deps);
		const updateRequest = requests[1];
		expect(updateRequest?.method).toBe("PUT");
		const putBody = JSON.parse(updateRequest?.body as string) as Record<string, unknown>;
		expect(putBody).toEqual({ name: "Wychowawcy" });
		await deleteReceiverGroup(JAR, "2", deps);
		expect(requests[2]?.method).toBe("DELETE");
	});
});

describe("kosz: przenieś → przywróć → usuń trwale", () => {
	it("DELETE /messages/{id} przenosi do kosza (bez body)", async () => {
		const { deps, requests } = depsServingM({ "/api/messages/100": { body: {} } });
		await moveMessageToTrash(JAR, "100", deps);
		expect(requests[0]?.method).toBe("DELETE");
		expect(requests[0]?.url).toContain("/api/messages/100");
		expect(requests[0]?.body).toBeUndefined();
	});

	it("restore PUT-uje {} pod /trash-bin/messages/{id}/restore", async () => {
		const { deps, requests } = depsServingM({ "trash-bin/messages/100/restore": { body: {} } });
		await restoreMessageFromTrash(JAR, "100", deps);
		expect(requests[0]?.method).toBe("PUT");
		expect(requests[0]?.url).toContain("/api/trash-bin/messages/100/restore");
		expect(requests[0]?.body).toBe("{}");
	});

	it("trwałe usunięcie idzie pod /messages/{id}/permanent (bez body)", async () => {
		const { deps, requests } = depsServingM({ "/api/messages/100/permanent": { body: {} } });
		await deleteMessagePermanently(JAR, "100", deps);
		const permanentRequest = requests[0];
		expect(permanentRequest?.method).toBe("DELETE");
		expect(permanentRequest?.url).toContain("/api/messages/100/permanent");
		expect(permanentRequest?.body).toBeUndefined();
	});

	it("lista kosza normalizuje się jak inbox/outbox", async () => {
		const { deps } = depsServingM({
			"trash-bin/messages?": {
				body: {
					data: [{ messageId: "55", topic: "Stara", content: "", isAnyFileAttached: false }],
					total: 1,
				},
			},
		});
		const page = await readTrashMessages(JAR, 1, 20, deps);
		expect(page.total).toBe(1);
		expect(page.messages[0]?.messageId).toBe("55");
	});
});

describe("HITL r.2 — załączniki: ciała i komunikaty", () => {
	it("magazyn plików jedzie jako POST z pustym JSON-em {}", async () => {
		const { deps, requests } = depsServingM({
			"files-storage/attachments": { status: 201, body: { data: { storageId: "st-2" } } },
		});
		const storage = await createAttachmentStorage(JAR, deps);
		expect(storage.storageId).toBe("st-2");
		expect(String(requests[0]?.body)).toBe("{}");
	});

	it("403 na magazynie → komunikat wskazuje brak uprawnień konta do załączników", async () => {
		const { deps } = depsServingM({ "files-storage/attachments": { status: 403, body: {} } });
		await expect(createAttachmentStorage(JAR, deps)).rejects.toThrow(/uprawnień/);
	});
});

describe("HITL r.3 — kandydaci tras zapisu", () => {
	it("createTag próbuje najpierw tags/create (pierwszy kandydat)", async () => {
		const { deps, requests } = depsServingM({
			"/api/tags": { status: 201, body: { data: { id: 8, name: "X" } } },
		});
		await createTag(JAR, { name: "X", colorRgb: "#4285f4" }, deps);
		expect(requests[0]?.url).toContain("/api/tags/create");
	});

	it("createAttachmentStorage spada na attachments/storage, gdy files-storage odpowiada 404", async () => {
		const { deps, requests } = depsServingM({
			"/api/attachments/storage": { status: 201, body: { data: { storageId: "st-9" } } },
		});
		const storage = await createAttachmentStorage(JAR, deps);
		expect(storage.storageId).toBe("st-9");
		expect(requests[0]?.url).toContain("/api/files-storage/attachments");
		expect(requests[1]?.url).toContain("/api/attachments/storage");
	});
});

describe("HITL r.4 — ground truth z testera", () => {
	it("createTag wysyła colorRgb (Librus: 422 MISSING_COLOR_RGB bez niego)", async () => {
		const { deps, requests } = depsServingM({
			"/api/tags": { status: 201, body: { data: { id: 3, name: "X" } } },
		});
		await createTag(JAR, { name: "X", colorRgb: "#4285f4" }, deps);
		const body = JSON.parse(requests[0]?.body as string) as Record<string, unknown>;
		// Ground truth r.15: {name, colorRGB: "4285F4"} — hex bez "#", wielkie.
		expect(body.name).toBe("X");
		expect(body.colorRGB).toBe("4285F4");
	});

	it("422 z polskim komunikatem Librusa idzie wprost do komunikatu błędu", async () => {
		const { deps } = depsServingM({
			"receivers/custom-groups/create": { status: 404, body: {} },
			"receivers/custom-groups": {
				status: 422,
				body: {
					code: "ERROR_FROM_ACTION",
					metadata: { message: "Istnieje już grupa o podanej nazwie." },
					errors: [],
				},
			},
		});
		await expect(createReceiverGroup(JAR, "X", deps)).rejects.toThrow(/Istnieje już grupa/);
	});
});

describe("HITL r.5 — warianty formatu koloru etykiety", () => {
	it("createTag przy 422 na pierwszym formacie spada na kolejny i tworzy etykietę", async () => {
		const bodies: string[] = [];
		const deps: HttpDeps = {
			fetch: vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
				const body = String(init?.body ?? "");
				bodies.push(body);
				if (body.includes('"colorRGB":"4285F4"')) {
					return Response.json({ code: "INVALID_REQUEST" }, { status: 422 });
				}
				return Response.json({ data: { id: 5 } }, { status: 201 });
			}),
			now: () => 0,
			randomPart: () => "",
		};
		const created = await createTag(JAR, { name: "X", colorRgb: "#4285f4" }, deps);
		expect(created.id).toBe("5");
		expect(bodies).toHaveLength(2); // colorRGB wielkie odrzucone, małe przeszły
		expect(bodies[1]).toContain('"colorRGB":"4285f4"');
	});
});

describe("HITL r.13/15 — kolor etykiety: nazwa CSS -> colorRGB hex", () => {
	it("createTag z khaki wysyła colorRGB F0E68C (hex bez #, wielkie) i 1 żądanie", async () => {
		const { deps, requests } = depsServingM({
			"/api/tags": { status: 201, body: { data: { id: 11, name: "X" } } },
		});
		const created = await createTag(JAR, { name: "X", colorRgb: "khaki" }, deps);
		expect(created.id).toBe("11");
		expect(requests).toHaveLength(1);
		const body = JSON.parse(requests[0]?.body as string) as Record<string, unknown>;
		expect(body.colorRGB).toBe("F0E68C");
	});
});

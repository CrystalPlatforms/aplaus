/**
 * M operations beyond drafts: attachment storage, signatures, tags, custom
 * receiver groups and the trash bin (Faza 10 / issue #11).
 *
 * Contract status per the audit ("Pozostałe operacje zapisu"): these paths and
 * bodies come from the official client's code and were NOT executed during the
 * audit, so normalization stays defensive and the HITL checklist verifies them
 * on a real account. Two audited facts anchor the shapes:
 * - POST /files-storage/attachments answers `data.storageId`
 * - the trash restore lives at PUT /trash-bin/messages/{id}/restore with `{}`,
 *   which also fixes the trash list guess at /trash-bin/messages
 */
import type { CookieJar } from "./cookie-jar";
import { messagesWriteRequest, snippetOf } from "./drafts";
import { LibrusError } from "./errors";
import { defaultDeps, type HttpDeps, walkRedirects } from "./http";
import type { MessageListPage } from "./messages";
import { M_USER_AGENT, messagesRequest, normalizeListItem } from "./messages";

/** The storage created for one composer session's attachments. */
export interface AttachmentStorage {
	storageId: string;
}

/** One uploaded attachment as the proxy tracks it for the composer. */
export interface StoredAttachment {
	/** File id for deleteStoredAttachment; null when the echo names none. */
	fileId: string | null;
	name: string;
}

/** One signature (podpis) from /signatures. */
export interface MessageSignature {
	id: string;
	name: string;
	content: string | null;
	defaultForNewThreads: boolean | null;
	defaultForReplies: boolean | null;
}

/** Fields of the signature create/modify form (contract from the client code). */
export interface SignatureWriteInput {
	name: string;
	content: string;
	defaultForNewThreads: boolean;
	defaultForReplies: boolean;
}

/** A tag (etykieta): id + name (fields of the form are not audited). */
export interface TagWriteResult {
	id: string | null;
	name: string | null;
}

/** A custom receiver group: id + name (create/rename take `{name}`). */
export interface ReceiverGroupWriteResult {
	id: string | null;
	name: string | null;
}

function asString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

/**
 * Multipart upload request through the jar — same status mapping as the JSON
 * writer, but the body is FormData and fetch sets the multipart boundary.
 * Exactly one request; never retried in here.
 */
async function messagesMultipartRequest(
	jar: CookieJar,
	path: string,
	form: FormData,
	deps: HttpDeps,
): Promise<unknown> {
	const target = new URL(`https://wiadomosci.librus.pl/api/${path}`);
	const walk = await walkRedirects(
		target.toString(),
		{
			method: "POST",
			headers: { Accept: "application/json", "User-Agent": M_USER_AGENT },
			body: form,
		},
		jar,
		deps,
	);
	const { response } = walk;
	if (response.status === 401) throw new LibrusError("SESSION_EXPIRED", 401);
	if (response.status === 403)
		throw new LibrusError(
			"FORBIDDEN",
			403,
			"Librus odmówił dostępu przy przesyłce pliku (POST " +
				path +
				", 403). Konto może nie mieć uprawnień do załączników w wiadomościach.",
		);
	if (response.status === 404)
		throw new LibrusError("NOT_FOUND", 404, `Librus nie zna tej trasy (POST ${path}, 404).`);
	if (!response.ok)
		throw new LibrusError(
			"UNEXPECTED_RESPONSE",
			502,
			`Librus odpowiedział ${String(response.status)} (POST ${path}).`,
		);
	const contentType = response.headers.get("content-type") ?? "";
	const raw = await response.text();
	if (raw.trim() === "") return null;
	if (!contentType.includes("json")) {
		if (/<\s*(!doctype|html)/i.test(raw)) throw new LibrusError("SESSION_EXPIRED", 401);
		try {
			return JSON.parse(raw) as unknown;
		} catch {
			throw new LibrusError("SESSION_EXPIRED", 401);
		}
	}
	try {
		return JSON.parse(raw) as unknown;
	} catch {
		throw new LibrusError(
			"UNEXPECTED_RESPONSE",
			502,
			`Librus zwrócił nieprawidłowy JSON (POST ${path}). Fragment: ${snippetOf(raw)}`,
		);
	}
}

/**
 * One write through candidate paths: 404/405 on a candidate falls through to
 * the next one (HITL r.3 — the tag/group/storage write routes come from the
 * client code and the real service may use /x/create-style paths).
 */
async function writeViaCandidates(
	jar: CookieJar,
	method: "POST" | "PUT" | "DELETE",
	candidates: string[],
	body: unknown,
	deps: HttpDeps,
): Promise<{ path: string; response: unknown }> {
	for (const path of candidates) {
		try {
			const response = await messagesWriteRequest(jar, method, path, body, deps);
			return { path, response };
		} catch (error) {
			if (error instanceof LibrusError && error.code === "NOT_FOUND") continue;
			throw error;
		}
	}
	throw new LibrusError(
		"NOT_FOUND",
		404,
		`Librus nie zna żadnej z tych tras (${method} ${candidates.join(", ")}). Użyj Testera diagnostycznego w ustawieniach wiadomości i prześlij wynik.`,
	);
}

function storageIdOf(body: unknown): string | null {
	const envelope = body as { data?: unknown };
	const data =
		typeof envelope.data === "object" && envelope.data !== null
			? (envelope.data as Record<string, unknown>)
			: {};
	const raw = data.storageId ?? (body as Record<string, unknown>).storageId;
	return asString(raw) ?? (typeof raw === "number" ? String(raw) : null);
}

/**
 * POST files-storage/attachments (lub warianty) — tworzy magazyn załączników.
 * Audited anchor: the client reads `data.storageId`. HITL r.2 answered 403 on
 * a body-less POST, so every candidate carries an empty JSON body; 403 gets
 * an explicit permissions message.
 */
export async function createAttachmentStorage(
	jar: CookieJar,
	deps: HttpDeps = defaultDeps,
): Promise<AttachmentStorage> {
	const candidates = ["files-storage/attachments", "attachments/storage", "files-storage"];
	let lastBody: unknown = null;
	for (const path of candidates) {
		let body: unknown;
		try {
			body = await messagesWriteRequest(jar, "POST", path, {}, deps);
		} catch (error) {
			if (error instanceof LibrusError && error.code === "NOT_FOUND") continue;
			if (error instanceof LibrusError && error.code === "FORBIDDEN") {
				throw new LibrusError(
					"FORBIDDEN",
					403,
					"Librus nie pozwolił utworzyć magazynu plików (403). To konto może nie mieć uprawnień do załączników w wiadomościach — sprawdź, czy w oryginalnym Librusie da się dodać załącznik do wiadomości.",
				);
			}
			throw error;
		}
		const storageId = storageIdOf(body);
		if (storageId !== null) return { storageId };
		lastBody = body;
	}
	throw new LibrusError(
		"UNEXPECTED_RESPONSE",
		502,
		`Librus nie zwrócił storageId (POST ${candidates.join(", ")}). Fragment ostatniej odpowiedzi: ${snippetOf(lastBody)}`,
	);
}

/**
 * POST /attachments — multipart upload: `storageId`, `fileToStore` (the file),
 * `temporaryFileId` (client-side id). The response shape is unaudited; the
 * file id is read from every plausible key and may come back null.
 */
export async function uploadAttachment(
	jar: CookieJar,
	file: { name: string; contentType: string; bytes: ArrayBuffer },
	storageId: string,
	temporaryFileId: string,
	deps: HttpDeps = defaultDeps,
): Promise<StoredAttachment> {
	const form = new FormData();
	form.append("storageId", storageId);
	form.append("fileToStore", new Blob([file.bytes], { type: file.contentType }), file.name);
	form.append("temporaryFileId", temporaryFileId);
	const body = await messagesMultipartRequest(jar, "attachments", form, deps);
	return { fileId: fileIdOf(body), name: file.name };
}

/** Reads the uploaded file id from whatever key the endpoint used this time. */
function fileIdOf(body: unknown): string | null {
	const candidates: unknown[] = [body];
	const envelope = body as { data?: unknown } | null;
	if (envelope !== null && typeof envelope === "object") candidates.push(envelope.data);
	for (const candidate of candidates) {
		if (typeof candidate !== "object" || candidate === null) continue;
		const c = candidate as Record<string, unknown>;
		for (const key of ["fileId", "FileId", "id", "Id", "identifier", "temporaryFileId"]) {
			const value = c[key];
			if (typeof value === "string" && value !== "") return value;
			if (typeof value === "number") return String(value);
		}
	}
	return null;
}

/** DELETE /attachments/{fileId}/storage/{storageId} — removes one uploaded file. */
export async function deleteStoredAttachment(
	jar: CookieJar,
	fileId: string,
	storageId: string,
	deps: HttpDeps = defaultDeps,
): Promise<void> {
	await messagesWriteRequest(
		jar,
		"DELETE",
		`attachments/${encodeURIComponent(fileId)}/storage/${encodeURIComponent(storageId)}`,
		undefined,
		deps,
	);
}

function idOf(value: unknown): string | null {
	const raw = asString(value);
	if (raw !== null) return raw;
	return typeof value === "number" ? String(value) : null;
}

/**
 * GET /signatures — the audited read: 404 on accounts without signatures
 * means an EMPTY list, and one account answered 200; items are read
 * defensively (the populated shape was never captured).
 */
export async function readSignatures(
	jar: CookieJar,
	deps: HttpDeps = defaultDeps,
): Promise<MessageSignature[]> {
	try {
		const body = await messagesRequest(jar, "signatures", deps);
		return normalizeSignatureList(body);
	} catch (error) {
		if (error instanceof LibrusError && error.code === "NOT_FOUND") return [];
		throw error;
	}
}

function normalizeSignatureList(body: unknown): MessageSignature[] {
	const candidates: unknown[] = [body];
	const envelope = body as { data?: unknown } | null;
	if (envelope !== null && typeof envelope === "object") {
		candidates.push(envelope.data);
		const nested = envelope.data as Record<string, unknown> | null;
		if (nested !== null && typeof nested === "object") candidates.push(nested.signatures);
	}
	for (const candidate of candidates) {
		if (!Array.isArray(candidate)) continue;
		const out: MessageSignature[] = [];
		for (const raw of candidate) {
			if (typeof raw !== "object" || raw === null) continue;
			const s = raw as Record<string, unknown>;
			const id = idOf(s.id ?? s.Id ?? s.signatureId);
			if (id === null) continue;
			out.push({
				id,
				name: asString(s.name) ?? asString(s.Name) ?? "",
				content: asString(s.content) ?? asString(s.Content) ?? null,
				defaultForNewThreads:
					typeof s.defaultForNewThreads === "boolean" ? s.defaultForNewThreads : null,
				defaultForReplies: typeof s.defaultForReplies === "boolean" ? s.defaultForReplies : null,
			});
		}
		if (out.length > 0) return out;
	}
	return [];
}

/** POST /signatures/create — {name, content, defaultForNewThreads, defaultForReplies}. */
export async function createSignature(
	jar: CookieJar,
	input: SignatureWriteInput,
	deps: HttpDeps = defaultDeps,
): Promise<MessageSignature | null> {
	const body = await messagesWriteRequest(jar, "POST", "signatures/create", { ...input }, deps);
	return normalizeSignatureEcho(body);
}

/** PUT /signatures/modify/{id} — the same fields as create. */
export async function updateSignature(
	jar: CookieJar,
	id: string,
	input: SignatureWriteInput,
	deps: HttpDeps = defaultDeps,
): Promise<MessageSignature | null> {
	const body = await messagesWriteRequest(
		jar,
		"PUT",
		`signatures/modify/${encodeURIComponent(id)}`,
		{ ...input },
		deps,
	);
	return normalizeSignatureEcho(body);
}

/** DELETE /signatures/delete/{id} — no body. */
export async function deleteSignature(
	jar: CookieJar,
	id: string,
	deps: HttpDeps = defaultDeps,
): Promise<void> {
	await messagesWriteRequest(
		jar,
		"DELETE",
		`signatures/delete/${encodeURIComponent(id)}`,
		undefined,
		deps,
	);
}

function normalizeSignatureEcho(body: unknown): MessageSignature | null {
	const list = normalizeSignatureList(body);
	const hit = list[0];
	if (hit !== undefined) return hit;
	// Create/modify może echo'ować pojedynczy obiekt zamiast listy.
	const envelope = body as { data?: unknown } | null;
	const candidates: unknown[] = [body, envelope?.data];
	for (const candidate of candidates) {
		if (typeof candidate !== "object" || candidate === null) continue;
		const c = candidate as Record<string, unknown>;
		const id = idOf(c.id ?? c.Id ?? c.signatureId);
		if (id === null) continue;
		return {
			id,
			name: asString(c.name) ?? asString(c.Name) ?? "",
			content: asString(c.content) ?? asString(c.Content) ?? null,
			defaultForNewThreads:
				typeof c.defaultForNewThreads === "boolean" ? c.defaultForNewThreads : null,
			defaultForReplies: typeof c.defaultForReplies === "boolean" ? c.defaultForReplies : null,
		};
	}
	return null;
}

/**
 * Etykiety Librusa mają kolor — tester diagnostyczny (HITL r.3) pokazał 422
 * MISSING_COLOR_RGB na POST /tags bez niego. Domyślny odcień dopóki UI nie
 * pozwala go wybrać; format (#RRGGBB) potwierdza tester.
 */
/** Etykieta do zapisu: nazwa + kolor wybrany w UI (paleta w ustawieniach). */
export interface TagWriteInput {
	name: string;
	/** Kolor z palety UI, np. "#e53935" — format na wire dobiera zapis. */
	colorRgb: string;
}

/**
 * Etykiety Librusa mają kolor — HITL r.4: POST /tags bez `colorRgb` → 422
 * MISSING_COLOR_RGB; r.5: nawet `"#4285f4"` dalej 422 MISSING, czyli format na
 * wire jest inny (bez „#”, liczba 0xRRGGBB albo klucz `colorRGB`). KOLOR wybiera
 * użytkownik w UI — zapis próbuje jedynie różnych KODOWAŃ tego samego koloru;
 * 422 spada na kolejne kodowanie, a gdy żadne nie przejdzie, wraca błąd
 * pierwszej próby (najbardziej wymowny).
 */
function hexRgbParts(hex: string): [number, number, number] | null {
	const hexPart = /^#?([0-9a-fA-F]{6})$/.exec(hex)?.[1];
	if (hexPart === undefined) return null;
	return [
		Number.parseInt(hexPart.slice(0, 2), 16),
		Number.parseInt(hexPart.slice(2, 4), 16),
		Number.parseInt(hexPart.slice(4, 6), 16),
	];
}

function _hexRgbToInt(hex: string): number | null {
	const parts = hexRgbParts(hex);
	return parts !== null ? (parts[0] << 16) | (parts[1] << 8) | parts[2] : null;
}

/**
 * Tester (HITL r.6): string z „#”, bez „#”, liczba i klucz `colorRGB` ALL
 * answer 422 MISSING_COLOR_RGB — Librus żąda innego kształtu pola (najpewniej
 * tablicy [r,g,b], obiektu {r,g,b} albo napisu „rgb(r,g,b)”). Kolor wybiera
 * UI; tutaj dobieramy tylko kodowanie tego samego koloru.
 */
/**
 * HITL r.15 (ground truth z GET /tags po utworzeniu etykiety w oficjalnym
 * Librusie): tag wraca jako {tagId, name, colorRGB: "E6E6FA"} — pole
 * **colorRGB** (wielkie RGB), wartość = hex BEZ „#”, WIELKIMI literami.
 * Oficjalny formularz pokazuje nazwy kolorów CSS — mapujemy je na hex.
 */
const CSS_NAME_TO_HEX: Record<string, string> = {
	khaki: "F0E68C",
	lightskyblue: "87CEFA",
	lightsteelblue: "B0C4DE",
	aliceblue: "F0F8FF",
	azure: "F0FFFF",
	beige: "F5F5DC",
	blanchedalmond: "FFEBCD",
	cornsilk: "FFF8DC",
	darkgray: "A9A9A9",
	darkkhaki: "BDB76B",
	darkseagreen: "8FBC8F",
	gainsboro: "DCDCDC",
	goldenrod: "DAA520",
	lavender: "E6E6FA",
	lightsalmon: "FFA07A",
	limegreen: "32CD32",
	mediumaquamarine: "66CDAA",
	silver: "C0C0C0",
	tan: "D2B48C",
	blue: "0000FF",
	mediumslateblue: "7B68EE",
	mediumorchid: "BA55D3",
	lightpink: "FFB6C1",
	deeppink: "FF1493",
	crimson: "DC143C",
	red: "FF0000",
	darkorange: "FF8C00",
	gold: "FFD700",
	greenyellow: "ADFF2F",
	lawngreen: "7CFC00",
};

/** Nazwa CSS albo hex -> hex BEZ „#”, WIELKIMI literami (format Librusa). */
function colorRgbToStored(value: string): string | null {
	const trimmed = value.trim();
	if (/^#?[0-9a-fA-F]{6}$/.test(trimmed)) {
		return trimmed.replace("#", "").toUpperCase();
	}
	return CSS_NAME_TO_HEX[trimmed.toLowerCase()] ?? null;
}

const HEX_TAG_BODY_VARIANTS: ((tag: TagWriteInput) => Record<string, unknown> | string)[] = [
	// Potwierdzony kontrakt (r.15): colorRGB + hex bez „#” wielkimi literami.
	(t) => {
		const color = colorRgbToStored(t.colorRgb);
		return color === null ? { name: t.name } : { name: t.name, colorRGB: color };
	},
	(t) => {
		const color = colorRgbToStored(t.colorRgb);
		return color === null ? { name: t.name } : { name: t.name, colorRGB: color.toLowerCase() };
	},
	(t) => {
		const color = colorRgbToStored(t.colorRgb);
		return color === null ? { name: t.name } : { name: t.name, colorRgb: color };
	},
	(t) => {
		const color = colorRgbToStored(t.colorRgb);
		return color === null
			? { name: t.name }
			: `name=${encodeURIComponent(t.name)}&colorRGB=${color}`;
	},
	(t) => ({ name: t.name, colorRgb: t.colorRgb }),
];

const tagBodyVariantsOf = (
	_tag: TagWriteInput,
): ((tag: TagWriteInput) => Record<string, unknown> | string)[] => {
	const variants: ((tag: TagWriteInput) => Record<string, unknown> | string)[] = [];
	variants.push(...HEX_TAG_BODY_VARIANTS);
	// Ostateczność: zapis form-urlencoded, jak stary formularz Librusa.
	variants.push(
		(t) => `name=${encodeURIComponent(t.name)}&colorRgb=${encodeURIComponent(t.colorRgb)}`,
	);
	return variants;
};

async function writeTagWithVariants(
	jar: CookieJar,
	method: "POST" | "PUT",
	paths: string[],
	tag: TagWriteInput,
	deps: HttpDeps,
): Promise<unknown> {
	let firstError: LibrusError | null = null;
	for (const path of paths) {
		for (const bodyOf of tagBodyVariantsOf(tag)) {
			try {
				return await messagesWriteRequest(jar, method, path, bodyOf(tag), deps);
			} catch (error) {
				if (error instanceof LibrusError && (error.code === "NOT_FOUND" || error.status === 422)) {
					// 422 jest wymowniejsze niż 404 z pierwszej kandydatki — pokaż je.
					if (firstError === null || (error.status === 422 && firstError.status !== 422)) {
						firstError = error;
					}
					continue;
				}
				throw error;
			}
		}
	}
	throw (
		firstError ??
		new LibrusError("NOT_FOUND", 404, `Librus nie zna tras (${method} ${paths.join(", ")}).`)
	);
}

/** POST /tags/create albo /tags — kodowania koloru dobierane automatycznie. */
export async function createTag(
	jar: CookieJar,
	tag: TagWriteInput,
	deps: HttpDeps = defaultDeps,
): Promise<TagWriteResult> {
	const response = await writeTagWithVariants(jar, "POST", ["tags/create", "tags"], tag, deps);
	return normalizeTagEcho(response, tag.name);
}

/** PUT /tags/modify/{id} albo /tags/{id} — te same kodowania koloru co create. */
export async function updateTag(
	jar: CookieJar,
	id: string,
	tag: TagWriteInput,
	deps: HttpDeps = defaultDeps,
): Promise<TagWriteResult> {
	const encoded = encodeURIComponent(id);
	const response = await writeTagWithVariants(
		jar,
		"PUT",
		[`tags/modify/${encoded}`, `tags/${encoded}`],
		tag,
		deps,
	);
	return normalizeTagEcho(response, tag.name);
}

/** DELETE /tags/delete/{id} albo /tags/{id} — bez body. */
export async function deleteTag(
	jar: CookieJar,
	id: string,
	deps: HttpDeps = defaultDeps,
): Promise<void> {
	const encoded = encodeURIComponent(id);
	await writeViaCandidates(
		jar,
		"DELETE",
		[`tags/delete/${encoded}`, `tags/${encoded}`],
		undefined,
		deps,
	);
}

function normalizeTagEcho(body: unknown, fallbackName: string): TagWriteResult {
	const envelope = body as { data?: unknown } | null;
	const candidates: unknown[] = [body, envelope?.data];
	for (const candidate of candidates) {
		if (typeof candidate !== "object" || candidate === null) continue;
		const c = candidate as Record<string, unknown>;
		const id = idOf(c.id ?? c.Id ?? c.tagId);
		if (id !== null) return { id, name: asString(c.name) ?? fallbackName };
	}
	return { id: null, name: fallbackName };
}

/** POST /receivers/custom-groups/create albo /receivers/custom-groups — `{name}`. */
export async function createReceiverGroup(
	jar: CookieJar,
	name: string,
	deps: HttpDeps = defaultDeps,
): Promise<ReceiverGroupWriteResult> {
	const { response } = await writeViaCandidates(
		jar,
		"POST",
		["receivers/custom-groups/create", "receivers/custom-groups"],
		{ name },
		deps,
	);
	return normalizeGroupEcho(response, name);
}

/** PUT /receivers/custom-groups/{id} — rename: `{ "name": "..." }`. */
export async function updateReceiverGroup(
	jar: CookieJar,
	id: string,
	name: string,
	deps: HttpDeps = defaultDeps,
): Promise<ReceiverGroupWriteResult> {
	const encoded = encodeURIComponent(id);
	const { response } = await writeViaCandidates(
		jar,
		"PUT",
		[`receivers/custom-groups/modify/${encoded}`, `receivers/custom-groups/${encoded}`],
		{ name },
		deps,
	);
	return normalizeGroupEcho(response, name);
}

/** DELETE /receivers/custom-groups/{id} — no body. */
export async function deleteReceiverGroup(
	jar: CookieJar,
	id: string,
	deps: HttpDeps = defaultDeps,
): Promise<void> {
	const encoded = encodeURIComponent(id);
	await writeViaCandidates(
		jar,
		"DELETE",
		[`receivers/custom-groups/delete/${encoded}`, `receivers/custom-groups/${encoded}`],
		undefined,
		deps,
	);
}

function normalizeGroupEcho(body: unknown, fallbackName: string): ReceiverGroupWriteResult {
	const candidates: unknown[] = [body];
	const envelope = body as { data?: unknown } | null;
	if (envelope !== null && typeof envelope === "object") candidates.push(envelope.data);
	const root = body as { group?: unknown } | null;
	if (root !== null && typeof root === "object") candidates.push(root.group);
	for (const candidate of candidates) {
		if (typeof candidate !== "object" || candidate === null) continue;
		const c = candidate as Record<string, unknown>;
		const id = idOf(c.id ?? c.Id ?? c.groupId);
		if (id !== null) return { id, name: asString(c.name) ?? fallbackName };
	}
	return { id: null, name: fallbackName };
}

/**
 * GET /trash-bin/messages?page=&limit= — the trash list. The path is derived
 * from the audited restore route (/trash-bin/messages/{id}/restore); the
 * response is normalized exactly like inbox/outbox.
 */
export async function readTrashMessages(
	jar: CookieJar,
	page: number,
	limit: number,
	deps: HttpDeps = defaultDeps,
): Promise<MessageListPage> {
	const path = `trash-bin/messages?page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}`;
	const body = await messagesRequest(jar, path, deps);
	const envelope = body as { data?: unknown; total?: unknown };
	const list = Array.isArray(envelope.data) ? envelope.data : [];
	return {
		messages: list
			.map((raw) => normalizeListItem(raw))
			.filter((m): m is NonNullable<ReturnType<typeof normalizeListItem>> => m !== null),
		total: typeof envelope.total === "number" ? envelope.total : list.length,
	};
}

/** DELETE /messages/{id} — moves the message to the trash bin (no body). */
export async function moveMessageToTrash(
	jar: CookieJar,
	id: string,
	deps: HttpDeps = defaultDeps,
): Promise<void> {
	await messagesWriteRequest(jar, "DELETE", `messages/${encodeURIComponent(id)}`, undefined, deps);
}

/** PUT /trash-bin/messages/{id}/restore — audited client contract: `{}`. */
export async function restoreMessageFromTrash(
	jar: CookieJar,
	id: string,
	deps: HttpDeps = defaultDeps,
): Promise<void> {
	await messagesWriteRequest(
		jar,
		"PUT",
		`trash-bin/messages/${encodeURIComponent(id)}/restore`,
		{},
		deps,
	);
}

/** DELETE /messages/{id}/permanent — IRREVERSIBLE; the UI confirms first. */
export async function deleteMessagePermanently(
	jar: CookieJar,
	id: string,
	deps: HttpDeps = defaultDeps,
): Promise<void> {
	await messagesWriteRequest(
		jar,
		"DELETE",
		`messages/${encodeURIComponent(id)}/permanent`,
		undefined,
		deps,
	);
}

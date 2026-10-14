/**
 * M write side: drafts (`/drafts/newOne`) and sending (`POST /messages`).
 *
 * Contracts per the audit ("Potwierdzony zakres zapisu" — verified live on all
 * four pairs for the draft lifecycle; the send contract comes from the official
 * client's code and is expected to be corrected after the first HITL send):
 * - `topic` and `content` travel as Base64 of UTF-8 bytes (encoding, not crypto)
 * - content is HTML; plain-text input is HTML-escaped here so typed `<`, `&`
 *   etc. survive Librus's HTML rendering
 * - receivers group under their type id: `{"receivers": {"schoolReceivers":
 *   [{"accountId": "..."}]}}`
 * - `storageId: null` when no attachment storage was prepared
 * - the request says `content`, the read-side response says `body`
 *
 * Sending performs EXACTLY ONE request — there is no retry here, because a
 * failed or ambiguous send must never be replayed blindly (double delivery).
 * Session re-establishment on 401 is the caller's (safe: 401 means the message
 * was never delivered).
 */
import type { CookieJar } from "./cookie-jar";
import { LibrusError } from "./errors";
import { defaultDeps, type HttpDeps, walkRedirects } from "./http";
import {
	decodeMaybeBase64,
	idAsString,
	M_USER_AGENT,
	messagesRequest,
	unwrapContentEnvelope,
} from "./messages";

/** One recipient: grouped under `typeId` in the receivers body. */
export interface MessageReceiver {
	/** Receiver type id from /receivers/types (e.g. "schoolReceivers"). */
	typeId: string;
	/** The M accountId of the recipient (never an id of another resource). */
	accountId: string;
}

/** What the composer submits for a draft or a send (plain text in, encoded out). */
export interface DraftWriteInput {
	receivers: MessageReceiver[];
	topic: string;
	/** Plain text; HTML-escaped and Base64-encoded for the wire. */
	content: string;
	/** Attachment storage id, or null when the message carries no files. */
	storageId: string | null;
}

/** One sendable message with optional reply/forward context. */
export interface MessageSendInput extends DraftWriteInput {
	/** "normal" unless the caller says otherwise. */
	category?: string;
	/** String per the contract — a number is never accepted here. */
	repliedToMessageId?: string | null;
	forwardedMessageId?: string | null;
}

/** The send confirmation (contract from the official client: 201 + these fields). */
export interface SentMessage {
	messageId: string;
	status: string;
}

/** A draft as stored by Librus, decoded back to plain text. */
export interface DraftRecord {
	identifier: string;
	topic: string;
	body: string;
	receivers: MessageReceiver[];
	storageId: string | null;
	hasAttachments: boolean;
	/** "reply"/"forward"/other — the update path keys off this variant. */
	type: string | null;
	dateAdded: string | null;
	/** Set on reply drafts (the message being answered). */
	parentMessageIdentifier: string | null;
}

/** One row of the drafts list. */
export interface DraftSummary {
	identifier: string;
	topic: string;
	hasAttachments: boolean;
	type: string | null;
	dateAdded: string | null;
	parentMessageIdentifier: string | null;
}

export interface DraftListPage {
	drafts: DraftSummary[];
	total: number;
}

/** Which write path a draft uses; the audit names all three update routes. */
export type DraftVariant = "newOne" | "reply" | "forward";

function encodeBase64Utf8(text: string): string {
	const bytes = new TextEncoder().encode(text);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

/**
 * Inverse of escapeHtml for reading drafts back into the composer: Librus
 * stores HTML, so entities must come off before the text lands in a textarea.
 */
function unescapeHtml(text: string): string {
	return text
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&");
}

/**
 * One write request through the jar. Status mapping mirrors the readers:
 * 401 → SESSION_EXPIRED, 403 → FORBIDDEN, 404 → NOT_FOUND. HITL round 1
 * showed several write routes answer 200/201 with an EMPTY body (and the
 * operation still lands) — an empty response is therefore SUCCESS with no
 * payload (null), not an error. HTML means a dead session behind a redirect;
 * JSON content-type that fails to parse is truly unexpected.
 * Exactly one request per call — never retried in here.
 * `body === undefined` sends no body at all (the audited DELETE contracts are
 * body-less); anything else goes out as JSON.
 */
export async function messagesWriteRequest(
	jar: CookieJar,
	method: "POST" | "PUT" | "DELETE",
	path: string,
	body: unknown,
	deps: HttpDeps,
): Promise<unknown> {
	const headers: Record<string, string> = {
		Accept: "application/json",
		"User-Agent": M_USER_AGENT,
	};
	// Stare formularze Librusa mowia form-urlencoded — string w body jedzie
	// tak; obiekt jako JSON (dotychczasowy kontrakt zapisow M).
	const isForm = typeof body === "string";
	if (body !== undefined) {
		headers["Content-Type"] = isForm ? "application/x-www-form-urlencoded" : "application/json";
	}
	const target = new URL(`https://wiadomosci.librus.pl/api/${path}`);
	const walk = await walkRedirects(
		target.toString(),
		{
			method,
			headers,
			body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
		},
		jar,
		deps,
	);
	const { response } = walk;
	if (response.status === 401) throw new LibrusError("SESSION_EXPIRED", 401);
	if (response.status === 403) throw new LibrusError("FORBIDDEN", 403);
	if (response.status === 404 || response.status === 405) {
		throw new LibrusError("NOT_FOUND", response.status);
	}
	if (!response.ok) {
		// 422/4xx z akcji Librusa niosą polski komunikat w metadata.message
		// (np. „Istnieje już grupa o podanej nazwie.”) — pokazujemy go wprost,
		// a gdy go nie ma, fragment surowej odpowiedzi.
		const raw = await response.text().catch(() => "");
		const detail = librusActionMessageOf(raw) || `Fragment: ${snippetOf(raw)}`;
		throw new LibrusError(
			"UNEXPECTED_RESPONSE",
			response.status,
			`Librus odpowiedział ${response.status} (${method} ${path}). ${detail}`,
		);
	}
	const contentType = response.headers.get("content-type") ?? "";
	const raw = await response.text();
	if (raw.trim() === "") return null;
	if (!contentType.includes("json")) {
		// HTML after redirects = the login page — the session is dead.
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
			`Librus zwrócił nieprawidłowy JSON (${method} ${path}).`,
		);
	}
}

function asString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

/**
 * `{"schoolReceivers": [{"accountId": "..."}]}` — grouped by type id.
 * HITL r.2: pusta lista odbiorców MUSI iść jako `{"schoolReceivers": []}`
 * (kształt zweryfikowany audytem) — pusty obiekt `{}` był jedyną różnicą
 * między ciałem audytu a ciałem, które Librus odrzucił w HITL.
 */
function receiversBodyOf(receivers: MessageReceiver[]): Record<string, { accountId: string }[]> {
	if (receivers.length === 0) return { schoolReceivers: [] };
	const grouped: Record<string, { accountId: string }[]> = {};
	for (const receiver of receivers) {
		const bucket = grouped[receiver.typeId];
		if (bucket === undefined) grouped[receiver.typeId] = [{ accountId: receiver.accountId }];
		else bucket.push({ accountId: receiver.accountId });
	}
	return grouped;
}

/** The draft body: receivers grouped, topic/content Base64, storageId verbatim. */
function draftBodyOf(input: DraftWriteInput): Record<string, unknown> {
	return {
		receivers: receiversBodyOf(input.receivers),
		topic: encodeBase64Utf8(input.topic),
		content: encodeBase64Utf8(escapeHtml(input.content)),
		storageId: input.storageId,
	};
}

function entryAccountIdOf(entry: unknown): string | null {
	if (typeof entry !== "object" || entry === null) return null;
	const e = entry as Record<string, unknown>;
	for (const key of ["accountId", "AccountId", "receiverId"]) {
		const id = idAsString(e[key]);
		if (id !== null) return id;
	}
	return null;
}

/** Reads echoed receivers back, tolerating the object-of-arrays and flat shapes. */
function receiversOf(value: unknown): MessageReceiver[] {
	const out: MessageReceiver[] = [];
	if (typeof value === "object" && value !== null && !Array.isArray(value)) {
		for (const [typeId, entries] of Object.entries(value as Record<string, unknown>)) {
			if (!Array.isArray(entries)) continue;
			for (const entry of entries) {
				const accountId = entryAccountIdOf(entry);
				if (accountId !== null) out.push({ typeId, accountId });
			}
		}
		return out;
	}
	if (Array.isArray(value)) {
		for (const entry of value) {
			if (typeof entry !== "object" || entry === null) continue;
			const e = entry as Record<string, unknown>;
			const accountId = entryAccountIdOf(entry);
			if (accountId === null) continue;
			const typeId = idAsString(e.typeId) ?? idAsString(e.type) ?? "schoolReceivers";
			out.push({ typeId, accountId });
		}
	}
	return out;
}

function dateAddedOf(value: unknown): string | null {
	if (typeof value === "string") return value;
	if (typeof value === "object" && value !== null) {
		const date = (value as Record<string, unknown>).date;
		return typeof date === "string" ? date : null;
	}
	return null;
}

/**
 * Normalizes a draft payload. The body field is `body` on the read side
 * (audited asymmetry against the request's `content`); it decodes, unwraps the
 * XML envelope the official client wraps content in, and unescapes entities so
 * the composer textarea shows the original text.
 */
function normalizeDraft(raw: unknown): DraftRecord | null {
	if (typeof raw !== "object" || raw === null) return null;
	const d = raw as Record<string, unknown>;
	const identifier = idAsString(d.identifier) ?? idAsString(d.Identifier);
	if (identifier === null) return null;
	const rawBody = asString(d.body) ?? asString(d.content) ?? "";
	const storageRaw = d.storageId;
	return {
		identifier,
		topic: unescapeHtml(decodeMaybeBase64(asString(d.topic) ?? "")),
		body: unescapeHtml(unwrapContentEnvelope(decodeMaybeBase64(rawBody))),
		receivers: receiversOf(d.receivers),
		storageId: idAsString(storageRaw),
		hasAttachments: d.isAnyFileAttached === true,
		type: asString(d.type),
		dateAdded: dateAddedOf(d.dateAdded),
		parentMessageIdentifier: idAsString(d.parentMessageIdentifier),
	};
}

function draftFromEnvelope(body: unknown): DraftRecord {
	if (body === null || typeof body !== "object") throw new LibrusError("UNEXPECTED_RESPONSE", 502);
	const envelope = body as { data?: unknown };
	const draft =
		typeof envelope.data === "object" && envelope.data !== null
			? normalizeDraft(envelope.data)
			: null;
	if (draft === null) throw new LibrusError("UNEXPECTED_RESPONSE", 502);
	return draft;
}

/** Polski komunikat akcji Librusa (metadata.message / message) z ciała 4xx/5xx. */
function librusActionMessageOf(raw: string): string {
	try {
		const parsed = JSON.parse(raw) as {
			metadata?: { message?: unknown };
			message?: unknown;
		};
		const message = parsed.metadata?.message ?? parsed.message;
		return typeof message === "string" && message !== "" ? `Librus: ${message}` : "";
	} catch {
		return "";
	}
}

/**
 * Fragment odpowiedzi w komunikacie błędu — HITL r.2 pokazało, że zgadywanie
 * kształtu echa na ślepo nie działa; fragment (do 200 znaków) pozwala zobaczyć
 * w UI, co Librus faktycznie zwrócił przy odrzuconym zapisie.
 */
export function snippetOf(body: unknown): string {
	try {
		const text = JSON.stringify(body) ?? String(body);
		return text.length > 200 ? `${text.slice(0, 200)}…` : text;
	} catch {
		return "(nieczytelna odpowiedź)";
	}
}

function draftVariantPath(variant: DraftVariant): string {
	return variant === "newOne" ? "drafts/newOne" : `drafts/${variant}`;
}

/** POST /drafts/newOne — audited: 201 with the created draft. */
export async function createDraft(
	jar: CookieJar,
	input: DraftWriteInput,
	deps: HttpDeps = defaultDeps,
): Promise<DraftRecord> {
	const body = await messagesWriteRequest(jar, "POST", "drafts/newOne", draftBodyOf(input), deps);
	try {
		return draftFromEnvelope(body);
	} catch (error) {
		// HITL r.1: echo tworzenia bywa puste/obce, choć szkic powstaje —
		// identyfikator z listy szkiców: limit 20 (żeby nowy szkic był
		// w oknie) i preferencja dla pozycji o zgodnym temacie.
		if (error instanceof LibrusError && error.code === "UNEXPECTED_RESPONSE") {
			const page = await listDrafts(jar, 1, 20, deps);
			const topicMatch = page.drafts.find((d) => d.topic === input.topic && input.topic !== "");
			const first = topicMatch ?? page.drafts[0];
			if (first !== undefined) {
				return {
					identifier: first.identifier,
					topic: input.topic,
					body: input.content,
					receivers: input.receivers,
					storageId: input.storageId,
					hasAttachments: first.hasAttachments,
					type: first.type,
					dateAdded: first.dateAdded,
					parentMessageIdentifier: first.parentMessageIdentifier,
				};
			}
			// Nic z listy? Wtedy prawdziwa odpowiedź Librusa w komunikacie —
			// następna runda HITL pokaże dokładnie, co serwer zwrócił.
			throw new LibrusError(
				"UNEXPECTED_RESPONSE",
				502,
				`Librus nie zwrócił utworzonego szkica (POST drafts/newOne). Fragment odpowiedzi: ${snippetOf(body)}`,
			);
		}
		throw error;
	}
}

/**
 * POST /drafts/reply or /drafts/forward — the context id travels as a STRING
 * (`repliedToMessageId`/`forwardedMessageId`), per the contract from the
 * official client's code; untested on live accounts (HITL verifies).
 */
export async function createContextDraft(
	jar: CookieJar,
	variant: "reply" | "forward",
	contextId: string,
	input: DraftWriteInput,
	deps: HttpDeps = defaultDeps,
): Promise<DraftRecord> {
	const key = variant === "reply" ? "repliedToMessageId" : "forwardedMessageId";
	const body: Record<string, unknown> = {
		...draftBodyOf(input),
		[key]: contextId,
	};
	const response = await messagesWriteRequest(jar, "POST", `drafts/${variant}`, body, deps);
	try {
		return draftFromEnvelope(response);
	} catch (error) {
		// To samo, co przy newOne: echo bywa nieczytelne — identyfikator
		// z listy szkiców (preferencja: drafty typu reply/forward).
		if (error instanceof LibrusError && error.code === "UNEXPECTED_RESPONSE") {
			const page = await listDrafts(jar, 1, 20, deps);
			const first = page.drafts.find((d) => d.type === variant) ?? page.drafts[0];
			if (first !== undefined) {
				return {
					identifier: first.identifier,
					topic: input.topic,
					body: input.content,
					receivers: input.receivers,
					storageId: input.storageId,
					hasAttachments: first.hasAttachments,
					type: first.type,
					dateAdded: first.dateAdded,
					parentMessageIdentifier: first.parentMessageIdentifier,
				};
			}
			throw new LibrusError(
				"UNEXPECTED_RESPONSE",
				502,
				`Librus nie zwrócił utworzonego szkica (POST drafts/${variant}). Fragment odpowiedzi: ${snippetOf(response)}`,
			);
		}
		throw error;
	}
}

/** GET /drafts/{id} — null when the draft is gone (404). */
export async function readDraft(
	jar: CookieJar,
	id: string,
	deps: HttpDeps = defaultDeps,
): Promise<DraftRecord | null> {
	try {
		const body = await messagesRequest(jar, `drafts/${encodeURIComponent(id)}`, deps);
		return draftFromEnvelope(body);
	} catch (error) {
		if (error instanceof LibrusError && error.code === "NOT_FOUND") return null;
		throw error;
	}
}

/**
 * PUT /drafts/{variant}/{id} — the audit verified the newOne route; reply and
 * forward take their own paths per the client code. Returns the echo when it
 * reads as a draft, null when Librus answers something else 200-ish.
 */
export async function updateDraft(
	jar: CookieJar,
	variant: DraftVariant,
	id: string,
	input: DraftWriteInput,
	deps: HttpDeps = defaultDeps,
): Promise<DraftRecord | null> {
	const body = await messagesWriteRequest(
		jar,
		"PUT",
		`${draftVariantPath(variant)}/${encodeURIComponent(id)}`,
		draftBodyOf(input),
		deps,
	);
	// Puste echo 200/201 = sukces bez potwierdzenia (HITL r.1).
	if (body === null) return null;
	const envelope = body as { data?: unknown };
	if (typeof envelope.data !== "object" || envelope.data === null) return null;
	return normalizeDraft(envelope.data);
}

/** DELETE /drafts/{id} — audited: 200, no body, afterwards GET answers 404. */
export async function deleteDraft(
	jar: CookieJar,
	id: string,
	deps: HttpDeps = defaultDeps,
): Promise<void> {
	await messagesWriteRequest(jar, "DELETE", `drafts/${encodeURIComponent(id)}`, undefined, deps);
}

function normalizeDraftSummary(raw: unknown): DraftSummary | null {
	if (typeof raw !== "object" || raw === null) return null;
	const d = raw as Record<string, unknown>;
	const identifier = idAsString(d.identifier) ?? idAsString(d.Identifier);
	if (identifier === null) return null;
	return {
		identifier,
		topic: unescapeHtml(decodeMaybeBase64(asString(d.topic) ?? "")),
		hasAttachments: d.isAnyFileAttached === true,
		type: asString(d.type),
		dateAdded: dateAddedOf(d.dateAdded),
		parentMessageIdentifier: idAsString(d.parentMessageIdentifier),
	};
}

/** GET /drafts?page=&limit= — audited read (200 on all pairs). */
export async function listDrafts(
	jar: CookieJar,
	page: number,
	limit: number,
	deps: HttpDeps = defaultDeps,
): Promise<DraftListPage> {
	const path = `drafts?page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}`;
	const body = await messagesRequest(jar, path, deps);
	const envelope = body as { data?: unknown; total?: unknown };
	const list = Array.isArray(envelope.data) ? envelope.data : [];
	return {
		drafts: list
			.map((raw) => normalizeDraftSummary(raw))
			.filter((d): d is DraftSummary => d !== null),
		total: typeof envelope.total === "number" ? envelope.total : list.length,
	};
}

/**
 * POST /messages — sends the message. EXACTLY ONE request, by design: no
 * retry here, and the caller may only retry a 401 (nothing was delivered).
 * The context ids, when present, ride along as strings (contract from the
 * client code; untested on live accounts — HITL verifies).
 */
export async function sendMessage(
	jar: CookieJar,
	input: MessageSendInput,
	deps: HttpDeps = defaultDeps,
): Promise<SentMessage> {
	const body: Record<string, unknown> = {
		...draftBodyOf(input),
		category: input.category ?? "normal",
	};
	if (input.repliedToMessageId != null && input.repliedToMessageId !== "") {
		body.repliedToMessageId = input.repliedToMessageId;
	}
	if (input.forwardedMessageId != null && input.forwardedMessageId !== "") {
		body.forwardedMessageId = input.forwardedMessageId;
	}
	const response = await messagesWriteRequest(jar, "POST", "messages", body, deps);
	// Puste echo = brak potwierdzenia, ale (jak przy szkicach/koszu w HITL r.1)
	// najpewniej wysłano — zgłaszamy sukces z nieznanym id, zamiast pokazywać
	// błąd, który skłoniłby do ponownej wysyłki i zduplikował wiadomość.
	if (response === null) return { messageId: "", status: "unknown" };
	const envelope = response as { data?: Record<string, unknown> };
	const data = typeof envelope.data === "object" && envelope.data !== null ? envelope.data : {};
	const messageId = idAsString(data.messageId) ?? idAsString(data.identifier);
	if (messageId === null) {
		throw new LibrusError(
			"UNEXPECTED_RESPONSE",
			502,
			`Librus zwrócił echo wysyłki w niespodziewanym formacie (POST messages). Fragment: ${snippetOf(response)}`,
		);
	}
	return { messageId, status: asString(data.status) ?? "sent" };
}

/**
 * Messages (M) API readers: wiadomosci.librus.pl/api.
 *
 * Envelopes differ from G: lists are `{ data: [...], total }`, the counter is
 * `{ data: {...} }`, and receiver types nest under `data.list`. Field names
 * are camelCase and ids are strings here (e.g. messageId), not numbers.
 */
import type { CookieJar } from "./cookie-jar";
import { isLibrusError, LibrusError } from "./errors";
import { defaultDeps, type HttpDeps, walkRedirects } from "./http";

const USER_AGENT = "librus-api-verification/1.0";

/** One inbox/outbox list item, normalized. */
export interface MessageListItem {
	messageId: string;
	senderName: string | null;
	topic: string;
	/** Body as the list returns it (audit: the list carries content). */
	content: string;
	sendDate: string | null;
	/** Null until the message is read in Librus. */
	readDate: string | null;
	hasAttachments: boolean;
}

/** One page of a folder plus the folder total. */
export interface MessageListPage {
	messages: MessageListItem[];
	total: number;
}

/** One attachment of a message detail, normalized. */
export interface MessageAttachment {
	fileName: string | null;
	/** Attachment id for the download call (attachments/{id}/messages/{mid}). */
	id: string | null;
}

/** One message with its attachments (inbox/outbox detail). */
export interface MessageDetail extends MessageListItem {
	attachments: MessageAttachment[];
}

/** Unread counters; the UI badge uses `inbox`. */
export interface UnreadCounts {
	inbox: number;
	/** Every other counter Librus reports, keyed as the API names it. */
	others: Record<string, number>;
}

export interface MessageTag {
	id: string;
	name: string;
}

export interface ReceiverType {
	id: string;
	name: string;
}

export interface CustomReceiverGroup {
	id: string;
	name: string;
}

async function messagesRequest(
	jar: CookieJar,
	path: string,
	deps: HttpDeps = defaultDeps,
): Promise<unknown> {
	const target = new URL(`https://wiadomosci.librus.pl/api/${path}`);
	const walk = await walkRedirects(
		target.toString(),
		{ method: "GET", headers: { Accept: "application/json", "User-Agent": USER_AGENT } },
		jar,
		deps,
	);
	const { response } = walk;
	if (response.status === 401) throw new LibrusError("SESSION_EXPIRED", 401);
	if (response.status === 403) throw new LibrusError("FORBIDDEN", 403);
	if (response.status === 404) throw new LibrusError("NOT_FOUND", 404);
	if (!response.ok) throw new LibrusError("UNEXPECTED_RESPONSE", 502);
	// A dead session can answer 200 with the login HTML after redirect hops —
	// the M API only ever speaks JSON, so anything else means the session must
	// be re-established (the proxy retries once with a fresh jar).
	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("json")) throw new LibrusError("SESSION_EXPIRED", 401);
	return response.json();
}

function asString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

/**
 * M bodies arrive Base64-encoded (UTF-8), the same convention as the write
 * side — confirmed on a live account. A string only counts as Base64 when its
 * alphabet matches AND it decodes to valid UTF-8; anything else (plain text,
 * diacritics, spaces, punctuation) passes through untouched.
 */
export function decodeMaybeBase64(value: string): string {
	const compact = value.replace(/\s+/g, "");
	if (compact.length < 8 || !/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return value;
	try {
		const bytes = Uint8Array.from(atob(compact), (char) => char.charCodeAt(0));
		return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
	} catch {
		return value;
	}
}

function normalizeListItem(raw: unknown): MessageListItem | null {
	if (typeof raw !== "object" || raw === null) return null;
	const r = raw as Record<string, unknown>;
	const id = typeof r.messageId === "string" ? r.messageId : null;
	if (id === null) return null;
	return {
		messageId: id,
		senderName:
			asString(r.senderName) ??
			([asString(r.senderFirstName), asString(r.senderLastName)].filter(Boolean).join(" ") || null),
		topic: decodeMaybeBase64(asString(r.topic) ?? ""),
		content: unwrapContentEnvelope(decodeMaybeBase64(asString(r.content) ?? "")),
		sendDate: asString(r.sendDate) ?? null,
		readDate: asString(r.readDate) ?? null,
		hasAttachments: r.isAnyFileAttached === true,
	};
}

function readMessagesFolder(
	jar: CookieJar,
	resource: "inbox" | "outbox",
	page: number,
	limit: number,
	deps?: HttpDeps,
): Promise<MessageListPage> {
	const path = `${resource}/messages?page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}`;
	// When `total` is missing (defensive), the page length is the fallback.
	return messagesRequest(jar, path, deps).then((body) => {
		const envelope = body as { data?: unknown; total?: unknown };
		const list = Array.isArray(envelope.data) ? envelope.data : [];
		return {
			messages: list
				.map((raw) => normalizeListItem(raw))
				.filter((m): m is MessageListItem => m !== null),
			total: typeof envelope.total === "number" ? envelope.total : list.length,
		};
	});
}

export function readInboxMessages(
	jar: CookieJar,
	page: number,
	limit: number,
	deps?: HttpDeps,
): Promise<MessageListPage> {
	return readMessagesFolder(jar, "inbox", page, limit, deps);
}

export function readOutboxMessages(
	jar: CookieJar,
	page: number,
	limit: number,
	deps?: HttpDeps,
): Promise<MessageListPage> {
	return readMessagesFolder(jar, "outbox", page, limit, deps);
}

/**
 * The M responses name the body text `body`, not `content` (the audit's draft
 * lifecycle showed exactly this asymmetry: request `content`, response
 * `body`) — so the detail falls back to `body` when `content` is absent.
 */
/**
 * After base64 decoding, the payload may be wrapped in an XML
 * `<Content>...</Content>` envelope — the official client unwraps it and
 * passes anything that is not XML through unchanged. DOMParser is not
 * available in workerd, so the unwrap is a conservative string match.
 */
/**
 * The decoded body is (often) an XML envelope — `<Message><Content><![CDATA[
 * treść]]></Content>…</Message>`. The official client takes the FIRST
 * <Content> node's value wherever it sits in the document; DOMParser is not
 * available in workerd, so this mirrors that with string matching. A
 * truncated preview cuts the envelope mid-way — the partial text after the
 * opening <Content>/<![CDATA[ marker is still worth showing, tags are not.
 */
function unwrapContentEnvelope(text: string): string {
	const cdata = /<Content[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/Content>/i.exec(text);
	if (cdata) return cdata[1] ?? "";
	const plain = /<Content[^>]*>([\s\S]*?)<\/Content>/i.exec(text);
	if (plain) return plain[1] ?? "";
	// CDATA closed but the Content tag is not: `treść]]>` without </Content>.
	const closedCdata = /<Content[^>]*><!\[CDATA\[([\s\S]*?)\]\]>/i.exec(text);
	if (closedCdata) return closedCdata[1] ?? "";
	// Truncated envelope: an opening CDATA/Content without its closing tag.
	const openCdata = /<Content[^>]*><!\[CDATA\[([\s\S]*)$/i.exec(text);
	if (openCdata) return openCdata[1] ?? "";
	const openPlain = /<Content[^>]*>([\s\S]*)$/i.exec(text);
	if (openPlain) return openPlain[1] ?? "";
	// No extractable Content node: the official client falls back to the raw
	// text and lets DOMPurify strip the markup — mirror that with a plain tag
	// strip so residual XML never reaches the UI.
	if (/<[A-Za-z/!][^>]*>/.test(text)) return text.replace(/<[^>]*>/g, "").trim();
	return text;
}

/**
 * The official client renders the body from `Message` (capital M) in the
 * detail payload — the list's `content` is only a truncated preview. Field
 * spellings drift between endpoints and archive shapes, so every known body
 * field is decoded, unwrapped and the LONGEST candidate wins — a short field
 * can never again mask a fuller one.
 */
function contentOf(d: Record<string, unknown>): string {
	let best = "";
	for (const key of ["Message", "message", "content", "body", "text", "messageContent"]) {
		const value = asString(d[key]);
		if (!value) continue;
		const candidate = unwrapContentEnvelope(decodeMaybeBase64(value));
		if (candidate.length > best.length) best = candidate;
	}
	return best;
}

/** The attachment id, under whatever key the endpoint used this time. */
function attachmentIdOf(f: Record<string, unknown>): string | null {
	for (const key of ["id", "Id", "attachmentId", "AttachmentId", "fileId", "FileId"]) {
		const value = f[key];
		if (typeof value === "string" && value) return value;
		if (typeof value === "number") return String(value);
	}
	return null;
}

/**
 * The attachment element shape is unaudited; try the plausible name keys and,
 * failing those, any string that looks like a filename ("plan.pdf").
 */
function attachmentNameOf(f: Record<string, unknown>): string | null {
	for (const key of [
		"fileName",
		"FileName",
		"filename",
		"name",
		"Name",
		"AttachmentName",
		"OriginalName",
	]) {
		const value = asString(f[key]);
		if (value) return value;
	}
	for (const value of Object.values(f)) {
		if (typeof value === "string" && /\.[a-z0-9]{1,5}$/i.test(value)) return value;
	}
	return null;
}

function normalizeDetail(raw: unknown, id: string): MessageDetail | null {
	if (typeof raw !== "object" || raw === null) return null;
	const d = raw as Record<string, unknown>;
	// The archive payload may omit messageId — the requested id stands in.
	const base = normalizeListItem({ messageId: id, ...d });
	if (!base) return null;
	const content = contentOf(d);
	const attachments: MessageAttachment[] = [];
	const list = d.attachments ?? d.Attachments;
	if (Array.isArray(list)) {
		for (const rawFile of list) {
			if (typeof rawFile !== "object" || rawFile === null) continue;
			const f = rawFile as Record<string, unknown>;
			attachments.push({ fileName: attachmentNameOf(f), id: attachmentIdOf(f) });
		}
	}
	return { ...base, content, attachments };
}

/**
 * Reads one message; opening it in Librus marks it read. The detail shape is
 * not audited (only drafts were opened), so the payload is read defensively:
 * content also falls back to `body`, and attachments to any filename-looking
 * string. When the folder path answers 404, the single-message address from
 * the audit's write table (`/messages/{id}`) is tried once — the folders do
 * not both expose the detail under their own prefix.
 */
export async function readMessageDetail(
	jar: CookieJar,
	folder: "inbox" | "outbox",
	id: string,
	deps?: HttpDeps,
): Promise<MessageDetail | null> {
	const encoded = encodeURIComponent(id);
	// The official client reads archived messages from the folder-qualified
	// archive path (`/archive/inbox/messages/{id}` — the plain /archive/messages
	// is only its DELETE route), so the fallback walks the same order: folder,
	// folder archive, then the plain archive.
	const paths = [
		`${folder}/messages/${encoded}`,
		`archive/${folder}/messages/${encoded}`,
		`archive/messages/${encoded}`,
	];
	let lastError: unknown = null;
	for (const path of paths) {
		try {
			return await readDetailAt(jar, path, id, deps);
		} catch (error) {
			if (!isLibrusError(error) || error.code !== "NOT_FOUND") throw error;
			lastError = error;
		}
	}
	if (lastError !== null) throw lastError;
	return null;
}

function readDetailAt(
	jar: CookieJar,
	path: string,
	id: string,
	deps?: HttpDeps,
): Promise<MessageDetail | null> {
	return messagesRequest(jar, path, deps).then((body) => {
		const envelope = body as { data?: unknown };
		if (typeof envelope.data !== "object" || envelope.data === null) return null;
		const detail = normalizeDetail(envelope.data, id);
		// The archive payload may omit messageId — the requested id is then the
		// identity the caller already knows.
		if (detail !== null && detail.messageId === "") return { ...detail, messageId: id };
		return detail;
	});
}

/** Reads the unread counters - metadata only, never message content. */
export function readUnreadMessagesCount(jar: CookieJar, deps?: HttpDeps): Promise<UnreadCounts> {
	return messagesRequest(jar, "inbox/unreadMessagesCount", deps).then((body) => {
		const envelope = body as { data?: unknown };
		if (typeof envelope.data !== "object" || envelope.data === null) {
			return { inbox: 0, others: {} };
		}
		const data = envelope.data as Record<string, unknown>;
		const others: Record<string, number> = {};
		for (const [key, value] of Object.entries(data)) {
			if (key === "inbox") continue;
			if (typeof value === "number") others[key] = value;
		}
		return {
			inbox: typeof data.inbox === "number" ? data.inbox : 0,
			others,
		};
	});
}

/** The M ids arrive as strings, but numbers are tolerated (defensive). */
function idAsString(value: unknown): string | null {
	return typeof value === "string" ? value : typeof value === "number" ? String(value) : null;
}

/** Reads the tag list ({data: [...]}); items are read defensively. */
export function readTags(jar: CookieJar, deps?: HttpDeps): Promise<MessageTag[]> {
	return messagesRequest(jar, "tags", deps).then((body) => {
		const envelope = body as { data?: unknown };
		const list = Array.isArray(envelope.data) ? envelope.data : [];
		const tags: MessageTag[] = [];
		for (const raw of list) {
			if (typeof raw !== "object" || raw === null) continue;
			const t = raw as Record<string, unknown>;
			const id = idAsString(t.id);
			const name = asString(t.name);
			if (id === null || name === null) continue;
			tags.push({ id, name });
		}
		return tags;
	});
}

/** Reads receiver types ({data.list: [{id, name}]} per audit). */
export function readReceiverTypes(jar: CookieJar, deps?: HttpDeps): Promise<ReceiverType[]> {
	return messagesRequest(jar, "receivers/types", deps).then((body) => {
		const envelope = body as { data?: { list?: unknown } };
		const list = Array.isArray(envelope.data?.list) ? envelope.data.list : [];
		const types: ReceiverType[] = [];
		for (const raw of list) {
			if (typeof raw !== "object" || raw === null) continue;
			const t = raw as Record<string, unknown>;
			const id = idAsString(t.id);
			const name = asString(t.name);
			if (id === null || name === null) continue;
			types.push({ id, name });
		}
		return types;
	});
}

/** Reads custom receiver groups ({groups: [...]} per audit; unobserved items). */
export function readCustomReceiverGroups(
	jar: CookieJar,
	deps?: HttpDeps,
): Promise<CustomReceiverGroup[]> {
	return messagesRequest(jar, "receivers/custom-groups", deps).then((body) => {
		const envelope = body as { groups?: unknown };
		const list = Array.isArray(envelope.groups) ? envelope.groups : [];
		const groups: CustomReceiverGroup[] = [];
		for (const raw of list) {
			if (typeof raw !== "object" || raw === null) continue;
			const g = raw as Record<string, unknown>;
			const id = idAsString(g.id);
			const name = asString(g.name);
			if (id === null || name === null) continue;
			groups.push({ id, name });
		}
		return groups;
	});
}

/** M account meta, normalized ({firstName, lastName, groupId, accountId...}). */
export interface MessagesMe {
	accountId: number | null;
	firstName: string | null;
	lastName: string | null;
	/** M groupId is a string here ("STUDENT"/"PARENT"-style), unlike G. */
	groupId: string | null;
	groupName: string | null;
	originSystem: string | null;
}

export function readMessagesMe(jar: CookieJar, deps?: HttpDeps): Promise<MessagesMe> {
	return messagesRequest(jar, "me", deps).then((body) => {
		const me = body as Record<string, unknown>;
		return {
			accountId: typeof me.accountId === "number" ? me.accountId : null,
			firstName: asString(me.firstName) ?? null,
			lastName: asString(me.lastName) ?? null,
			groupId: asString(me.groupId) ?? null,
			groupName: asString(me.groupName) ?? null,
			originSystem: asString(me.originSystem) ?? null,
		};
	});
}

/** One fetched attachment: bytes plus whatever the headers revealed. */
export interface AttachmentDownload {
	fileName: string | null;
	contentType: string;
	bytes: ArrayBuffer;
}

/**
 * Downloads one attachment the way the official client does:
 * GET attachments/{fileId}/messages/{messageId}. The file id comes from the
 * message detail's attachments list.
 */
export async function fetchAttachment(
	jar: CookieJar,
	fileId: string,
	messageId: string,
	deps: HttpDeps = defaultDeps,
): Promise<AttachmentDownload> {
	const path = `attachments/${encodeURIComponent(fileId)}/messages/${encodeURIComponent(messageId)}`;
	const target = new URL(`https://wiadomosci.librus.pl/api/${path}`);
	const walk = await walkRedirects(
		target.toString(),
		{ method: "GET", headers: { "User-Agent": USER_AGENT } },
		jar,
		deps,
	);
	const { response } = walk;
	if (response.status === 401) throw new LibrusError("SESSION_EXPIRED", 401);
	if (response.status === 403) throw new LibrusError("FORBIDDEN", 403);
	if (response.status === 404) throw new LibrusError("NOT_FOUND", 404);
	if (!response.ok) throw new LibrusError("UNEXPECTED_RESPONSE", 502);
	const disposition = response.headers.get("content-disposition") ?? "";
	const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
	const contentType = response.headers.get("content-type") ?? "application/octet-stream";
	return {
		fileName: match?.[1] ? decodeURIComponent(match[1]) : null,
		contentType,
		bytes: await response.arrayBuffer(),
	};
}

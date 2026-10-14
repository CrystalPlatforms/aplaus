/**
 * Messages proxy services: the M session (separate jar per account) plus the
 * read endpoints — inbox/outbox with pagination, message detail, unread
 * counter, tags and receiver dictionaries.
 *
 * The M jar self-heals: when absent in KV (or when M answers 401) it is
 * re-established once from the stored G jar via `wiadomosci3`; the renewal
 * happens without credentials, so the client never re-logs in for M.
 */
import {
	type AttachmentDownload,
	CookieJar,
	type CustomReceiverGroup,
	establishMessagesSession,
	fetchAttachment,
	type MessageDetail,
	type MessageListPage,
	type MessageTag,
	type ReceiverType,
	readCustomReceiverGroups,
	readInboxMessages,
	readMessageDetail,
	readMessagesMe,
	readOutboxMessages,
	readReceiverTypes,
	readTags,
	readUnreadMessagesCount,
	type UnreadCounts,
} from "@repo/librus-client";
import { loadAccount, saveAccountMJar } from "@/kv/store";
import type { Result } from "../types/result";
import { toAppError } from "./librus-errors";

/** Injectable boundary: the M readers, replaced wholesale in tests. */
export interface MessagesDeps {
	establishMessagesSession: typeof establishMessagesSession;
	readInboxMessages: typeof readInboxMessages;
	readOutboxMessages: typeof readOutboxMessages;
	readMessageDetail: typeof readMessageDetail;
	readUnreadMessagesCount: typeof readUnreadMessagesCount;
	readMessagesMe: typeof readMessagesMe;
	readTags: typeof readTags;
	readReceiverTypes: typeof readReceiverTypes;
	readCustomReceiverGroups: typeof readCustomReceiverGroups;
	fetchAttachment: typeof fetchAttachment;
}

const defaultMessagesDeps: MessagesDeps = {
	establishMessagesSession,
	readInboxMessages,
	readOutboxMessages,
	readMessageDetail,
	readUnreadMessagesCount,
	readMessagesMe,
	readTags,
	readReceiverTypes,
	readCustomReceiverGroups,
	fetchAttachment,
};

/**
 * Resolves the M session for the account: the stored M jar when present,
 * otherwise one establishment attempt from the G jar (persisted on success).
 */
async function loadMessagesJar(
	kv: KVNamespace,
	accountId: string,
	deps: MessagesDeps,
): Promise<Result<{ jar: CookieJar; groupId: number }>> {
	const account = await loadAccount(kv, accountId);
	if (!account) {
		return {
			ok: false,
			error: {
				code: "SESSION_EXPIRED",
				message: "Sesja wygasła. Zaloguj się ponownie.",
				status: 401,
			},
		};
	}
	if (account.mJar && account.mJar.length > 0) {
		return {
			ok: true,
			data: { jar: CookieJar.fromDTO(account.mJar), groupId: account.groupId },
		};
	}
	try {
		const mJar = await deps.establishMessagesSession(CookieJar.fromDTO(account.jar));
		await saveAccountMJar(kv, accountId, mJar.toDTO());
		return { ok: true, data: { jar: mJar, groupId: account.groupId } };
	} catch (error) {
		return { ok: false, error: toAppError(error) };
	}
}

/** One read through the M session, with a single re-establish retry on 401. */
async function withMessagesSession<T>(
	kv: KVNamespace,
	accountId: string,
	deps: MessagesDeps,
	call: (jar: CookieJar) => Promise<T>,
): Promise<Result<T>> {
	const session = await loadMessagesJar(kv, accountId, deps);
	if (!session.ok) return session;
	try {
		return { ok: true, data: await call(session.data.jar) };
	} catch (error) {
		const appError = toAppError(error);
		if (appError.code !== "SESSION_EXPIRED") return { ok: false, error: appError };
		// Re-establish M once from the unchanged G jar and retry the read.
		const account = await loadAccount(kv, accountId);
		if (!account) return { ok: false, error: appError };
		try {
			const mJar = await deps.establishMessagesSession(CookieJar.fromDTO(account.jar));
			await saveAccountMJar(kv, accountId, mJar.toDTO());
			return { ok: true, data: await call(mJar) };
		} catch (retryError) {
			return { ok: false, error: toAppError(retryError) };
		}
	}
}

/** GET /api/messages/me — M account meta. */
export async function getMessagesMe(
	kv: KVNamespace,
	accountId: string,
	deps: MessagesDeps = defaultMessagesDeps,
): Promise<Result<Awaited<ReturnType<typeof readMessagesMe>>>> {
	const read =
		(deps as { readMessagesMe?: typeof readMessagesMe }).readMessagesMe ?? readMessagesMe;
	return withMessagesSession(kv, accountId, deps, (jar) => read(jar));
}

/** GET /api/messages/inbox — one page of the inbox. */
export async function getInbox(
	kv: KVNamespace,
	accountId: string,
	page: { page: number; limit: number },
	deps: MessagesDeps = defaultMessagesDeps,
): Promise<Result<MessageListPage>> {
	return withMessagesSession(kv, accountId, deps, (jar) =>
		deps.readInboxMessages(jar, page.page, page.limit),
	);
}

/** GET /api/messages/outbox — one page of the outbox. */
export async function getOutbox(
	kv: KVNamespace,
	accountId: string,
	page: { page: number; limit: number },
	deps: MessagesDeps = defaultMessagesDeps,
): Promise<Result<MessageListPage>> {
	return withMessagesSession(kv, accountId, deps, (jar) =>
		deps.readOutboxMessages(jar, page.page, page.limit),
	);
}

/** GET /api/messages/inbox/:id — the message (marks read in Librus). */
export async function getInboxDetail(
	kv: KVNamespace,
	accountId: string,
	id: string,
	deps: MessagesDeps = defaultMessagesDeps,
): Promise<Result<MessageDetail | null>> {
	return withMessagesSession(kv, accountId, deps, (jar) =>
		deps.readMessageDetail(jar, "inbox", id),
	);
}

/** GET /api/messages/outbox/:id — detail of a sent message. */
export async function getOutboxDetail(
	kv: KVNamespace,
	accountId: string,
	id: string,
	deps: MessagesDeps = defaultMessagesDeps,
): Promise<Result<MessageDetail | null>> {
	return withMessagesSession(kv, accountId, deps, (jar) =>
		deps.readMessageDetail(jar, "outbox", id),
	);
}

/** GET /api/messages/inbox/unread-count — metadata only, no content. */
export async function getUnreadCount(
	kv: KVNamespace,
	accountId: string,
	deps: MessagesDeps = defaultMessagesDeps,
): Promise<Result<UnreadCounts>> {
	return withMessagesSession(kv, accountId, deps, (jar) => deps.readUnreadMessagesCount(jar));
}

/** GET /api/messages/attachments/:fileId/:messageId — the file bytes. */
export async function getAttachment(
	kv: KVNamespace,
	accountId: string,
	fileId: string,
	messageId: string,
	deps: MessagesDeps = defaultMessagesDeps,
): Promise<Result<AttachmentDownload>> {
	return withMessagesSession(kv, accountId, deps, (jar) =>
		deps.fetchAttachment(jar, fileId, messageId),
	);
}

/** GET /api/messages/tags. */
export async function getTags(
	kv: KVNamespace,
	accountId: string,
	deps: MessagesDeps = defaultMessagesDeps,
): Promise<Result<MessageTag[]>> {
	return withMessagesSession(kv, accountId, deps, (jar) => deps.readTags(jar));
}

/** GET /api/messages/receivers/types. */
export async function getReceiverTypes(
	kv: KVNamespace,
	accountId: string,
	deps: MessagesDeps = defaultMessagesDeps,
): Promise<Result<ReceiverType[]>> {
	return withMessagesSession(kv, accountId, deps, (jar) => deps.readReceiverTypes(jar));
}

/** GET /api/messages/receivers/custom-groups. */
export async function getCustomGroups(
	kv: KVNamespace,
	accountId: string,
	deps: MessagesDeps = defaultMessagesDeps,
): Promise<Result<CustomReceiverGroup[]>> {
	return withMessagesSession(kv, accountId, deps, (jar) => deps.readCustomReceiverGroups(jar));
}

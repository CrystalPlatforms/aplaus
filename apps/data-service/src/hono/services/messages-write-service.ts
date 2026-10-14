/**
 * Messages write services: drafts (`newOne`/`reply`/`forward`) and send.
 *
 * Send policy — no blind retry: `sendMessage` performs exactly one POST
 * /messages. The only automatic retry allowed is re-establishing the M
 * session on 401 (SESSION_EXPIRED), because a 401 means the message was
 * certainly NOT delivered — an ambiguous failure (5xx, network error, HTML
 * instead of JSON) is returned to the client and the user decides whether to
 * send again.
 */
import type {
	DraftListPage,
	DraftRecord,
	DraftVariant,
	DraftWriteInput,
	MessageSendInput,
	SentMessage,
} from "@repo/librus-client";
import type { Result } from "../types/result";
import {
	defaultWriteMessagesDeps,
	type WriteMessagesDeps,
	withMessagesSession,
} from "./messages-service";

/** Draft write input as the handler's validated body carries it. */
export type DraftWriteBody = DraftWriteInput;

/** Create body: a draft plus optional reply/forward context (ids as strings). */
export interface DraftCreateBody extends DraftWriteInput {
	repliedToMessageId?: string;
	forwardedMessageId?: string;
}

/**
 * POST /api/messages/drafts — create a draft. With reply/forward context in
 * the body it takes the context route (ids travel as strings on the wire).
 */
export async function createDraft(
	kv: KVNamespace,
	accountId: string,
	body: DraftCreateBody,
	deps: WriteMessagesDeps = defaultWriteMessagesDeps,
): Promise<Result<DraftRecord>> {
	const { repliedToMessageId, forwardedMessageId, draft } = splitContext(body);
	return withMessagesSession(kv, accountId, deps, (jar) =>
		repliedToMessageId !== undefined
			? deps.createContextDraft(jar, "reply", repliedToMessageId, draft)
			: forwardedMessageId !== undefined
				? deps.createContextDraft(jar, "forward", forwardedMessageId, draft)
				: deps.createDraft(jar, draft),
	);
}

/** Splits the optional context ids off the create body. */
function splitContext(body: DraftCreateBody): {
	repliedToMessageId?: string;
	forwardedMessageId?: string;
	draft: DraftWriteBody;
} {
	const { repliedToMessageId, forwardedMessageId, ...draft } = body;
	return { repliedToMessageId, forwardedMessageId, draft };
}

/** GET /api/messages/drafts/:id — null when the draft is gone. */
export async function getDraft(
	kv: KVNamespace,
	accountId: string,
	id: string,
	deps: WriteMessagesDeps = defaultWriteMessagesDeps,
): Promise<Result<DraftRecord | null>> {
	return withMessagesSession(kv, accountId, deps, (jar) => deps.readDraft(jar, id));
}

/**
 * PUT /api/messages/drafts/:variant/:id — the variant keys the Librus route.
 * Returns the echo when it reads as a draft, null otherwise.
 */
export async function updateDraft(
	kv: KVNamespace,
	accountId: string,
	variant: DraftVariant,
	id: string,
	body: DraftWriteBody,
	deps: WriteMessagesDeps = defaultWriteMessagesDeps,
): Promise<Result<DraftRecord | null>> {
	return withMessagesSession(kv, accountId, deps, (jar) =>
		deps.updateDraft(jar, variant, id, body),
	);
}

/** DELETE /api/messages/drafts/:id. */
export async function deleteDraft(
	kv: KVNamespace,
	accountId: string,
	id: string,
	deps: WriteMessagesDeps = defaultWriteMessagesDeps,
): Promise<Result<null>> {
	return withMessagesSession(kv, accountId, deps, async (jar) => {
		await deps.deleteDraft(jar, id);
		return null;
	});
}

/** GET /api/messages/drafts — one page of drafts. */
export async function listDrafts(
	kv: KVNamespace,
	accountId: string,
	page: { page: number; limit: number },
	deps: WriteMessagesDeps = defaultWriteMessagesDeps,
): Promise<Result<DraftListPage>> {
	return withMessagesSession(kv, accountId, deps, (jar) =>
		deps.listDrafts(jar, page.page, page.limit),
	);
}

/**
 * POST /api/messages/send — sends the message. Exactly one POST /messages;
 * the session layer retries only on SESSION_EXPIRED (nothing was delivered on
 * a 401 — see the module doc). Any ambiguous failure surfaces to the client.
 */
export async function sendMessage(
	kv: KVNamespace,
	accountId: string,
	body: MessageSendInput,
	deps: WriteMessagesDeps = defaultWriteMessagesDeps,
): Promise<Result<SentMessage>> {
	return withMessagesSession(kv, accountId, deps, (jar) => deps.sendMessage(jar, body));
}

/**
 * Messages ops services (Faza 10): attachment storage, signatures, tags,
 * custom receiver groups and the trash bin. All the underlying Librus
 * contracts come from the official client's code (unverified by the audit) —
 * HITL per operation is part of the phase checklist.
 */
import type {
	AttachmentStorage,
	ClientScanResult,
	MessageListPage,
	MessageSignature,
	ProbeResult,
	ReceiverGroupWriteResult,
	SignatureWriteInput,
	StoredAttachment,
	TagWriteInput,
	TagWriteResult,
} from "@repo/librus-client";
import {
	CookieJar,
	createAttachmentStorage,
	establishMessagesSession,
	createReceiverGroup as libCreateReceiverGroup,
	createSignature as libCreateSignature,
	createTag as libCreateTag,
	deleteMessagePermanently as libDeleteMessagePermanently,
	deleteReceiverGroup as libDeleteReceiverGroup,
	deleteSignature as libDeleteSignature,
	deleteStoredAttachment as libDeleteStoredAttachment,
	deleteTag as libDeleteTag,
	moveMessageToTrash as libMoveMessageToTrash,
	probeMessagesEndpoints as libProbeMessagesEndpoints,
	readSignatures as libReadSignatures,
	readTrashMessages as libReadTrashMessages,
	restoreMessageFromTrash as libRestoreMessageFromTrash,
	scanMessagesClient as libScanMessagesClient,
	updateReceiverGroup as libUpdateReceiverGroup,
	updateSignature as libUpdateSignature,
	updateTag as libUpdateTag,
	uploadAttachment as libUploadAttachment,
} from "@repo/librus-client";
import { loadAccount } from "@/kv/store";
import type { Result } from "../types/result";
import { withMessagesSession } from "./messages-service";

/** Injectable boundary for the ops (write) side. */
export interface OpsMessagesDeps {
	establishMessagesSession: typeof establishMessagesSession;
	createAttachmentStorage: typeof createAttachmentStorage;
	uploadAttachment: typeof libUploadAttachment;
	deleteStoredAttachment: typeof libDeleteStoredAttachment;
	readSignatures: typeof libReadSignatures;
	createSignature: typeof libCreateSignature;
	updateSignature: typeof libUpdateSignature;
	deleteSignature: typeof libDeleteSignature;
	createTag: typeof libCreateTag;
	updateTag: typeof libUpdateTag;
	deleteTag: typeof libDeleteTag;
	createReceiverGroup: typeof libCreateReceiverGroup;
	updateReceiverGroup: typeof libUpdateReceiverGroup;
	deleteReceiverGroup: typeof libDeleteReceiverGroup;
	readTrashMessages: typeof libReadTrashMessages;
	moveMessageToTrash: typeof libMoveMessageToTrash;
	probeMessagesEndpoints: typeof libProbeMessagesEndpoints;
	scanMessagesClient: typeof libScanMessagesClient;
	restoreMessageFromTrash: typeof libRestoreMessageFromTrash;
	deleteMessagePermanently: typeof libDeleteMessagePermanently;
}

const defaultOpsMessagesDeps: OpsMessagesDeps = {
	establishMessagesSession,
	createAttachmentStorage,
	uploadAttachment: libUploadAttachment,
	deleteStoredAttachment: libDeleteStoredAttachment,
	readSignatures: libReadSignatures,
	createSignature: libCreateSignature,
	updateSignature: libUpdateSignature,
	deleteSignature: libDeleteSignature,
	createTag: libCreateTag,
	updateTag: libUpdateTag,
	deleteTag: libDeleteTag,
	createReceiverGroup: libCreateReceiverGroup,
	updateReceiverGroup: libUpdateReceiverGroup,
	deleteReceiverGroup: libDeleteReceiverGroup,
	readTrashMessages: libReadTrashMessages,
	moveMessageToTrash: libMoveMessageToTrash,
	probeMessagesEndpoints: libProbeMessagesEndpoints,
	scanMessagesClient: libScanMessagesClient,
	restoreMessageFromTrash: libRestoreMessageFromTrash,
	deleteMessagePermanently: libDeleteMessagePermanently,
};

/** POST /api/messages/attachments/storage — one storage per composer session. */
export async function createStorage(
	kv: KVNamespace,
	accountId: string,
	deps: OpsMessagesDeps = defaultOpsMessagesDeps,
): Promise<Result<AttachmentStorage>> {
	return withMessagesSession(kv, accountId, deps, (jar) => deps.createAttachmentStorage(jar));
}

/** POST /api/messages/attachments — multipart upload into the storage. */
export async function uploadFile(
	kv: KVNamespace,
	accountId: string,
	file: { name: string; contentType: string; bytes: ArrayBuffer },
	storageId: string,
	temporaryFileId: string,
	deps: OpsMessagesDeps = defaultOpsMessagesDeps,
): Promise<Result<StoredAttachment>> {
	return withMessagesSession(kv, accountId, deps, (jar) =>
		deps.uploadAttachment(jar, file, storageId, temporaryFileId),
	);
}

/** DELETE /api/messages/attachments/:fileId/storage/:storageId. */
export async function deleteFile(
	kv: KVNamespace,
	accountId: string,
	fileId: string,
	storageId: string,
	deps: OpsMessagesDeps = defaultOpsMessagesDeps,
): Promise<Result<null>> {
	return withMessagesSession(kv, accountId, deps, async (jar) => {
		await deps.deleteStoredAttachment(jar, fileId, storageId);
		return null;
	});
}

/** GET /api/messages/signatures — 404 from Librus means an empty list. */
export async function getSignatures(
	kv: KVNamespace,
	accountId: string,
	deps: OpsMessagesDeps = defaultOpsMessagesDeps,
): Promise<Result<MessageSignature[]>> {
	return withMessagesSession(kv, accountId, deps, (jar) => deps.readSignatures(jar));
}

/** POST /api/messages/signatures. */
export async function createSignature(
	kv: KVNamespace,
	accountId: string,
	input: SignatureWriteInput,
	deps: OpsMessagesDeps = defaultOpsMessagesDeps,
): Promise<Result<MessageSignature | null>> {
	return withMessagesSession(kv, accountId, deps, (jar) => deps.createSignature(jar, input));
}

/** PUT /api/messages/signatures/:id. */
export async function updateSignature(
	kv: KVNamespace,
	accountId: string,
	id: string,
	input: SignatureWriteInput,
	deps: OpsMessagesDeps = defaultOpsMessagesDeps,
): Promise<Result<MessageSignature | null>> {
	return withMessagesSession(kv, accountId, deps, (jar) => deps.updateSignature(jar, id, input));
}

/** DELETE /api/messages/signatures/:id. */
export async function deleteSignature(
	kv: KVNamespace,
	accountId: string,
	id: string,
	deps: OpsMessagesDeps = defaultOpsMessagesDeps,
): Promise<Result<null>> {
	return withMessagesSession(kv, accountId, deps, async (jar) => {
		await deps.deleteSignature(jar, id);
		return null;
	});
}

/** POST /api/messages/tags. */
export async function createTag(
	kv: KVNamespace,
	accountId: string,
	input: TagWriteInput,
	deps: OpsMessagesDeps = defaultOpsMessagesDeps,
): Promise<Result<TagWriteResult>> {
	return withMessagesSession(kv, accountId, deps, (jar) => deps.createTag(jar, input));
}

/** PUT /api/messages/tags/:id. */
export async function updateTag(
	kv: KVNamespace,
	accountId: string,
	id: string,
	input: TagWriteInput,
	deps: OpsMessagesDeps = defaultOpsMessagesDeps,
): Promise<Result<TagWriteResult>> {
	return withMessagesSession(kv, accountId, deps, (jar) => deps.updateTag(jar, id, input));
}

/** DELETE /api/messages/tags/:id. */
export async function deleteTag(
	kv: KVNamespace,
	accountId: string,
	id: string,
	deps: OpsMessagesDeps = defaultOpsMessagesDeps,
): Promise<Result<null>> {
	return withMessagesSession(kv, accountId, deps, async (jar) => {
		await deps.deleteTag(jar, id);
		return null;
	});
}

/** POST /api/messages/receivers/custom-groups. */
export async function createGroup(
	kv: KVNamespace,
	accountId: string,
	name: string,
	deps: OpsMessagesDeps = defaultOpsMessagesDeps,
): Promise<Result<ReceiverGroupWriteResult>> {
	return withMessagesSession(kv, accountId, deps, (jar) => deps.createReceiverGroup(jar, name));
}

/** PUT /api/messages/receivers/custom-groups/:id. */
export async function updateGroup(
	kv: KVNamespace,
	accountId: string,
	id: string,
	name: string,
	deps: OpsMessagesDeps = defaultOpsMessagesDeps,
): Promise<Result<ReceiverGroupWriteResult>> {
	return withMessagesSession(kv, accountId, deps, (jar) => deps.updateReceiverGroup(jar, id, name));
}

/** DELETE /api/messages/receivers/custom-groups/:id. */
export async function deleteGroup(
	kv: KVNamespace,
	accountId: string,
	id: string,
	deps: OpsMessagesDeps = defaultOpsMessagesDeps,
): Promise<Result<null>> {
	return withMessagesSession(kv, accountId, deps, async (jar) => {
		await deps.deleteReceiverGroup(jar, id);
		return null;
	});
}

/** GET /api/messages/trash — one page of the trash bin. */
export async function getTrash(
	kv: KVNamespace,
	accountId: string,
	page: { page: number; limit: number },
	deps: OpsMessagesDeps = defaultOpsMessagesDeps,
): Promise<Result<MessageListPage>> {
	return withMessagesSession(kv, accountId, deps, (jar) =>
		deps.readTrashMessages(jar, page.page, page.limit),
	);
}

/** POST /api/messages/trash — move the message to the trash bin. */
export async function moveToTrash(
	kv: KVNamespace,
	accountId: string,
	messageId: string,
	deps: OpsMessagesDeps = defaultOpsMessagesDeps,
): Promise<Result<null>> {
	return withMessagesSession(kv, accountId, deps, async (jar) => {
		await deps.moveMessageToTrash(jar, messageId);
		return null;
	});
}

/** PUT /api/messages/trash/:id/restore — bring the message back. */
export async function restoreFromTrash(
	kv: KVNamespace,
	accountId: string,
	id: string,
	deps: OpsMessagesDeps = defaultOpsMessagesDeps,
): Promise<Result<null>> {
	return withMessagesSession(kv, accountId, deps, async (jar) => {
		await deps.restoreMessageFromTrash(jar, id);
		return null;
	});
}

/** DELETE /api/messages/trash/:id — irreversible; the UI confirms first. */
export async function deletePermanently(
	kv: KVNamespace,
	accountId: string,
	id: string,
	deps: OpsMessagesDeps = defaultOpsMessagesDeps,
): Promise<Result<null>> {
	return withMessagesSession(kv, accountId, deps, async (jar) => {
		await deps.deleteMessagePermanently(jar, id);
		return null;
	});
}

/** GET /api/messages/receivers/probe?type= — Tester diagnostyczny (HITL r.3). */
export async function probeMessages(
	kv: KVNamespace,
	accountId: string,
	typeId: string,
	deps: OpsMessagesDeps = defaultOpsMessagesDeps,
): Promise<Result<ProbeResult[]>> {
	return withMessagesSession(kv, accountId, deps, (jar) =>
		deps.probeMessagesEndpoints(jar, typeId),
	);
}

/** GET /api/messages/client-scan — skaner kodu klienta (ścieżką synergia/wiadomosci3). */
export async function clientScan(
	kv: KVNamespace,
	accountId: string,
	deps: OpsMessagesDeps = defaultOpsMessagesDeps,
): Promise<Result<ClientScanResult>> {
	const account = await loadAccount(kv, accountId);
	if (account === null) {
		return {
			ok: false,
			error: { code: "NOT_FOUND", message: "Nie znaleziono konta.", status: 404 },
		};
	}
	return withMessagesSession(kv, accountId, deps, (mJar) =>
		deps.scanMessagesClient(CookieJar.fromDTO(account.jar), mJar),
	);
}

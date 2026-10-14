/**
 * Messages proxy routes (M): folders with pagination, message detail, unread counter, tags and receiver dictionaries.
 */

import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { requireDevice } from "../middleware/device-auth";
import {
	AttachmentDeleteParamSchema,
	AttachmentUploadSchema,
	DraftCreateSchema,
	DraftIdParamSchema,
	DraftUpdateParamSchema,
	DraftWriteSchema,
	GroupWriteSchema,
	MessagesPageQuerySchema,
	ReceiverListQuerySchema,
	SendMessageSchema,
	SignatureIdParamSchema,
	SignatureWriteSchema,
	TagIdParamSchema,
	TagWriteSchema,
	TrashBodySchema,
	TrashIdParamSchema,
} from "../schemas/messages";
import * as messagesOpsService from "../services/messages-ops-service";
import * as messagesService from "../services/messages-service";
import * as messagesWriteService from "../services/messages-write-service";
import type { Result } from "../types/result";

const messages = new Hono<{ Bindings: Env }>();

messages.use("*", requireDevice);

messages.get("/me", async (c) => {
	const accountId = c.get("accountId");
	return resultToResponse(c, await messagesService.getMessagesMe(c.env.KV, accountId));
});

messages.get("/inbox/unread-count", async (c) => {
	const accountId = c.get("accountId");
	return resultToResponse(c, await messagesService.getUnreadCount(c.env.KV, accountId));
});

messages.get("/inbox", zValidator("query", MessagesPageQuerySchema), async (c) => {
	const accountId = c.get("accountId");
	const { page, limit } = c.req.valid("query");
	return resultToResponse(c, await messagesService.getInbox(c.env.KV, accountId, { page, limit }));
});

messages.get("/outbox", zValidator("query", MessagesPageQuerySchema), async (c) => {
	const accountId = c.get("accountId");
	const { page, limit } = c.req.valid("query");
	return resultToResponse(c, await messagesService.getOutbox(c.env.KV, accountId, { page, limit }));
});

messages.get("/inbox/:id", async (c) => {
	const id = c.req.param("id");
	const accountId = c.get("accountId");
	return resultToResponse(c, await messagesService.getInboxDetail(c.env.KV, accountId, id));
});

messages.get("/outbox/:id", async (c) => {
	const id = c.req.param("id");
	const accountId = c.get("accountId");
	return resultToResponse(c, await messagesService.getOutboxDetail(c.env.KV, accountId, id));
});

messages.get("/attachments/:fileId/:messageId", async (c) => {
	const fileId = c.req.param("fileId");
	const messageId = c.req.param("messageId");
	const accountId = c.get("accountId");
	const result = await messagesService.getAttachment(c.env.KV, accountId, fileId, messageId);
	if (!result.ok) {
		const status = result.error.status;
		const httpStatus = (status >= 400 && status <= 599 ? status : 500) as ContentfulStatusCode;
		return c.json({ error: result.error.message, code: result.error.code }, httpStatus);
	}
	return c.body(result.data.bytes, 200, {
		"Content-Type": result.data.contentType,
		"Content-Disposition": `attachment; filename="${(result.data.fileName ?? "zalacznik").replace(/["\\]/g, "")}"`,
	});
});

messages.get("/tags", async (c) => {
	const accountId = c.get("accountId");
	return resultToResponse(c, await messagesService.getTags(c.env.KV, accountId));
});

messages.get("/receivers", zValidator("query", ReceiverListQuerySchema), async (c) => {
	const accountId = c.get("accountId");
	const { type } = c.req.valid("query");
	return resultToResponse(c, await messagesService.getReceivers(c.env.KV, accountId, type));
});

/** GET /api/messages/client-scan — skaner kodu klienta: endpointy i formaty z paczek JS. */
messages.get("/client-scan", async (c) => {
	const accountId = c.get("accountId");
	return resultToResponse(c, await messagesOpsService.clientScan(c.env.KV, accountId));
});

/** GET /api/messages/receivers/probe — Tester diagnostyczny: statusy kandydatów tras M. */
messages.get("/receivers/probe", zValidator("query", ReceiverListQuerySchema), async (c) => {
	const accountId = c.get("accountId");
	const { type } = c.req.valid("query");
	return resultToResponse(c, await messagesOpsService.probeMessages(c.env.KV, accountId, type));
});

messages.get("/receivers/types", async (c) => {
	const accountId = c.get("accountId");
	return resultToResponse(c, await messagesService.getReceiverTypes(c.env.KV, accountId));
});

messages.get("/receivers/custom-groups", async (c) => {
	const accountId = c.get("accountId");
	return resultToResponse(c, await messagesService.getCustomGroups(c.env.KV, accountId));
});

/** POST /api/messages/send — wyraźna akcja użytkownika; dokładnie jedno żądanie POST /messages. */
messages.post("/send", zValidator("json", SendMessageSchema), async (c) => {
	const accountId = c.get("accountId");
	const body = c.req.valid("json");
	return resultToResponse(c, await messagesWriteService.sendMessage(c.env.KV, accountId, body));
});

/** GET /api/messages/drafts — jedna strona listy szkiców. */
messages.get("/drafts", zValidator("query", MessagesPageQuerySchema), async (c) => {
	const accountId = c.get("accountId");
	const { page, limit } = c.req.valid("query");
	return resultToResponse(
		c,
		await messagesWriteService.listDrafts(c.env.KV, accountId, { page, limit }),
	);
});

/** POST /api/messages/drafts — utworzenie szkica (z opcjonalnym kontekstem reply/forward). */
messages.post("/drafts", zValidator("json", DraftCreateSchema), async (c) => {
	const accountId = c.get("accountId");
	const body = c.req.valid("json");
	return resultToResponse(c, await messagesWriteService.createDraft(c.env.KV, accountId, body));
});

/** GET /api/messages/drafts/:id — treść szkica do edycji; null gdy nie istnieje. */
messages.get("/drafts/:id", zValidator("param", DraftIdParamSchema), async (c) => {
	const accountId = c.get("accountId");
	const { id } = c.req.valid("param");
	return resultToResponse(c, await messagesWriteService.getDraft(c.env.KV, accountId, id));
});

/** PUT /api/messages/drafts/:variant/:id — edycja szkica (newOne/reply/forward). */
messages.put(
	"/drafts/:variant/:id",
	zValidator("param", DraftUpdateParamSchema),
	zValidator("json", DraftWriteSchema),
	async (c) => {
		const accountId = c.get("accountId");
		const { variant, id } = c.req.valid("param");
		const body = c.req.valid("json");
		return resultToResponse(
			c,
			await messagesWriteService.updateDraft(c.env.KV, accountId, variant, id, body),
		);
	},
);

/** DELETE /api/messages/drafts/:id — usunięcie szkica. */
messages.delete("/drafts/:id", zValidator("param", DraftIdParamSchema), async (c) => {
	const accountId = c.get("accountId");
	const { id } = c.req.valid("param");
	return resultToResponse(c, await messagesWriteService.deleteDraft(c.env.KV, accountId, id));
});

/** ---- Faza 10 (issue #11): pełny obieg wiadomości ---- */

// Podpisy
messages.get("/signatures", async (c) => {
	const accountId = c.get("accountId");
	return resultToResponse(c, await messagesOpsService.getSignatures(c.env.KV, accountId));
});

messages.post("/signatures", zValidator("json", SignatureWriteSchema), async (c) => {
	const accountId = c.get("accountId");
	const body = c.req.valid("json");
	return resultToResponse(c, await messagesOpsService.createSignature(c.env.KV, accountId, body));
});

messages.put(
	"/signatures/:id",
	zValidator("param", SignatureIdParamSchema),
	zValidator("json", SignatureWriteSchema),
	async (c) => {
		const accountId = c.get("accountId");
		const { id } = c.req.valid("param");
		const body = c.req.valid("json");
		return resultToResponse(
			c,
			await messagesOpsService.updateSignature(c.env.KV, accountId, id, body),
		);
	},
);

messages.delete("/signatures/:id", zValidator("param", SignatureIdParamSchema), async (c) => {
	const accountId = c.get("accountId");
	const { id } = c.req.valid("param");
	return resultToResponse(c, await messagesOpsService.deleteSignature(c.env.KV, accountId, id));
});

// Etykiety
messages.post("/tags", zValidator("json", TagWriteSchema), async (c) => {
	const accountId = c.get("accountId");
	const input = c.req.valid("json");
	return resultToResponse(c, await messagesOpsService.createTag(c.env.KV, accountId, input));
});

messages.put(
	"/tags/:id",
	zValidator("param", TagIdParamSchema),
	zValidator("json", TagWriteSchema),
	async (c) => {
		const accountId = c.get("accountId");
		const { id } = c.req.valid("param");
		const input = c.req.valid("json");
		return resultToResponse(c, await messagesOpsService.updateTag(c.env.KV, accountId, id, input));
	},
);

messages.delete("/tags/:id", zValidator("param", TagIdParamSchema), async (c) => {
	const accountId = c.get("accountId");
	const { id } = c.req.valid("param");
	return resultToResponse(c, await messagesOpsService.deleteTag(c.env.KV, accountId, id));
});

// Grupy odbiorców
messages.post("/receivers/custom-groups", zValidator("json", GroupWriteSchema), async (c) => {
	const accountId = c.get("accountId");
	const { name } = c.req.valid("json");
	return resultToResponse(c, await messagesOpsService.createGroup(c.env.KV, accountId, name));
});

messages.put(
	"/receivers/custom-groups/:id",
	zValidator("param", TagIdParamSchema),
	zValidator("json", GroupWriteSchema),
	async (c) => {
		const accountId = c.get("accountId");
		const { id } = c.req.valid("param");
		const { name } = c.req.valid("json");
		return resultToResponse(c, await messagesOpsService.updateGroup(c.env.KV, accountId, id, name));
	},
);

messages.delete(
	"/receivers/custom-groups/:id",
	zValidator("param", TagIdParamSchema),
	async (c) => {
		const accountId = c.get("accountId");
		const { id } = c.req.valid("param");
		return resultToResponse(c, await messagesOpsService.deleteGroup(c.env.KV, accountId, id));
	},
);

// Kosz
messages.get("/trash", zValidator("query", MessagesPageQuerySchema), async (c) => {
	const accountId = c.get("accountId");
	const { page, limit } = c.req.valid("query");
	return resultToResponse(
		c,
		await messagesOpsService.getTrash(c.env.KV, accountId, { page, limit }),
	);
});

messages.post("/trash", zValidator("json", TrashBodySchema), async (c) => {
	const accountId = c.get("accountId");
	const { messageId } = c.req.valid("json");
	return resultToResponse(c, await messagesOpsService.moveToTrash(c.env.KV, accountId, messageId));
});

messages.put("/trash/:id/restore", zValidator("param", TrashIdParamSchema), async (c) => {
	const accountId = c.get("accountId");
	const { id } = c.req.valid("param");
	return resultToResponse(c, await messagesOpsService.restoreFromTrash(c.env.KV, accountId, id));
});

messages.delete("/trash/:id", zValidator("param", TrashIdParamSchema), async (c) => {
	const accountId = c.get("accountId");
	const { id } = c.req.valid("param");
	return resultToResponse(c, await messagesOpsService.deletePermanently(c.env.KV, accountId, id));
});

// Załączniki
messages.post("/attachments/storage", async (c) => {
	const accountId = c.get("accountId");
	return resultToResponse(c, await messagesOpsService.createStorage(c.env.KV, accountId));
});

messages.post("/attachments", zValidator("form", AttachmentUploadSchema), async (c) => {
	const accountId = c.get("accountId");
	const { storageId, fileToStore: file, temporaryFileId } = c.req.valid("form");
	const bytes = await file.arrayBuffer();
	return resultToResponse(
		c,
		await messagesOpsService.uploadFile(
			c.env.KV,
			accountId,
			{ name: file.name, contentType: file.type || "application/octet-stream", bytes },
			storageId,
			temporaryFileId ?? crypto.randomUUID(),
		),
	);
});

messages.delete(
	"/attachments/:fileId/storage/:storageId",
	zValidator("param", AttachmentDeleteParamSchema),
	async (c) => {
		const accountId = c.get("accountId");
		const { fileId, storageId } = c.req.valid("param");
		return resultToResponse(
			c,
			await messagesOpsService.deleteFile(c.env.KV, accountId, fileId, storageId),
		);
	},
);

function resultToResponse<T>(c: Context, result: Result<T>) {
	if (!result.ok) {
		const status = result.error.status;
		const httpStatus = (status >= 400 && status <= 599 ? status : 500) as ContentfulStatusCode;
		return c.json({ error: result.error.message, code: result.error.code }, httpStatus);
	}
	return c.json(result.data);
}

export { messages };

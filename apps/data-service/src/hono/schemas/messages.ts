import { z } from "zod";

/** Pagination of the inbox/outbox lists: `page` from 1, `limit` 1-50. */
export const MessagesPageQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** One recipient: M receiver type id + the M accountId. */
export const ReceiverEntrySchema = z.object({
	typeId: z.string().min(1).max(64),
	accountId: z.string().min(1).max(32),
});

/** Draft body: receivers, topic, content, optional storage (files ride later). */
export const DraftWriteSchema = z.object({
	receivers: z.array(ReceiverEntrySchema).max(50),
	topic: z.string().max(255),
	content: z.string().max(20000),
	storageId: z.string().max(64).nullable(),
});

/** Create body: a draft plus optional reply/forward context (ids as strings). */
export const DraftCreateSchema = DraftWriteSchema.extend({
	repliedToMessageId: z.string().max(32).optional(),
	forwardedMessageId: z.string().max(32).optional(),
});

/** A send = a draft body + category + optional reply/forward context (strings). */
export const SendMessageSchema = DraftCreateSchema.extend({
	category: z.string().max(32).default("normal"),
});

/** Variant of the draft being edited — keys the update route (newOne/reply/forward). */
export const DraftVariantSchema = z.enum(["newOne", "reply", "forward"]);

/** GET /receivers?type= — which receiver type's people to list. */
export const ReceiverListQuerySchema = z.object({ type: z.string().min(1).max(64) });

/** Draft id path param. */
export const DraftIdParamSchema = z.object({ id: z.string().min(1).max(32) });

/** PUT /drafts/:variant/:id — variant (newOne/reply/forward) + draft id. */
export const DraftUpdateParamSchema = z.object({
	variant: DraftVariantSchema,
	id: z.string().min(1).max(32),
});

/** Signature create/modify body (fields of the Librus form). */
export const SignatureWriteSchema = z.object({
	name: z.string().min(1).max(100),
	content: z.string().max(5000),
	defaultForNewThreads: z.boolean().default(false),
	defaultForReplies: z.boolean().default(false),
});

/** Signature id path param. */
export const SignatureIdParamSchema = z.object({ id: z.string().min(1).max(32) });

/** Tag create/rename body (color = CSS color NAME, per the official form). */
export const TagWriteSchema = z.object({
	name: z.string().min(1).max(64),
	colorRgb: z.string().min(3).max(20),
});

/** Tag / group id path param. */
export const TagIdParamSchema = z.object({ id: z.string().min(1).max(32) });

/** Custom receiver group create/rename body (audited client contract: `{name}`). */
export const GroupWriteSchema = z.object({ name: z.string().min(1).max(64) });

/** POST /trash — move the message to the trash bin. */
export const TrashBodySchema = z.object({ messageId: z.string().min(1).max(32) });

/** PUT /trash/:id/restore + DELETE /trash/:id — trash id param. */
export const TrashIdParamSchema = z.object({ id: z.string().min(1).max(32) });

/**
 * POST /attachments multipart form: the Librus storageId plus the file.
 * `temporaryFileId` is optional — the proxy generates one when absent.
 */
export const AttachmentUploadSchema = z.object({
	storageId: z.string().min(1).max(64),
	fileToStore: z.instanceof(File),
	temporaryFileId: z.string().max(64).optional(),
});

/** DELETE /attachments/:fileId/storage/:storageId — remove one uploaded file. */
export const AttachmentDeleteParamSchema = z.object({
	fileId: z.string().min(1).max(64),
	storageId: z.string().min(1).max(64),
});

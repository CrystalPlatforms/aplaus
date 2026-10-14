/**
 * Messages proxy routes (M): folders with pagination, message detail, unread counter, tags and receiver dictionaries.
 */

import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { requireDevice } from "../middleware/device-auth";
import { MessagesPageQuerySchema } from "../schemas/messages";
import * as messagesService from "../services/messages-service";
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

messages.get("/receivers/types", async (c) => {
	const accountId = c.get("accountId");
	return resultToResponse(c, await messagesService.getReceiverTypes(c.env.KV, accountId));
});

messages.get("/receivers/custom-groups", async (c) => {
	const accountId = c.get("accountId");
	return resultToResponse(c, await messagesService.getCustomGroups(c.env.KV, accountId));
});

function resultToResponse<T>(c: Context, result: Result<T>) {
	if (!result.ok) {
		const status = result.error.status;
		const httpStatus = (status >= 400 && status <= 599 ? status : 500) as ContentfulStatusCode;
		return c.json({ error: result.error.message, code: result.error.code }, httpStatus);
	}
	return c.json(result.data);
}

export { messages };

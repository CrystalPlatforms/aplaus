import { z } from "zod";

/** Pagination of the inbox/outbox lists: `page` from 1, `limit` 1-50. */
export const MessagesPageQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type MessagesPageQuery = z.infer<typeof MessagesPageQuerySchema>;

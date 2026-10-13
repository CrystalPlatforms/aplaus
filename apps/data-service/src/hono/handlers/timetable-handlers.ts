/**
 * Timetable + calendar proxy routes, authorized by the device token.
 */
import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { requireDevice } from "../middleware/device-auth";
import * as timetableService from "../services/timetable-service";
import type { Result } from "../types/result";

const timetable = new Hono<{ Bindings: Env }>();
const calendar = new Hono<{ Bindings: Env }>();

const WeekStartQuerySchema = z.object({
	weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "weekStart ma format YYYY-MM-DD"),
});

timetable.get("/", requireDevice, zValidator("query", WeekStartQuerySchema), async (c) => {
	const accountId = c.get("accountId");
	const { weekStart } = c.req.valid("query");
	return resultToResponse(c, await timetableService.getTimetable(c.env.KV, accountId, weekStart));
});

calendar.get("/free-days", requireDevice, async (c) => {
	const accountId = c.get("accountId");
	return resultToResponse(c, await timetableService.getCalendar(c.env.KV, accountId));
});

function resultToResponse<T>(c: Context, result: Result<T>) {
	if (!result.ok) {
		const status = result.error.status;
		const httpStatus = (status >= 400 && status <= 599 ? status : 500) as ContentfulStatusCode;
		return c.json({ error: result.error.message, code: result.error.code }, httpStatus);
	}
	return c.json(result.data);
}

export { calendar, timetable };

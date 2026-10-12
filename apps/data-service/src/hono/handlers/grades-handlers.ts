/**
 * Grades proxy routes, authorized by the device token.
 */

import type { Context } from "hono";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { requireDevice } from "../middleware/device-auth";
import * as gradesService from "../services/grades-service";
import type { Result } from "../types/result";

const grades = new Hono<{ Bindings: Env }>();

grades.get("/", requireDevice, async (c) => {
	const accountId = c.get("accountId");
	return resultToResponse(c, await gradesService.getGrades(c.env.KV, accountId));
});

function resultToResponse<T>(c: Context, result: Result<T>) {
	if (!result.ok) {
		const status = result.error.status;
		const httpStatus = (status >= 400 && status <= 599 ? status : 500) as ContentfulStatusCode;
		return c.json({ error: result.error.message, code: result.error.code }, httpStatus);
	}
	return c.json(result.data);
}

export { grades };

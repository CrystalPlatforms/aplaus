/**
 * School-domain proxy routes: school meta, notices, notes, conferences,
 * lessons and justifications (role-gated).
 */
import type { Context } from "hono";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { requireDevice } from "../middleware/device-auth";
import * as schoolService from "../services/school-service";
import type { Result } from "../types/result";

const school = new Hono<{ Bindings: Env }>();

school.get("/overview", requireDevice, async (c) => {
	const accountId = c.get("accountId");
	return resultToResponse(c, await schoolService.getSchoolOverview(c.env.KV, accountId));
});

school.get("/notices", requireDevice, async (c) => {
	const accountId = c.get("accountId");
	return resultToResponse(c, await schoolService.getSchoolNotices(c.env.KV, accountId));
});

school.get("/notes", requireDevice, async (c) => {
	const accountId = c.get("accountId");
	return resultToResponse(c, await schoolService.getNotes(c.env.KV, accountId));
});

school.get("/conferences", requireDevice, async (c) => {
	const accountId = c.get("accountId");
	return resultToResponse(c, await schoolService.getConferences(c.env.KV, accountId));
});

school.get("/justifications", requireDevice, async (c) => {
	const accountId = c.get("accountId");
	return resultToResponse(c, await schoolService.getJustifications(c.env.KV, accountId));
});

function resultToResponse<T>(c: Context, result: Result<T>) {
	if (!result.ok) {
		const status = result.error.status;
		const httpStatus = (status >= 400 && status <= 599 ? status : 500) as ContentfulStatusCode;
		return c.json({ error: result.error.message, code: result.error.code }, httpStatus);
	}
	return c.json(result.data);
}

export { school };

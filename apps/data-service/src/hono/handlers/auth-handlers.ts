import { zValidator } from "@hono/zod-validator";
import { type Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { requireDevice } from "../middleware/device-auth";
import { rateLimiter } from "../middleware/rate-limiter";
import { LoginRequestSchema } from "../schemas/auth";
import * as authService from "../services/auth-service";
import type { Result } from "../types/result";

/**
 * `/api` routes: login (rate limited), me (device-token), later more.
 */
const api = new Hono<{ Bindings: Env }>();

api.post(
	"/login",
	rateLimiter("RATE_LIMIT_AUTH", { windowSeconds: 60 }),
	zValidator("json", LoginRequestSchema),
	async (c) => {
		const { login, password } = c.req.valid("json");
		const result = await authService.login(c.env, { login, password });
		return resultToResponse(c, result, 201);
	},
);

api.get("/me", requireDevice, async (c) => {
	const accountId = c.get("accountId");
	return resultToResponse(c, await authService.getMe(c.env.KV, accountId));
});

function resultToResponse<T>(
	c: Context,
	result: Result<T>,
	successStatus: ContentfulStatusCode = 200,
) {
	if (!result.ok) {
		const status = result.error.status;
		const httpStatus = (status >= 400 && status <= 599 ? status : 500) as ContentfulStatusCode;
		return c.json({ error: result.error.message, code: result.error.code }, httpStatus);
	}
	return c.json(result.data, successStatus);
}

export { api };

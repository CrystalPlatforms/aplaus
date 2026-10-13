import { zValidator } from "@hono/zod-validator";
import { type Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { requireDevice } from "../middleware/device-auth";
import { rateLimiter } from "../middleware/rate-limiter";
import { LoginRequestSchema, SwitchAccountRequestSchema } from "../schemas/auth";
import * as authService from "../services/auth-service";
import type { Result } from "../types/result";

/**
 * `/api` routes: login (rate limited; an existing device token adds a second
 * account), me, accounts list/switch/refresh (device-token protected).
 */
const api = new Hono<{ Bindings: Env }>();

api.post(
	"/login",
	rateLimiter("RATE_LIMIT_AUTH", { windowSeconds: 60 }),
	zValidator("json", LoginRequestSchema),
	async (c) => {
		const { login, password } = c.req.valid("json");
		const deviceToken = c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
		const result = await authService.login(c.env, { login, password }, deviceToken);
		return resultToResponse(c, result, 201);
	},
);

api.get("/me", requireDevice, async (c) => {
	const accountId = c.get("accountId");
	return resultToResponse(c, await authService.getMe(c.env.KV, accountId));
});

api.get("/accounts", requireDevice, async (c) => {
	const deviceToken = c.get("deviceToken");
	return resultToResponse(c, await authService.listAccounts(c.env.KV, deviceToken));
});

api.post(
	"/accounts/switch",
	requireDevice,
	zValidator("json", SwitchAccountRequestSchema),
	async (c) => {
		const deviceToken = c.get("deviceToken");
		const { accountId } = c.req.valid("json");
		return resultToResponse(c, await authService.switchAccount(c.env.KV, deviceToken, accountId));
	},
);

api.post(
	"/accounts/refresh",
	rateLimiter("RATE_LIMIT_AUTH", { windowSeconds: 60 }),
	requireDevice,
	zValidator("json", LoginRequestSchema),
	async (c) => {
		const deviceToken = c.get("deviceToken");
		const { login, password } = c.req.valid("json");
		return resultToResponse(
			c,
			await authService.refreshAccount(c.env, { login, password }, deviceToken),
		);
	},
);

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

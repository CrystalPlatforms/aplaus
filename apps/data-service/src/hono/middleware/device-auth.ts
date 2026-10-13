import type { MiddlewareHandler } from "hono";
import { activeAccountIdOf, loadDevice } from "@/kv/store";

declare module "hono" {
	interface ContextVariableMap {
		accountId: string;
		deviceToken: string;
	}
}

/**
 * Device-token auth: `Authorization: Bearer <token>` resolved against KV.
 * 401 with a Polish message when the token is missing or unknown. The context
 * gets both the device token and the active account id — every proxy route
 * reads data in the active account's context.
 */
export const requireDevice: MiddlewareHandler = async (c, next) => {
	const header = c.req.header("authorization");
	const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
	if (!token) {
		return c.json({ error: "Wymagane zalogowanie.", code: "UNAUTHORIZED" }, 401);
	}
	const device = await loadDevice(c.env.KV, token);
	if (!device) return c.json({ error: "Wymagane zalogowanie.", code: "UNAUTHORIZED" }, 401);
	const accountId = activeAccountIdOf(device);
	if (!accountId) {
		return c.json({ error: "Wymagane zalogowanie.", code: "UNAUTHORIZED" }, 401);
	}
	c.set("deviceToken", token);
	c.set("accountId", accountId);
	await next();
};

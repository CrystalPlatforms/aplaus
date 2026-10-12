import type { MiddlewareHandler } from "hono";
import { loadDevice } from "@/kv/store";

declare module "hono" {
	interface ContextVariableMap {
		accountId: string;
	}
}

/**
 * Device-token auth: `Authorization: Bearer <token>` resolved against KV.
 * 401 with a Polish message when the token is missing or unknown.
 */
export const requireDevice: MiddlewareHandler = async (c, next) => {
	const header = c.req.header("authorization");
	const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
	if (!token) {
		return c.json({ error: "Wymagane zalogowanie.", code: "UNAUTHORIZED" }, 401);
	}
	const device = await loadDevice(c.env.KV, token);
	if (!device) return c.json({ error: "Wymagane zalogowanie.", code: "UNAUTHORIZED" }, 401);
	const first = device.accountIds[0];
	if (!first) {
		return c.json({ error: "Wymagane zalogowanie.", code: "UNAUTHORIZED" }, 401);
	}
	c.set("accountId", first);
	await next();
};

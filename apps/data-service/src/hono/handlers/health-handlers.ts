import { Hono } from "hono";
import { rateLimiter } from "../middleware/rate-limiter";
import { checkKv } from "../services/health-service";

const health = new Hono<{ Bindings: Env }>();

health.get("/live", (c) => {
	return c.json({ status: "ok", time: new Date().toISOString() });
});

health.get("/ready", rateLimiter("RATE_LIMIT_HEALTH", { windowSeconds: 60 }), async (c) => {
	const kv = await checkKv(c.env.KV);
	const ok = kv === "available";
	const body = {
		status: ok ? "ok" : "degraded",
		env: c.env.CLOUDFLARE_ENV,
		service: "aplaus-ds",
		time: new Date().toISOString(),
		kv,
	};
	return c.json(body, ok ? 200 : 503);
});

export default health;

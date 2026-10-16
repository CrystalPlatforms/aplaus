/**
 * Push endpoints: VAPID public key for the browser subscription, device
 * subscription register/unregister, per-type preferences. All device-token
 * authenticated; preferences and subscriptions are per active account.
 */

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireDevice } from "../middleware/device-auth";
import { PushPreferencesSchema, PushSubscriptionSchema } from "../schemas/push";
import {
	getPreferences,
	getVapidPublicKey,
	registerSubscription,
	unregisterSubscription,
	updatePreferences,
} from "../services/push-service";

export const push = new Hono<{ Bindings: Env }>();

push.get("/public-key", requireDevice, (c) => {
	const publicKey = getVapidPublicKey(c.env);
	if (!publicKey) {
		return c.json({ error: "Powiadomienia nie są skonfigurowane na serwerze." }, 503);
	}
	return c.json({ publicKey });
});

push.post(
	"/subscriptions",
	requireDevice,
	zValidator("json", PushSubscriptionSchema),
	async (c) => {
		const accountId = c.get("accountId");
		const body = c.req.valid("json");
		await registerSubscription(c.env.KV, accountId, {
			...body,
			createdAt: new Date().toISOString(),
		});
		return c.json({ ok: true }, 201);
	},
);

push.delete("/subscriptions", requireDevice, async (c) => {
	const accountId = c.get("accountId");
	const endpoint = c.req.query("endpoint");
	if (!endpoint) return c.json({ error: "Brak parametru endpoint." }, 400);
	await unregisterSubscription(c.env.KV, accountId, endpoint);
	return c.body(null, 204);
});

push.get("/preferences", requireDevice, async (c) => {
	const accountId = c.get("accountId");
	return c.json(await getPreferences(c.env.KV, accountId));
});

push.put("/preferences", requireDevice, zValidator("json", PushPreferencesSchema), async (c) => {
	const accountId = c.get("accountId");
	const preferences = c.req.valid("json");
	return c.json(await updatePreferences(c.env.KV, accountId, preferences));
});

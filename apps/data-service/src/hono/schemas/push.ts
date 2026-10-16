/** Request schemas for the push endpoints. */
import { z } from "zod";
import { PUSH_TYPES } from "@/kv/push-store";

/** The browser PushSubscription.toJSON() shape the client posts verbatim. */
export const PushSubscriptionSchema = z.object({
	endpoint: z.string().url(),
	keys: z.object({
		p256dh: z.string().min(1),
		auth: z.string().min(1),
	}),
});

/** All eight switches at once (PUT replaces the whole set). */
export const PushPreferencesSchema = z.object(
	Object.fromEntries(PUSH_TYPES.map((type) => [type, z.boolean()])) as Record<
		(typeof PUSH_TYPES)[number],
		z.ZodBoolean
	>,
);

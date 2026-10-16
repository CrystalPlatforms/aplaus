/**
 * Push endpoint services: VAPID public key, subscription (un)registration
 * and per-type preferences. The web-push sender itself lives here too —
 * generatePushHTTPRequest is pure WebCrypto (Workers-safe); the actual HTTP
 * POST goes through injected fetch, so tests mock at the boundary.
 */
import { ApplicationServerKeys, generatePushHTTPRequest } from "webpush-webcrypto";
import {
	deletePushSubscription,
	loadPushPreferences,
	type PushPreferences,
	type PushSubscriptionRecord,
	savePushPreferences,
	savePushSubscription,
} from "@/kv/push-store";
import type { PushPayload } from "./push-poller";

/** Poller-facing sender: encrypt+sign via webpush-webcrypto, POST by fetch. */
export async function sendPushNotification(
	env: Env,
	subscription: PushSubscriptionRecord,
	payload: PushPayload,
): Promise<{ gone: boolean }> {
	if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return { gone: false };
	const applicationServerKeys = await ApplicationServerKeys.fromJSON({
		publicKey: env.VAPID_PUBLIC_KEY,
		privateKey: env.VAPID_PRIVATE_KEY,
	});
	const request = await generatePushHTTPRequest({
		applicationServerKeys,
		payload: JSON.stringify(payload),
		target: {
			endpoint: subscription.endpoint,
			keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
		},
		urgency: "normal",
		ttl: 3600,
	});
	const response = await fetch(request.endpoint, {
		method: "POST",
		headers: request.headers,
		body: request.body,
	});
	// 404/410 = the browser dropped this subscription (reinstall, profile
	// reset): remove it so the cron stops writing to a dead endpoint.
	return { gone: response.status === 404 || response.status === 410 };
}

/** The VAPID public key, or null when the secrets are not configured. */
export function getVapidPublicKey(env: Env): string | null {
	if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null;
	return env.VAPID_PUBLIC_KEY;
}

export async function registerSubscription(
	kv: KVNamespace,
	accountId: string,
	record: PushSubscriptionRecord,
): Promise<void> {
	await savePushSubscription(kv, accountId, record);
}

export async function unregisterSubscription(
	kv: KVNamespace,
	accountId: string,
	endpoint: string,
): Promise<void> {
	await deletePushSubscription(kv, accountId, endpoint);
}

export async function getPreferences(kv: KVNamespace, accountId: string): Promise<PushPreferences> {
	return loadPushPreferences(kv, accountId);
}

export async function updatePreferences(
	kv: KVNamespace,
	accountId: string,
	preferences: PushPreferences,
): Promise<PushPreferences> {
	await savePushPreferences(kv, accountId, preferences);
	return preferences;
}

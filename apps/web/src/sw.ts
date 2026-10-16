/**
 * Service worker (vite-plugin-pwa injectManifest strategy): precaches the app
 * shell so a cold start works offline, and handles web push (issue #13).
 * API data is never precached — it lives in the IndexedDB offline cache.
 */
/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope;

// In dev the plugin serves this file untransformed and __WB_MANIFEST is
// undefined — the ?? [] keeps the worker alive for push handlers there.
precacheAndRoute(self.__WB_MANIFEST ?? []);
cleanupOutdatedCaches();

// injectManifest authoring: autoUpdate activation is on us. skipWaiting
// activates a new worker immediately (no version stuck in "waiting"),
// clientsClaim lets it control open tabs at once.
self.skipWaiting();
clientsClaim();

interface PushPayload {
	title: string;
	body: string;
	/** In-app deep link, e.g. "/grades" — set by the server's poller. */
	url?: string;
}

self.addEventListener("push", (event) => {
	const payload = readPayload(event);
	event.waitUntil(
		self.registration.showNotification(payload.title, {
			body: payload.body,
			icon: "/icon-192.png",
			badge: "/icon-192.png",
			// One notification per target view: a newer one replaces a stale one
			// instead of stacking duplicates on the lock screen.
			tag: payload.url ?? "aplaus",
			data: { url: payload.url ?? "/" },
		}),
	);
});

function readPayload(event: PushEvent): PushPayload {
	try {
		const raw = event.data?.json() as Partial<PushPayload> | undefined;
		if (raw?.title && raw?.body) return { title: raw.title, body: raw.body, url: raw.url };
	} catch {
		/* malformed payload — fall through to the generic copy */
	}
	return { title: "Aplaus", body: "Nowe zdarzenie w Librusie.", url: "/" };
}

self.addEventListener("notificationclick", (event) => {
	const target = (event.notification.data as { url?: string } | undefined)?.url ?? "/";
	event.notification.close();
	event.waitUntil(focusOrNavigate(target));
});

/**
 * Focuses an open window and tells it to navigate; opens a new one otherwise.
 * focus() can reject (window state quirks) — the message must go out
 * regardless, or the tap "does nothing".
 */
async function focusOrNavigate(url: string): Promise<void> {
	const windowClients = await self.clients.matchAll({
		type: "window",
		includeUncontrolled: true,
	});
	// Prefer an already visible tab, fall back to any client of this worker.
	const target =
		windowClients.find((client) => client.visibilityState === "visible") ?? windowClients[0];
	if (target) {
		try {
			await target.focus();
		} catch {
			/* focus is best-effort — navigation still happens below */
		}
		target.postMessage({ type: "aplaus:navigate", url });
		return;
	}
	await self.clients.openWindow(url);
}

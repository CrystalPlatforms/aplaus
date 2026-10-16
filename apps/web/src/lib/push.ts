/**
 * Web push client: VAPID key from the server, service-worker pushManager
 * subscription, per-type preferences. iOS grants push only to an installed
 * PWA — the notifications screen shows the hint before requesting.
 */
import { apiFetch } from "./api";

/** The 8 notification switches (mirror of the server's PushPreferences). */
export interface PushPreferencesState {
	grades: boolean;
	messages: boolean;
	notices: boolean;
	attendance: boolean;
	homework: boolean;
	notes: boolean;
	timetable: boolean;
	conferences: boolean;
}

export const PUSH_TYPE_LABELS: Record<keyof PushPreferencesState, string> = {
	grades: "Oceny",
	messages: "Wiadomości (nowe w skrzynce)",
	notices: "Ogłoszenia szkolne",
	attendance: "Frekwencja",
	homework: "Zadania domowe",
	notes: "Uwagi",
	timetable: "Zmiany w planie lekcji",
	conferences: "Zebrania z rodzicami",
};

/** VAPID base64url -> bytes the pushManager API expects. */
function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
	const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
	const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
	const raw = atob(base64);
	// Explicit ArrayBuffer: the pushManager types demand BufferSource over a
	// real ArrayBuffer, not an ArrayBufferLike view.
	const buffer = new ArrayBuffer(raw.length);
	const output = new Uint8Array(buffer);
	for (let i = 0; i < raw.length; i++) {
		output[i] = raw.charCodeAt(i);
	}
	return output;
}

/** Rejects with `message` when `promise` does not settle within `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(message)), ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error: unknown) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}

/**
 * Requests browser permission (caller does it first if it wants a dedicated
 * prompt), subscribes the service worker and registers the subscription
 * under the active account. Throws with a Polish message when any step is
 * unsupported or stalls — the toggle never hangs on "Włączanie…".
 */
export async function subscribeToPush(): Promise<void> {
	if (typeof Notification === "undefined" || typeof navigator.serviceWorker === "undefined") {
		throw new Error(
			"Ta przeglądarka nie obsługuje powiadomień push (na iPhonie — najpierw zainstaluj aplikację).",
		);
	}
	const permission = await Notification.requestPermission();
	if (permission !== "granted") {
		throw new Error("Powiadomienia zostały zablokowane w ustawieniach przeglądarki.");
	}
	// serviceWorker.ready waits for an ACTIVE worker — without a timeout a dev
	// server without the SW would hang here forever.
	const registration = await withTimeout(
		navigator.serviceWorker.ready,
		8000,
		"Nie udało się zarejestrować serwisu — odśwież stronę i spróbuj ponownie.",
	);
	const { publicKey } = await apiFetch<{ publicKey: string }>("/api/push/public-key");
	const existing = await registration.pushManager.getSubscription();
	const subscription =
		existing ??
		(await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(publicKey),
		}));
	try {
		await apiFetch("/api/push/subscriptions", {
			method: "POST",
			body: JSON.stringify(subscription.toJSON()),
		});
	} catch (error) {
		// All-or-nothing: a server-side failure must not leave the browser
		// subscribed — the toggle would show "Włączone" with nothing in KV.
		await subscription.unsubscribe().catch(() => {});
		throw error;
	}
}

/** Unregisters on the server and in the browser. */
export async function unsubscribeToPush(): Promise<void> {
	const registration = await navigator.serviceWorker.ready;
	const subscription = await registration.pushManager.getSubscription();
	if (!subscription) return;
	await apiFetch(`/api/push/subscriptions?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
		method: "DELETE",
	});
	await subscription.unsubscribe();
}

export async function getPushPreferences(): Promise<PushPreferencesState> {
	return apiFetch<PushPreferencesState>("/api/push/preferences");
}

export async function savePushPreferences(
	preferences: PushPreferencesState,
): Promise<PushPreferencesState> {
	return apiFetch<PushPreferencesState>("/api/push/preferences", {
		method: "PUT",
		body: JSON.stringify(preferences),
	});
}

/** True when the app runs as an installed PWA (push requirement on iOS). */
export function isStandalone(): boolean {
	return window.matchMedia("(display-mode: standalone)").matches;
}

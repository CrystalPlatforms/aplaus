/**
 * Przełączniki powiadomień (faza 6): Radix Switch (`ui/switch.tsx`) zamiast
 * ręcznych przełączników. Założenia sesji /tdd 23,24:
 * - granica mocków = `@/lib/push` (serwer preferencji + service worker) oraz
 *   `navigator.serviceWorker` (nie istnieje w jsdom);
 * - ekran renderuje 9 przełączników: główny subskrypcji + 8 typów zdarzeń,
 *   każdy `role="switch"` + `aria-checked` z aktualnego stanu;
 * - kliknięcie przełącznika typu odwraca jedną preferencję i zapisuje PEŁNY
 *   stan przez `savePushPreferences` (jak dotychczas);
 * - rollback przy błędzie zapisu NIE jest testowany w tej iteracji;
 * - przy braku subskrypcji przełączniki typów są nieaktywne, główny włącza
 *   subskrypcję (`subscribeToPush`).
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUSH_TYPE_LABELS, type PushPreferencesState } from "@/lib/push";

const pushMock = vi.hoisted(() => ({
	subscribeToPush: vi.fn(),
	unsubscribeToPush: vi.fn(),
	getPushPreferences: vi.fn(),
	savePushPreferences: vi.fn(),
	isStandalone: vi.fn(() => true),
}));
vi.mock("@/lib/push", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/push")>();
	return { ...actual, ...pushMock };
});

import { NotificationsScreen } from "./NotificationsScreen";

const PREFS: PushPreferencesState = {
	grades: true,
	messages: false,
	notices: true,
	attendance: true,
	homework: true,
	notes: true,
	timetable: true,
	conferences: true,
};

function stubSubscription(subscribed: boolean) {
	const registration = {
		pushManager: { getSubscription: async () => (subscribed ? { endpoint: "x" } : null) },
	};
	Object.defineProperty(navigator, "serviceWorker", {
		value: { getRegistration: async () => registration },
		configurable: true,
	});
}

function renderNotifications() {
	return render(<NotificationsScreen />);
}

describe("NotificationsScreen switches", () => {
	beforeEach(() => {
		pushMock.subscribeToPush.mockReset().mockResolvedValue(undefined);
		pushMock.unsubscribeToPush.mockReset().mockResolvedValue(undefined);
		pushMock.getPushPreferences.mockReset().mockResolvedValue(PREFS);
		pushMock.savePushPreferences.mockReset().mockResolvedValue(undefined);
	});

	it("renders a role=switch with aria-checked from preferences for the subscription and all 8 types", async () => {
		stubSubscription(true);
		renderNotifications();

		const main = await screen.findByRole("switch", {
			name: "Powiadomienia push na tym urządzeniu",
		});
		expect(main.getAttribute("aria-checked")).toBe("true");

		for (const [type, label] of Object.entries(PUSH_TYPE_LABELS)) {
			const sw = screen.getByRole("switch", { name: label });
			expect(sw.getAttribute("aria-checked")).toBe(
				String(PREFS[type as keyof PushPreferencesState]),
			);
		}
	});

	it("clicking a type switch flips that preference and saves the full state", async () => {
		stubSubscription(true);
		renderNotifications();

		const messages = await screen.findByRole("switch", { name: PUSH_TYPE_LABELS.messages });
		expect(messages.getAttribute("aria-checked")).toBe("false");
		fireEvent.click(messages);

		await waitFor(() =>
			expect(pushMock.savePushPreferences).toHaveBeenCalledWith({ ...PREFS, messages: true }),
		);
		await waitFor(() => expect(messages.getAttribute("aria-checked")).toBe("true"));
	});

	it("without a subscription type switches are disabled; the main switch subscribes", async () => {
		stubSubscription(false);
		renderNotifications();

		const main = await screen.findByRole("switch", {
			name: "Powiadomienia push na tym urządzeniu",
		});
		expect(main.getAttribute("aria-checked")).toBe("false");
		expect(
			screen.getByRole("switch", { name: PUSH_TYPE_LABELS.grades }).hasAttribute("disabled"),
		).toBe(true);

		fireEvent.click(main);
		await waitFor(() => expect(pushMock.subscribeToPush).toHaveBeenCalledTimes(1));
	});
});

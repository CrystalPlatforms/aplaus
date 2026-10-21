/** OfflineBanner: shows on the offline-fallback event, hides on restore. */
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { API_OFFLINE_USED_EVENT, API_RESTORED_EVENT } from "@/lib/api";
import { OfflineBanner } from "./OfflineBanner";

afterEach(() => {
	for (const event of [API_OFFLINE_USED_EVENT, API_RESTORED_EVENT]) {
		window.dispatchEvent(new CustomEvent(event));
		window.dispatchEvent(new CustomEvent(event));
	}
	// Leave the banner hidden for the next test (restored hides it).
});

describe("OfflineBanner", () => {
	it("is hidden while online and nothing fell back", () => {
		render(<OfflineBanner />);
		expect(screen.queryByRole("status")).toBeNull();
	});

	it("shows on the offline-fallback event with the short copy", () => {
		render(<OfflineBanner />);
		act(() => window.dispatchEvent(new CustomEvent(API_OFFLINE_USED_EVENT)));
		const banner = screen.getByRole("status");
		expect(banner.textContent).toContain("Brak połączenia z internetem");
	});

	it("hides again when the API connection is restored", () => {
		render(<OfflineBanner />);
		act(() => window.dispatchEvent(new CustomEvent(API_OFFLINE_USED_EVENT)));
		expect(screen.getByRole("status")).toBeTruthy();
		act(() => window.dispatchEvent(new CustomEvent(API_RESTORED_EVENT)));
		expect(screen.queryByRole("status")).toBeNull();
	});
});

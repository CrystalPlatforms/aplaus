/**
 * Desktop sidebar (md+): full navigation to existing routes with the unread
 * badge; hidden below md (complementary classes to the bottom bar).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouterProvider } from "@/lib/router";
import { Sidebar } from "./Sidebar";

describe("Sidebar (md+)", () => {
	it("renders the full navigation to existing routes, hidden below md", () => {
		const { container } = render(
			<RouterProvider>
				<Sidebar unread={2} onSwitchAccount={() => {}} />
			</RouterProvider>,
		);
		const aside = container.querySelector("aside");
		expect(aside?.className).toContain("hidden");
		expect(aside?.className).toContain("md:flex");
		const esc = (s: string) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
		for (const label of [
			"Start",
			"Oceny",
			"Plan",
			"Wiadomości",
			"Więcej",
			"Zadania domowe",
			"Frekwencja",
			"Ogłoszenia",
			"Uwagi",
			"Zebrania z rodzicami",
			"Szkoła i klasa",
			"Wiadomości — ustawienia",
			"Instalacja aplikacji",
			"Powiadomienia push",
		]) {
			// Adjacent inline spans flatten without a space in the computed name
			// ("Start" + badge "2" → "Start2"), so the separator is optional.
			expect(
				screen.getByRole("button", { name: new RegExp(`^${esc(label)}\\s*(\\d+)?$`) }),
			).toBeTruthy();
		}
		const wiadomosci = screen.getByRole("button", { name: /^Wiadomości\s*(\d+)?$/ });
		expect(wiadomosci.textContent).toContain("2");
	});
});

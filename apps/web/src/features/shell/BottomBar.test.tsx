/**
 * Mobile bottom bar (< md): icon + label per tab, active tab on the primary
 * token, unread badge; hidden from md up (where the sidebar takes over).
 * The desktop sidebar ships the complementary classes in the same DOM.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouterProvider } from "@/lib/router";
import { BottomBar } from "./BottomBar";

function renderBar(activeTab: string, badge: number) {
	return render(
		<RouterProvider>
			<BottomBar activeTab={activeTab} badge={badge} />
		</RouterProvider>,
	);
}

describe("BottomBar", () => {
	it("renders an icon and a label for every tab, hidden from md up", () => {
		const { container } = renderBar("start", 0);
		for (const label of ["Start", "Oceny", "Plan", "Wiadomości", "Więcej"]) {
			const button = screen.getByRole("button", { name: label });
			// icon present inside the tab button
			expect(button.querySelector("svg")).toBeTruthy();
		}
		const nav = container.querySelector("nav");
		expect(nav?.className).toContain("md:hidden");
	});

	it("highlights the active tab with the primary token", () => {
		renderBar("plan", 0);
		const active = screen.getByRole("button", { name: "Plan" });
		expect(active.className).toContain("text-primary");
		const inactive = screen.getByRole("button", { name: "Oceny" });
		expect(inactive.className).not.toContain("text-primary");
	});

	it("shows the unread badge on Wiadomości when there are unread messages", () => {
		renderBar("start", 3);
		expect(screen.getByRole("img", { name: "3 nieprzeczytanych" }).textContent).toBe("3");
	});

	it("shows no badge when the unread count is zero", () => {
		renderBar("start", 0);
		expect(screen.queryByRole("img", { name: /nieprzeczytanych/ })).toBeNull();
	});
});

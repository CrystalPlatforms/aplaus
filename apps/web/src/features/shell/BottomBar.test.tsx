/**
 * Mobile bottom bar (< md): icon + label per tab, active tab on the primary
 * token, unread badge; hidden from md up (where the sidebar takes over).
 * The desktop sidebar ships the complementary classes in the same DOM.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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

	it("gives the tab icon a pressed scale (group-active) for click feedback", () => {
		renderBar("start", 0);
		const start = screen.getByRole("button", { name: "Start" });
		expect(start.className).toContain("group");
		const iconWrapper = start.querySelector("span.relative") as HTMLElement | null;
		expect(iconWrapper?.className).toContain("group-active:scale-90");
		expect(iconWrapper?.className).toContain("transition-transform");
	});
});

/**
 * Issue #28: na podstronie sekcji ikona tego taba staje się ←; klik cofa
 * (z fallbackiem na korzeń sekcji przy wejściu z deep-linka).
 */
describe("BottomBar back arrow on section subpages", () => {
	function openAt(path: string) {
		window.history.pushState({}, "", path);
		return render(
			<RouterProvider>
				<BottomBar activeTab="messages" badge={0} />
			</RouterProvider>,
		);
	}

	afterEach(() => {
		window.history.pushState({}, "", "/");
		cleanup();
	});

	it("keeps the section icon on the section root (no back arrow)", () => {
		openAt("/messages");
		// Bez historii klik nawiguje na korzeń — tu korzeń = obecna ścieżka,
		// więc po kliku path pozostaje /messages (pushState tej samej ścieżki).
		const button = screen.getByRole("button", { name: "Wiadomości" });
		expect(button).toBeTruthy();
		expect(button.querySelector("svg")).toBeTruthy();
	});

	it("deep-link subpage: clicking the section tab lands on the section root", () => {
		openAt("/messages/inbox/abc"); // history.state bez idx → brak historii
		fireEvent.click(screen.getByRole("button", { name: "Wiadomości" }));
		expect(window.location.pathname).toBe("/messages");
	});

	it("more subpage (/settings): Więcej click falls back to /more", () => {
		window.history.pushState({}, "", "/settings");
		render(
			<RouterProvider>
				<BottomBar activeTab="more" badge={0} />
			</RouterProvider>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Więcej" }));
		expect(window.location.pathname).toBe("/more");
	});

	it("with app history, section tab click goes back instead of pushing the root", () => {
		openAt("/messages");
		// Symulacja nawigacji w głąb: wpis /messages/inbox/abc z licznikiem idx.
		act(() => {
			window.history.pushState({ idx: 1 }, "", "/messages/inbox/abc");
			window.dispatchEvent(new PopStateEvent("popstate", { state: { idx: 1 } }));
		});

		fireEvent.click(screen.getByRole("button", { name: "Wiadomości" })); // history.back()
		// jsdom: back() jest asynchroniczne — czekamy na cofnięcie ścieżki.
		return waitFor(() => expect(window.location.pathname).toBe("/messages"));
	});
});

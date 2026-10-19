/**
 * DetailOverlay renders a Radix dialog whose CSS switches between a bottom
 * sheet (below md) and a centered preview (md+). The component ships both
 * class sets — one DOM, two breakpoints — so the tests assert the classes
 * per breakpoint and the closing paths (Escape, backdrop, X).
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DetailOverlay } from "./DetailOverlay";

function renderOverlay() {
	const onOpenChange = vi.fn();
	render(
		<DetailOverlay open onOpenChange={onOpenChange} title="Matematyka">
			<p>Szczegóły oceny</p>
		</DetailOverlay>,
	);
	return { onOpenChange };
}

describe("DetailOverlay", () => {
	it("exposes role=dialog with the accessible name taken from the visible title", () => {
		renderOverlay();
		const dialog = screen.getByRole("dialog", { name: "Matematyka" });
		expect(screen.getByText("Matematyka")).toBeTruthy();
		// Radix moves focus into the dialog on open (focus trap entry).
		expect(dialog.contains(document.activeElement)).toBe(true);
	});

	it("renders the bottom-sheet classes below md", () => {
		renderOverlay();
		const dialog = screen.getByRole("dialog") as HTMLElement;
		// Mobile sheet: docked to the bottom edge, rounded top, height-capped.
		expect(dialog.className).toContain("bottom-0");
		expect(dialog.className).toContain("rounded-t-xl");
		expect(dialog.className).toContain("max-h-[85dvh]");
		// The base DialogContent centers with -translate-1/2; the sheet must
		// reset it or the sheet renders half off-screen.
		expect(dialog.className).toContain("translate-x-0");
		expect(dialog.className).toContain("translate-y-0");
	});

	it("renders the centered preview classes from md up", () => {
		renderOverlay();
		const dialog = screen.getByRole("dialog") as HTMLElement;
		// Desktop preview: centered, ~90vw × ~85dvh.
		expect(dialog.className).toContain("md:top-1/2");
		expect(dialog.className).toContain("md:left-1/2");
		expect(dialog.className).toContain("md:w-[90vw]");
		expect(dialog.className).toContain("md:h-[85dvh]");
	});

	it("Escape closes through onOpenChange(false)", () => {
		const { onOpenChange } = renderOverlay();
		// The keydown bubbles to the document, where Radix listens.
		fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("clicking the backdrop closes through onOpenChange(false)", async () => {
		const { onOpenChange } = renderOverlay();
		await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
		// Radix attaches its document-level pointerdown listener in a
		// setTimeout(0) — wait for it before firing the dismiss sequence.
		await act(async () => {
			await new Promise((r) => setTimeout(r, 5));
		});
		const overlay = document.querySelector('[data-slot="dialog-overlay"]');
		expect(overlay).toBeTruthy();
		fireEvent.pointerDown(overlay as Element);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 5));
		});
		fireEvent.click(overlay as Element);
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
	});

	it("the header X closes through onOpenChange(false)", () => {
		const { onOpenChange } = renderOverlay();
		fireEvent.click(screen.getByRole("button", { name: "Zamknij" }));
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});

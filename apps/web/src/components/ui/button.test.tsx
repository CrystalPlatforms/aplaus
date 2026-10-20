/**
 * Button: pressed-state feedback (active scale, transparent tap-highlight)
 * and the variant classes the migrated screens rely on. Class assertions are
 * the contract here — the visual result is HITL-reviewed.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
	it("carries pressed scale and transparent tap-highlight as click feedback", () => {
		render(<Button>Zapisz</Button>);
		const btn = screen.getByRole("button", { name: "Zapisz" });
		expect(btn.className).toContain("active:scale-[0.98]");
		expect(btn.className).toContain("[-webkit-tap-highlight-color:transparent]");
		expect(btn.className).toContain("transition-all");
	});

	it("keeps the scale feedback on the outline variant too", () => {
		render(<Button variant="outline">Anuluj</Button>);
		const btn = screen.getByRole("button", { name: "Anuluj" });
		expect(btn.className).toContain("active:scale-[0.98]");
		expect(btn.className).toContain("border");
	});
});

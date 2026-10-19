/**
 * Mobile scale (faza 3): below md the document base font-size is bumped, from
 * md up it is standard. jsdom does not apply media queries, so the test pins
 * the rules in index.css — the browser behavior itself is verified in HITL.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(
	resolve(dirname(fileURLToPath(import.meta.url)), "../../index.css"),
	"utf8",
);

describe("mobile scale", () => {
	it("bumps the base font-size below md and restores the standard from md", () => {
		expect(css).toMatch(/html\s*\{[^}]*font-size:\s*106\.25%/);
		expect(css).toMatch(/@media \(min-width: 768px\)\s*\{[^@]*html\s*\{[^}]*font-size:\s*100%/);
	});

	it("leaves the md breakpoint scale untouched", () => {
		// The scale rule sits on html outside the Tailwind breakpoint config.
		expect(css).not.toMatch(/--breakpoint-md/);
	});
});

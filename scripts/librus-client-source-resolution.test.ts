import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");

// librus-client has no compile step: its exports point at TypeScript source,
// so data-service sees protocol changes immediately in type-checks and tests.
// The guard keeps that decision from eroding.
describe("the librus-client package resolves from source", () => {
	const pkg = JSON.parse(readFileSync(join(ROOT, "packages/librus-client/package.json"), "utf8"));

	it("points every export entry at TypeScript source under src/", () => {
		const entries = Object.values(pkg.exports ?? {});
		expect(entries.length).toBeGreaterThan(0);
		for (const entry of entries) {
			const target = typeof entry === "string" ? entry : entry.default;
			expect(target).toMatch(/^\.\/src\/.+\.ts$/);
		}
	});

	it("keeps noEmit, since consumers compile this source themselves", () => {
		const raw = readFileSync(join(ROOT, "packages/librus-client/tsconfig.json"), "utf8");
		expect(raw).toContain('"noEmit": true');
	});
});

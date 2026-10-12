import { resolve } from "node:path";
import { defineProject } from "vitest/config";

// The web suite runs in jsdom: component rendering needs a DOM, and the API
// boundary (apiFetch) is mocked in the tests — no real network anywhere.
export default defineProject({
	resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
	test: {
		globals: true,
		environment: "jsdom",
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
	},
});

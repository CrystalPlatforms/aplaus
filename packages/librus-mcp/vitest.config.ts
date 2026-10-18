import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "librus-mcp",
		include: ["src/**/*.test.ts"],
		// The tool-handler tests land with this change set; until then an empty
		// project must not fail the repo-wide run.
		passWithNoTests: true,
	},
});

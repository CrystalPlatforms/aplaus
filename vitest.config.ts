import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: [
			"packages/librus-client",
			"packages/librus-mcp",
			"apps/web",
			"apps/data-service",
			{
				test: {
					name: "repo-tooling",
					include: ["scripts/**/*.test.ts"],
				},
			},
		],
	},
});

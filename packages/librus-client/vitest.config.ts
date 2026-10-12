import { defineProject } from "vitest/config";

// This package talks plain fetch() with injectable dependencies and holds no
// runtime bindings, so the suite stays in Node — workerd would only cost
// startup time (the same reasoning the template applied to the data layer).
export default defineProject({
	test: {
		globals: true,
		include: ["src/**/*.test.ts"],
	},
});

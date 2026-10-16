/**
 * Shared jsdom setup. jsdom has no matchMedia; the theme system and the
 * boot script read it on mount. Tests can still override with vi.stubGlobal.
 */
import { vi } from "vitest";

vi.stubGlobal("matchMedia", (query: string) => ({
	matches: false,
	media: query,
	onchange: null,
	addEventListener: () => {},
	removeEventListener: () => {},
	addListener: () => {},
	removeListener: () => {},
}));

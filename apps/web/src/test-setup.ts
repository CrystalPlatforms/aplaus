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

/**
 * jsdom has no ResizeObserver; Radix primitives (and anything measuring
 * elements) need it on mount. The stub is a silent no-op — tests that care
 * about measurements override it with vi.stubGlobal.
 */
class ResizeObserverStub {
	observe(): void {}
	unobserve(): void {}
	disconnect(): void {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub);

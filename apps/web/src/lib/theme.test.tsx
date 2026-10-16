/**
 * The theme contract (issue #14): light/dark/system, the choice survives a
 * full remount (app restart), and system mode follows the OS live via
 * matchMedia. The single mechanism is the .dark class on <html>.
 */
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Theme, ThemeProvider, useTheme } from "./theme";

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => void storage.set(key, value),
	removeItem: (key: string) => void storage.delete(key),
	clear: () => void storage.clear(),
});

/** Controllable matchMedia: the test flips the OS preference through flipOs. */
const mediaListeners = new Set<() => void>();
let osPrefersDark = false;
vi.stubGlobal("matchMedia", (query: string) => ({
	matches: query.includes("dark") ? osPrefersDark : !osPrefersDark,
	addEventListener: (_: string, listener: () => void) => void mediaListeners.add(listener),
	removeEventListener: (_: string, listener: () => void) => void mediaListeners.delete(listener),
}));

function flipOs(dark: boolean): void {
	osPrefersDark = dark;
	for (const listener of mediaListeners) listener();
}

function hasDarkClass(): boolean {
	return document.documentElement.classList.contains("dark");
}

/** A probe that renders one button per theme so tests drive setTheme. */
function ThemeProbe() {
	const { theme, setTheme } = useTheme();
	return (
		<div>
			<span>current:{theme}</span>
			{(["light", "dark", "system"] as Theme[]).map((value) => (
				<button key={value} type="button" onClick={() => setTheme(value)}>
					set:{value}
				</button>
			))}
		</div>
	);
}

function renderTheme() {
	return render(
		<ThemeProvider>
			<ThemeProbe />
		</ThemeProvider>,
	);
}

beforeEach(() => {
	storage.clear();
	mediaListeners.clear();
	osPrefersDark = false;
	document.documentElement.classList.remove("dark");
});

describe("theme", () => {
	it("system mode follows the OS at mount and live", () => {
		osPrefersDark = false;
		renderTheme();
		expect(hasDarkClass()).toBe(false);

		act(() => flipOs(true));
		expect(hasDarkClass()).toBe(true);

		act(() => flipOs(false));
		expect(hasDarkClass()).toBe(false);
	});

	it("a light choice wins over a dark OS", () => {
		osPrefersDark = true;
		renderTheme();
		expect(hasDarkClass()).toBe(true); // system default first
		act(() => screen.getByText("set:light").click());
		expect(hasDarkClass()).toBe(false);
		expect(storage.get("aplaus.theme")).toBe("light");
	});

	it("the choice survives a full remount (app restart)", () => {
		osPrefersDark = false;
		const first = renderTheme();
		act(() => screen.getByText("set:dark").click());
		expect(hasDarkClass()).toBe(true);
		first.unmount();

		// Fresh provider, same storage: the boot state is dark again.
		renderTheme();
		expect(hasDarkClass()).toBe(true);
		expect(screen.getByText("current:dark")).toBeTruthy();
	});

	it("switching back to system hands control to the OS again", () => {
		osPrefersDark = false;
		renderTheme();
		act(() => screen.getByText("set:dark").click());
		expect(hasDarkClass()).toBe(true);
		act(() => screen.getByText("set:system").click());
		expect(hasDarkClass()).toBe(false); // OS says light
		act(() => flipOs(true));
		expect(hasDarkClass()).toBe(true); // OS flipped -> follows
	});
});

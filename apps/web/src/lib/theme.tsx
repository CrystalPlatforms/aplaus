/**
 * Motyw: jasny / ciemny / systemowy. Wybór zapisany w localStorage
 * ("aplaus.theme"); klasa .dark na <html> steruje warstwą Tailwind (zob.
 * index.css). Tryb systemowy podąża za OS-em na żywo (matchMedia listener).
 * Pierwszy paint obsługuje boot script w index.html — bez mignięcia białym.
 */
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

const THEME_KEY = "aplaus.theme";

const ThemeContext = createContext<{ theme: Theme; setTheme: (next: Theme) => void }>({
	theme: "system",
	setTheme: () => {},
});

function systemPrefersDark(): boolean {
	return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** The single mechanism: .dark on <html> decides everything visual. */
function applyTheme(theme: Theme): void {
	const dark = theme === "dark" || (theme === "system" && systemPrefersDark());
	document.documentElement.classList.toggle("dark", dark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [theme, setThemeState] = useState<Theme>(() => {
		try {
			const stored = localStorage.getItem(THEME_KEY);
			return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
		} catch {
			return "system";
		}
	});

	useEffect(() => {
		applyTheme(theme);
		if (theme !== "system") return;
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => applyTheme("system");
		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, [theme]);

	const setTheme = useCallback((next: Theme) => {
		try {
			localStorage.setItem(THEME_KEY, next);
		} catch {
			/* private mode: theme for this session only */
		}
		setThemeState(next);
	}, []);

	return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
	return useContext(ThemeContext);
}

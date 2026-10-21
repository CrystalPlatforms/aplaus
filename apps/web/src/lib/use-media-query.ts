import { useEffect, useState } from "react";

/**
 * Reactive matchMedia (ssr/jsdom-safe): false when matchMedia is missing.
 * Used to pick the timetable's desktop views (md+) without CSS-duplicated
 * content — only the active view is in the DOM.
 */
export function useMediaQuery(query: string): boolean {
	const [matches, setMatches] = useState(() =>
		typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false,
	);

	useEffect(() => {
		if (typeof window.matchMedia !== "function") return undefined;
		const mql = window.matchMedia(query);
		setMatches(mql.matches);
		const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, [query]);

	return matches;
}

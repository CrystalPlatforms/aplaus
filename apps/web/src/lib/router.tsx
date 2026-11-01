/**
 * Minimal history-API router: paths like /grades, /timetable, /more/homework.
 * No dependency — the app has four tabs and a few subpages.
 */
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

const RouterContext = createContext<{
	path: string;
	navigate: (to: string) => void;
	/** Cofnij w historii; bez naszej historii (deep-link) idź na fallback. */
	goBack: (fallback: string) => void;
}>({
	path: "/",
	navigate: () => {},
	goBack: () => {},
});

function currentPath(): string {
	try {
		return window.location.pathname;
	} catch {
		return "/";
	}
}

/**
 * pushState z licznikiem idx: głębokość naszej nawigacji (0 = pierwszy wpis,
 * np. deep-link). Po popstate browser sam przenosi swój state.
 */
function pushState(to: string) {
	const current = typeof window.history.state?.idx === "number" ? window.history.state.idx : 0;
	window.history.pushState({ idx: current + 1 }, "", to);
}

export function RouterProvider({ children }: { children: ReactNode }) {
	const [path, setPath] = useState(currentPath);

	useEffect(() => {
		const onPop = () => setPath(currentPath());
		window.addEventListener("popstate", onPop);
		// Push taps arrive as postMessage from the service worker
		// (focusOrNavigate in sw.ts): change the route without a reload.
		const onNavigateMessage = (event: MessageEvent) => {
			const data = event.data as { type?: string; url?: string } | null;
			if (data?.type === "aplaus:navigate" && typeof data.url === "string") {
				pushState(data.url);
				setPath(data.url);
				window.scrollTo(0, 0);
			}
		};
		window.addEventListener("popstate", onPop);
		window.addEventListener("message", onNavigateMessage);
		return () => {
			window.removeEventListener("popstate", onPop);
			window.removeEventListener("message", onNavigateMessage);
		};
	}, []);

	const navigate = useCallback((to: string) => {
		pushState(to);
		setPath(to);
		window.scrollTo(0, 0);
	}, []);

	// Cofanie dla strzałki ← w bottom barze: history.back() tylko, gdy
	// poprzedni wpis też jest nasz (licznik idx w history.state, ten sam
	// pattern co React Router). Deep-link w nowej karcie nie ma historii
	// (idx 0/undefined) → nawigacja na fallback, np. korzeń sekcji.
	const goBack = useCallback(
		(fallback: string) => {
			const idx = typeof window.history.state?.idx === "number" ? window.history.state.idx : 0;
			if (idx > 0) {
				window.history.back();
				return;
			}
			navigate(fallback);
		},
		[navigate],
	);

	return (
		<RouterContext.Provider value={{ path, navigate, goBack }}>{children}</RouterContext.Provider>
	);
}

export function useRoute() {
	return useContext(RouterContext);
}

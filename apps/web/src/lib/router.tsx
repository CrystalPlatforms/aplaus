/**
 * Minimal history-API router: paths like /grades, /timetable, /more/homework.
 * No dependency — the app has four tabs and a few subpages.
 */
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

const RouterContext = createContext<{ path: string; navigate: (to: string) => void }>({
	path: "/",
	navigate: () => {},
});

function currentPath(): string {
	try {
		return window.location.pathname;
	} catch {
		return "/";
	}
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
				window.history.pushState({}, "", data.url);
				setPath(data.url);
				window.scrollTo(0, 0);
			}
		};
		window.addEventListener("message", onNavigateMessage);
		return () => {
			window.removeEventListener("popstate", onPop);
			window.removeEventListener("message", onNavigateMessage);
		};
	}, []);

	const navigate = useCallback((to: string) => {
		window.history.pushState({}, "", to);
		setPath(to);
		window.scrollTo(0, 0);
	}, []);

	return <RouterContext.Provider value={{ path, navigate }}>{children}</RouterContext.Provider>;
}

export function useRoute() {
	return useContext(RouterContext);
}

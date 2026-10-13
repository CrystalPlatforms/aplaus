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
		return () => window.removeEventListener("popstate", onPop);
	}, []);

	const navigate = useCallback((to: string) => {
		window.history.pushState({}, "", to);
		setPath(to);
	}, []);

	return <RouterContext.Provider value={{ path, navigate }}>{children}</RouterContext.Provider>;
}

export function useRoute() {
	return useContext(RouterContext);
}

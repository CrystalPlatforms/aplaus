import { useEffect, useState } from "react";
import { API_OFFLINE_USED_EVENT, API_RESTORED_EVENT } from "@/lib/api";

/**
 * Baner „brak internetu": widoczny gdy przeglądarka zgłasza offline albo gdy
 * żądanie zostało obsłużone z pamięci offline. Chowa się po powrocie sieci
 * (zdarzenie online) lub po pierwszym udanym żądaniu do API.
 */
export function OfflineBanner() {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const show = () => setVisible(true);
		const hide = () => setVisible(false);
		if (!navigator.onLine) show();
		window.addEventListener("offline", show);
		window.addEventListener("online", hide);
		window.addEventListener(API_OFFLINE_USED_EVENT, show);
		window.addEventListener(API_RESTORED_EVENT, hide);
		return () => {
			window.removeEventListener("offline", show);
			window.removeEventListener("online", hide);
			window.removeEventListener(API_OFFLINE_USED_EVENT, show);
			window.removeEventListener(API_RESTORED_EVENT, hide);
		};
	}, []);

	if (!visible) return null;
	return (
		<output className="sticky top-14 z-[5] flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-100">
			<svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0">
				<path
					d="M12 20h.01M8.5 16.4a5 5 0 017 0M5 12.9a10 10 0 0114 0M2 9.4a15 15 0 0120 0M2 2l20 20"
					stroke="currentColor"
					strokeWidth="2"
					fill="none"
					strokeLinecap="round"
				/>
			</svg>
			Brak połączenia z internetem — pokazuję ostatnie zapisane dane.
		</output>
	);
}

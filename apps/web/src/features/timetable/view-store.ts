import { useSyncExternalStore } from "react";

export type TimetableView = "day" | "month";

const STORAGE_KEY = "aplaus.timetableView";
const CHANGE_EVENT = "aplaus:timetableView";

let cached: TimetableView = readStored();

function readStored(): TimetableView {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return stored === "day" || stored === "month" ? stored : "month";
	} catch {
		return "month";
	}
}

function subscribe(onChange: () => void) {
	// In-tab changes already updated `cached` before dispatching; only a
	// cross-tab `storage` event needs a re-read (and storage may be
	// unavailable — jsdom, private mode — so readStored stays try/caught).
	const onEvent = () => onChange();
	const onStorage = () => {
		cached = readStored();
		onChange();
	};
	window.addEventListener(CHANGE_EVENT, onEvent);
	window.addEventListener("storage", onStorage);
	return () => {
		window.removeEventListener(CHANGE_EVENT, onEvent);
		window.removeEventListener("storage", onStorage);
	};
}

/** The desktop timetable view (Miesiąc | Dzień) — shared by the shell's
 * TopBar toggle and TimetableScreen, persisted in localStorage. */
export function useTimetableView(): TimetableView {
	return useSyncExternalStore(
		subscribe,
		() => cached,
		() => "month",
	);
}

export function setTimetableView(view: TimetableView) {
	cached = view;
	try {
		localStorage.setItem(STORAGE_KEY, view);
	} catch {
		// storage unavailable (private mode) — view just won't persist
	}
	window.dispatchEvent(new Event(CHANGE_EVENT));
}

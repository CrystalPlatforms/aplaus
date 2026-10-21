import { shiftWeekStart } from "@repo/librus-client";
import { useSyncExternalStore } from "react";
import { currentWeekStart, monthOf, shiftMonth } from "./vm";

/**
 * Timetable range navigation (week for the day view, month for the month
 * grid) — module-level state shared by the shell TopBar nav and the screen.
 * Both read the same store, so arrows in the top bar drive the content
 * below without prop drilling through the shell.
 */
interface TimetableNavState {
	weekStart: string;
	month: string;
}

let state: TimetableNavState = fresh();
const listeners = new Set<() => void>();

function fresh(): TimetableNavState {
	const weekStart = currentWeekStart();
	return { weekStart, month: monthOf(weekStart) };
}

function emit() {
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function useTimetableNav(): TimetableNavState {
	return useSyncExternalStore(subscribe, () => state);
}

export function shiftTimetableWeek(delta: number) {
	const next = shiftWeekStart(state.weekStart, delta);
	if (!next) return;
	state = { weekStart: next, month: monthOf(next) };
	emit();
}

export function shiftTimetableMonth(delta: number) {
	state = { ...state, month: shiftMonth(state.month, delta) };
	emit();
}

/** Back to the current week/month — used between tests to undo scrolling. */
export function resetTimetableNav() {
	state = fresh();
	emit();
}

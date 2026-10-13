/**
 * Timetable view-model: week navigation helpers (client-side weekStart
 * arithmetic; the server's Pages.Next/Prev map to the same dates).
 */

/** Monday of the current week (UTC arithmetic on YYYY-MM-DD strings). */
export function currentWeekStart(): string {
	const now = new Date();
	const day = now.getUTCDay();
	// getUTCDay: 0 = Sunday … 6 = Saturday; Monday-offset = (day + 6) % 7
	const offset = (day + 6) % 7;
	now.setUTCDate(now.getUTCDate() - offset);
	return now.toISOString().slice(0, 10);
}

/** PL day names indexed by Date.getUTCDay(). */
const DAY_LABELS: Record<number, string> = {
	1: "Poniedziałek",
	2: "Wtorek",
	3: "Środa",
	4: "Czwartek",
	5: "Piątek",
	6: "Sobota",
	0: "Niedziela",
};

/** The week's seven dates, Monday first, with PL weekday labels. */
export function weekDays(weekStart: string): { date: string; label: string }[] {
	const d = new Date(`${weekStart}T00:00:00Z`);
	if (Number.isNaN(d.getTime())) return [];
	const days: { date: string; label: string }[] = [];
	for (let i = 0; i < 7; i++) {
		const day = new Date(d);
		day.setUTCDate(day.getUTCDate() + i);
		days.push({
			date: day.toISOString().slice(0, 10),
			label: DAY_LABELS[day.getUTCDay()] ?? "",
		});
	}
	return days;
}

/** "12.10 – 18.10" style range label for the week header. */
export function weekRangeLabel(weekStart: string): string {
	const d = new Date(`${weekStart}T00:00:00Z`);
	if (Number.isNaN(d.getTime())) return "";
	const end = new Date(d);
	end.setUTCDate(end.getUTCDate() + 6);
	const fmt = (x: Date) =>
		`${String(x.getUTCDate()).padStart(2, "0")}.${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
	return `${fmt(d)} – ${fmt(end)}`;
}

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

/** Short PL weekday labels, Monday first — day tabs and the month grid header. */
export const WEEKDAYS_SHORT = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"] as const;

/** Full month names, indexed 0-11 (getUTCMonth()). */
const MONTH_LABELS = [
	"Styczeń",
	"Luty",
	"Marzec",
	"Kwiecień",
	"Maj",
	"Czerwiec",
	"Lipiec",
	"Sierpień",
	"Wrzesień",
	"Październik",
	"Listopad",
	"Grudzień",
];

/** "2026-10" month key of a YYYY-MM-DD date. */
export function monthOf(date: string): string {
	return date.slice(0, 7);
}

/** Month key shifted by delta months ("2026-10" - 1 → "2026-09"). */
export function shiftMonth(month: string, delta: number): string {
	const [y, m] = month.split("-").map(Number);
	if (y === undefined || m === undefined || Number.isNaN(y) || Number.isNaN(m)) return month;
	const d = new Date(Date.UTC(y, m - 1 + delta, 1));
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "Październik 2026" label of a month key. */
export function monthLabel(month: string): string {
	const [y, m] = month.split("-").map(Number);
	if (y === undefined || m === undefined || Number.isNaN(y) || m < 1 || m > 12) return "";
	return `${MONTH_LABELS[m - 1]} ${y}`;
}

/** Monday on-or-before a date (YYYY-MM-DD → YYYY-MM-DD). */
function mondayOnOrBefore(date: string): string {
	const d = new Date(`${date}T00:00:00Z`);
	if (Number.isNaN(d.getTime())) return date;
	const offset = (d.getUTCDay() + 6) % 7;
	d.setUTCDate(d.getUTCDate() - offset);
	return d.toISOString().slice(0, 10);
}

/** Week starts (weekStart keys) covering the whole month: from the Monday
 * on-or-before the 1st through the week containing the month's last day. */
export function weeksOfMonth(month: string): string[] {
	const [y, m] = month.split("-").map(Number);
	if (y === undefined || m === undefined || Number.isNaN(y) || m < 1 || m > 12) return [];
	const first = `${month}-01`;
	const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
	const last = `${month}-${String(lastDay).padStart(2, "0")}`;
	const weeks: string[] = [];
	let cursor = mondayOnOrBefore(first);
	while (cursor <= last) {
		weeks.push(cursor);
		const d = new Date(`${cursor}T00:00:00Z`);
		d.setUTCDate(d.getUTCDate() + 7);
		cursor = d.toISOString().slice(0, 10);
	}
	return weeks;
}

/** Grid of days for the month view: Monday–Friday rectangles only (schools
 * have no weekend lessons), including leading/trailing days of the
 * neighbouring months. */
export function monthGrid(month: string): { date: string; inMonth: boolean }[] {
	const grid: { date: string; inMonth: boolean }[] = [];
	for (const weekStart of weeksOfMonth(month)) {
		for (const day of weekDays(weekStart).slice(0, 5)) {
			grid.push({ date: day.date, inMonth: monthOf(day.date) === month });
		}
	}
	return grid;
}

/**
 * Stable per-subject color: name hash → golden-angle hue → oklch. The same
 * subject keeps its color across days, weeks and both themes; unnamed
 * lessons fall back to neutral gray. Inline-style only (no palette classes),
 * like the attendance colorHex dots.
 */
export function subjectColor(name: string | null): { color: string; tint: string } {
	if (name === null || name.trim() === "") {
		return { color: "oklch(0.55 0.02 260)", tint: "oklch(0.55 0.02 260 / 0.2)" };
	}
	let h = 0;
	for (let i = 0; i < name.length; i++) {
		h = (h * 31 + name.charCodeAt(i)) >>> 0;
	}
	const hue = Math.round((h * 137.508) % 360);
	return { color: `oklch(0.72 0.15 ${hue})`, tint: `oklch(0.72 0.15 ${hue} / 0.2)` };
}

/** Exam event kinds shown in the month calendar: kartkówki (green) and
 * sprawdziany (red), classified from the grade category name. */
export type ExamKind = "quiz" | "test";

/** "Kartkówka" → quiz, "Sprawdzian" → test, anything else → not an exam. */
export function examKindOf(categoryName: string | null): ExamKind | null {
	if (categoryName === null) return null;
	const name = categoryName.toLowerCase();
	if (name.includes("sprawdzian")) return "test";
	if (name.includes("kartków") || name.includes("kartkow")) return "quiz";
	return null;
}

/**
 * Dashboard view-model: pure date and selection helpers — no React, no fetch.
 * Every date stays a YYYY-MM-DD string; day math parses components out of the
 * string itself so a local timezone offset can never shift the day.
 */
import type {
	Grade,
	HomeWorkAssignment,
	SchoolNotice,
	Timetable,
	TimetableLesson,
} from "@repo/librus-client";

const pad2 = (value: number): string => String(value).padStart(2, "0");

/** Local date as YYYY-MM-DD, built from new Date() components (never toISOString). */
export function todayISO(): string {
	const now = new Date();
	return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/**
 * Monday of the ISO week containing dateISO (YYYY-MM-DD). Unparseable input
 * comes back as-is; a valid date always yields a Monday of the same week.
 */
export function weekStartOf(dateISO: string): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
	if (!match) return dateISO;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(Date.UTC(year, month - 1, day));
	if (Number.isNaN(date.getTime())) return dateISO;
	const daysSinceMonday = (date.getUTCDay() + 6) % 7;
	date.setUTCDate(date.getUTCDate() - daysSinceMonday);
	return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/** Grades sorted by add date, newest first, first `count` of them. */
export function latestGrades(grades: Grade[], count: number): Grade[] {
	return [...grades].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded)).slice(0, count);
}

/** Lessons of one day of the week grid: slots flattened, canceled ones dropped. */
export function todayLessons(week: Timetable | null, dateISO: string): TimetableLesson[] {
	const day = week?.days.find((d) => d.date === dateISO);
	if (!day) return [];
	const lessons: TimetableLesson[] = [];
	for (const slot of day.slots) {
		for (const lesson of slot) {
			if (lesson.isCanceled === true) continue;
			lessons.push(lesson);
		}
	}
	return lessons;
}

/**
 * Assignments due today or later, earliest first (first `count`). With none
 * pending, falls back to the latest overdue so the card still helps.
 */
export function upcomingAssignments(
	assignments: HomeWorkAssignment[],
	todayISO: string,
	count: number,
): HomeWorkAssignment[] {
	const upcoming = assignments
		.filter((a) => a.dueDate >= todayISO)
		.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
		.slice(0, count);
	if (upcoming.length > 0) return upcoming;
	return [...assignments].sort((a, b) => b.dueDate.localeCompare(a.dueDate)).slice(0, count);
}

/** Notices in force today (empty startDate excluded), newest first. */
export function activeNotices(notices: SchoolNotice[], todayISO: string): SchoolNotice[] {
	return notices
		.filter((n) => n.startDate !== "" && n.startDate <= todayISO && todayISO <= n.endDate)
		.sort((a, b) => b.startDate.localeCompare(a.startDate));
}

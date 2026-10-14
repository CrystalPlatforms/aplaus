/**
 * Dashboard view-model on fixed dates — no clock dependence: every helper
 * takes its date argument, so the tests pin the semantics, not today.
 */
import type { HomeWorkAssignment, SchoolNotice } from "@repo/librus-client";
import { describe, expect, it } from "vitest";
import { activeNotices, latestGrades, todayLessons, upcomingAssignments, weekStartOf } from "./vm";

const GRADES = [
	{ id: 1, dateAdded: "2026-10-10 08:00:00" },
	{ id: 2, dateAdded: "2026-10-12 09:00:00" },
	{ id: 3, dateAdded: "2026-10-11 07:00:00" },
	{ id: 4, dateAdded: "2026-10-09 06:00:00" },
] as never[];

describe("weekStartOf", () => {
	it("maps any day to the Monday of its ISO week", () => {
		expect(weekStartOf("2026-10-13")).toBe("2026-10-12"); // Tuesday
		expect(weekStartOf("2026-10-12")).toBe("2026-10-12"); // Monday itself
		expect(weekStartOf("2026-10-18")).toBe("2026-10-12"); // Sunday
	});

	it("keeps unparseable input as-is", () => {
		expect(weekStartOf("nie-data")).toBe("nie-data");
	});
});

describe("latestGrades", () => {
	it("sorts by add date descending and cuts to count", () => {
		const ids = latestGrades(GRADES, 2).map((g) => g.id);
		expect(ids).toEqual([2, 3]);
	});
});

describe("todayLessons", () => {
	const WEEK = {
		days: [
			{
				date: "2026-10-13",
				slots: [
					[{ subjectName: "Matematyka", hourFrom: "08:00", hourTo: "08:45" }],
					[],
					[{ subjectName: "WF", hourFrom: "10:00", hourTo: "10:45", isCanceled: true }],
				],
			},
			{ date: "2026-10-14", slots: [] },
		],
	} as never;

	it("returns the day's lessons, slots flattened, canceled dropped", () => {
		const lessons = todayLessons(WEEK, "2026-10-13");
		expect(lessons.map((l) => l.subjectName)).toEqual(["Matematyka"]);
	});

	it("returns nothing for a day outside the week", () => {
		expect(todayLessons(WEEK, "2026-11-01")).toEqual([]);
		expect(todayLessons(null, "2026-10-13")).toEqual([]);
	});
});

describe("upcomingAssignments", () => {
	const ASSIGNMENTS = [
		{ id: 1, dueDate: "2026-10-20" },
		{ id: 2, dueDate: "2026-10-14" },
		{ id: 3, dueDate: "2026-10-01" }, // overdue
	] as HomeWorkAssignment[];

	it("keeps due-today-or-later, earliest first", () => {
		expect(upcomingAssignments(ASSIGNMENTS, "2026-10-13", 5).map((a) => a.id)).toEqual([2, 1]);
	});

	it("falls back to the latest overdue when nothing is pending", () => {
		expect(upcomingAssignments([ASSIGNMENTS[2] as HomeWorkAssignment], "2026-10-13", 5)).toEqual([
			{ id: 3, dueDate: "2026-10-01" },
		]);
	});
});

describe("activeNotices", () => {
	const NOTICES = [
		{ id: "1", startDate: "2026-10-01", endDate: "2026-10-31", subject: "W mocy" },
		{ id: "2", startDate: "2026-09-01", endDate: "2026-09-30", subject: "Po terminie" },
		{ id: "3", startDate: "", endDate: "2026-10-31", subject: "Bez startu" },
	] as SchoolNotice[];

	it("keeps only notices in force today, newest first", () => {
		expect(activeNotices(NOTICES, "2026-10-13").map((n) => n.id)).toEqual(["1"]);
	});
});

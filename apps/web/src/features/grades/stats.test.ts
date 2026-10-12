/**
 * Grade statistics on fixture data: only IsConstituent counts, per semester,
 * and empty data stays null (never NaN).
 */

import type { Grade } from "@repo/librus-client";
import { describe, expect, it } from "vitest";
import { computeOverallStats, computeSemesterStats, parseGradeValue } from "./stats";

function grade(partial: Partial<Grade>): Grade {
	return {
		id: 1,
		grade: "5",
		dateOccurred: "2026-10-01",
		dateAdded: "2026-10-01 08:00:00",
		semester: 1,
		subjectId: null,
		subjectName: null,
		categoryId: null,
		addedById: null,
		addedByName: null,
		studentId: null,
		lessonId: null,
		isConstituent: true,
		isSemester: false,
		isFinal: false,
		isSemesterProposition: false,
		isFinalProposition: false,
		commentIds: [],
		...partial,
	};
}

describe("parseGradeValue", () => {
	it("parses plain, plus, minus and rejects words", () => {
		expect(parseGradeValue("5")).toBe(5);
		expect(parseGradeValue("4+")).toBe(4.5);
		expect(parseGradeValue("3-")).toBe(2.75);
		expect(parseGradeValue("bz")).toBeNull();
		expect(parseGradeValue("")).toBeNull();
	});
});

describe("computeSemesterStats", () => {
	it("averages only IsConstituent grades, split by semester", () => {
		const grades = [
			grade({ id: 1, grade: "5", semester: 1, isConstituent: true }),
			grade({ id: 2, grade: "3", semester: 1, isConstituent: true }),
			grade({ id: 3, grade: "4", semester: 1, isConstituent: false }),
			grade({ id: 4, grade: "6", semester: 2, isConstituent: true }),
		];
		const stats = computeSemesterStats(grades);
		expect(stats["1"]).toEqual({ average: 4, count: 2 });
		expect(stats["2"]).toEqual({ average: 6, count: 1 });
	});

	it("empty data yields null average, not NaN", () => {
		expect(computeOverallStats([])).toEqual({ average: null, count: 0 });
		expect(computeSemesterStats([])).toEqual({});
		const nonConstituent = [grade({ id: 5, grade: "1", semester: 1, isConstituent: false })];
		expect(computeOverallStats(nonConstituent).average).toBeNull();
	});
});

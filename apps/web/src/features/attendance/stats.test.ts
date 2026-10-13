/**
 * Attendance statistics: per-category counts mapped from type Identifiers,
 * per-type counts, semester scoping, and zeros (never an error) when empty.
 */

import type { Attendance, AttendanceType } from "@repo/librus-client";
import { describe, expect, it } from "vitest";
import { attendanceSemesters, computeAttendanceStats } from "./stats";

/** Minimal builder — statistics read only ids, semesters and type ids. */
function attendance(id: number, semester: number, typeId: number): Attendance {
	return {
		id,
		lessonId: null,
		date: "2026-10-12",
		addDate: "",
		lessonNo: 1,
		semester,
		typeId,
		addedById: null,
	};
}

function type(id: number, identifier: string | null, isPresenceKind = false): AttendanceType {
	return {
		id,
		name: `Typ ${id}`,
		short: null,
		standard: true,
		colorHex: null,
		isPresenceKind,
		order: id,
		identifier,
	};
}

const TYPES = [
	type(1, "presence", true),
	type(2, "absence"),
	type(3, "absence_unexcused"),
	type(4, "lateness"),
	type(5, "custom_kind"), // unknown identifier: per type yes, in the four categories no
];

describe("computeAttendanceStats", () => {
	it("counts correctly per semantic category mapped from Identifiers", () => {
		const records = [
			attendance(1, 1, 1), // presence
			attendance(2, 1, 1),
			attendance(3, 1, 2), // excused absence
			attendance(4, 1, 3), // unexcused absence
			attendance(5, 1, 3),
			attendance(6, 1, 3),
			attendance(7, 1, 4), // lateness
		];
		const stats = computeAttendanceStats(records, TYPES);
		expect(stats).toMatchObject({ presence: 2, excused: 1, unexcused: 3, lateness: 1 });
	});

	it("counts per concrete type with names from Attendances/Types", () => {
		const records = [attendance(1, 1, 3), attendance(2, 1, 3), attendance(3, 1, 4)];
		const stats = computeAttendanceStats(records, TYPES);
		expect(stats.perType).toEqual([
			{ id: 3, name: "Typ 3", count: 2 },
			{ id: 4, name: "Typ 4", count: 1 },
		]);
	});

	it("records with an unknown identifier count per type only", () => {
		const records = [attendance(1, 1, 5)];
		const stats = computeAttendanceStats(records, TYPES);
		expect(stats.presence).toBe(0);
		expect(stats.excused).toBe(0);
		expect(stats.unexcused).toBe(0);
		expect(stats.lateness).toBe(0);
		expect(stats.perType).toEqual([{ id: 5, name: "Typ 5", count: 1 }]);
	});

	it("scopes to one semester when asked", () => {
		const records = [attendance(1, 1, 1), attendance(2, 2, 1)];
		expect(computeAttendanceStats(records, TYPES, 1)).toMatchObject({ presence: 1 });
		expect(computeAttendanceStats(records, TYPES, 2)).toMatchObject({ presence: 1 });
		expect(computeAttendanceStats(records, TYPES, 2).perType).toHaveLength(1);
	});

	it("returns all zeros (never an error) when there are no records", () => {
		const stats = computeAttendanceStats([], TYPES);
		expect(stats).toMatchObject({ presence: 0, excused: 0, unexcused: 0, lateness: 0 });
		expect(stats.perType).toEqual([]);
	});

	it("does not crash on records whose type is missing from the dictionary", () => {
		const stats = computeAttendanceStats([attendance(1, 1, 99)], TYPES);
		expect(stats.perType).toEqual([{ id: 99, name: "99", count: 1 }]);
		expect(stats.presence).toBe(0);
	});
});

describe("attendanceSemesters", () => {
	it("lists distinct semesters ascending", () => {
		const records = [attendance(1, 2, 1), attendance(2, 1, 1), attendance(3, 2, 1)];
		expect(attendanceSemesters(records)).toEqual([1, 2]);
	});
});

describe("categoryOf fallbacks (real-dictionary shapes)", () => {
	it("maps by Polish name when Identifier is null", () => {
		const types = [
			type(1, null, false),
			// patch: names set below
		];
		const named = [
			{ ...type(1, null), name: "Obecność" },
			{ ...type(2, null), name: "Nieobecność" },
			{ ...type(3, null), name: "Nieobecność nieusprawiedliwiona" },
			{ ...type(4, null), name: "Spóźnienie" },
		];
		const records = [
			attendance(1, 1, 1),
			attendance(2, 1, 2),
			attendance(3, 1, 3),
			attendance(4, 1, 4),
		];
		const stats = computeAttendanceStats(records, named);
		expect(stats).toMatchObject({ presence: 1, excused: 1, unexcused: 1, lateness: 1 });
		void types;
	});

	it("treats the unexcused variant as unexcused even though its name contains the absence stem", () => {
		const named = [{ ...type(3, "absence"), name: "Nieobecność nieusprawiedliwiona" }];
		const stats = computeAttendanceStats([attendance(1, 1, 3)], named);
		expect(stats.unexcused).toBe(1);
		expect(stats.excused).toBe(0);
	});

	it("maps by the short code when identifier and name are unhelpful", () => {
		const named = [
			{ ...type(2, null), name: "Typ 2", short: "nb" },
			{ ...type(4, null), name: "Typ 4", short: "sp" },
		];
		const stats = computeAttendanceStats([attendance(1, 1, 2), attendance(2, 1, 4)], named);
		expect(stats.excused).toBe(1);
		expect(stats.lateness).toBe(1);
	});
});

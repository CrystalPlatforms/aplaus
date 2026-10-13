/**
 * fillTimetableNames: the Timetables envelope's Resources carry only Urls
 * (audit-confirmed), so substitution teachers come from /Teachers, room
 * symbols from /Classrooms and subject names from /Subjects dictionaries.
 */

import type { Classroom, Subject, Teacher, Timetable } from "@repo/librus-client";
import { CookieJar } from "@repo/librus-client";
import { describe, expect, it, vi } from "vitest";
import { fillTimetableNames, resolveTeacherNames } from "./timetable-service";

/**
 * One substitution lesson: the envelope carries OrgTeacher as a bare ref
 * (no name), and the dictionaries provide the missing names.
 */
const TIMETABLE: Timetable = {
	days: [
		{
			date: "2026-10-12",
			slots: [
				[
					{
						id: "1",
						lessonId: "1",
						classroomId: "21",
						classroomSymbol: null,
						dateFrom: "",
						dateTo: "",
						lessonNo: "5",
						dayNo: "1",
						subjectId: "13",
						subjectName: null,
						teacherId: "56",
						teacherName: null,
						classId: null,
						isCanceled: false,
						isSubstitutionClass: true,
						substitutionNote: null,
						hourFrom: "11:50",
						hourTo: "12:35",
						orgSubjectName: null,
						orgTeacherName: null,
						orgTeacherId: "58",
						orgLessonNo: null,
						orgHourFrom: null,
						orgHourTo: null,
						orgClassroomId: "24",
						orgClassroomSymbol: null,
					},
				],
			],
		},
	],
	nextWeekStart: null,
	prevWeekStart: null,
};

const TEACHERS: Teacher[] = [
	{ id: 56, firstName: "Renata", lastName: "Wróbel" },
	{ id: 58, firstName: "Marzena", lastName: "Muda" },
];
const CLASSROOMS: Classroom[] = [
	{ id: "21", symbol: "21", name: "Sala 21" },
	{ id: "24", symbol: "24", name: "Pracownia" },
];
const SUBJECTS: Subject[] = [{ id: 13, name: "Historia" }];

describe("fillTimetableNames", () => {
	it("fills substitution names and subject names from dictionaries", () => {
		const filled = fillTimetableNames(TIMETABLE, TEACHERS, CLASSROOMS, SUBJECTS);
		const lesson = filled.days[0]?.slots[0]?.[0];
		expect(lesson?.teacherName).toBe("Renata Wróbel");
		expect(lesson?.orgTeacherName).toBe("Marzena Muda");
		expect(lesson?.teacherName).toBe("Renata Wróbel");
		expect(lesson?.classroomSymbol).toBe("21");
		expect(lesson?.orgClassroomSymbol).toBe("24");
		expect(lesson?.subjectName).toBe("Historia");
		expect(lesson?.orgSubjectName).toBe("Historia");
	});

	it("keeps data intact when the dictionaries are empty", () => {
		const filled = fillTimetableNames(TIMETABLE, [], [], []);
		const lesson = filled.days[0]?.slots[0]?.[0];
		expect(lesson?.teacherName).toBeNull();
		expect(lesson?.orgTeacherName).toBeNull();
		expect(lesson?.classroomSymbol).toBeNull();
		expect(lesson?.subjectName).toBeNull();
		expect(lesson?.orgSubjectName).toBeNull();
	});
});

describe("resolveTeacherNames", () => {
	it("fills missing teacher names from Users/{id} (the only source on real accounts)", async () => {
		const readUserFn = vi.fn(async (_jar: unknown, id: string | number) =>
			String(id) === "1332267" ? { id: 1332267, firstName: "Marzena", lastName: "Muda" } : null,
		);
		const withIds: typeof TIMETABLE = {
			...TIMETABLE,
			days: TIMETABLE.days.map((day) => ({
				...day,
				slots: day.slots.map((slot) =>
					slot.map((lesson) => ({ ...lesson, orgTeacherId: 1332267, teacherId: null })),
				),
			})),
		};
		const resolved = await resolveTeacherNames(CookieJar.empty(), withIds, readUserFn as never);
		const lesson = resolved.days[0]?.slots[0]?.[0];
		expect(lesson?.orgTeacherName).toBe("Marzena Muda");
	});

	it("leaves names alone when every lesson already has one", async () => {
		const readUserFn = vi.fn(async () => {
			throw new Error("must not be called");
		});
		const resolved = await resolveTeacherNames(CookieJar.empty(), TIMETABLE, readUserFn as never);
		expect(resolved).toEqual(TIMETABLE);
	});
});

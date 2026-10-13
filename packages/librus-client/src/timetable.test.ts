/**
 * Timetable reader normalization against a fixture shaped per the audit JSON:
 * dynamic date keys, week grid of slots, empty slots allowed, inline
 * Subject/Teacher objects. No `any` anywhere — the parser narrows itself.
 */
import { describe, expect, it, vi } from "vitest";
import { CookieJar } from "./cookie-jar";
import type { HttpDeps } from "./http";
import { readTimetable, shiftWeekStart, weekStartFromUrl } from "./timetable";

/** Fixture per audit: `{ Timetable: { <date>: [[slots]] }, Pages, Resources, Url }`. */
const TIMETABLE_FIXTURE = {
	Timetable: {
		"2026-10-12": [
			[
				{
					Lesson: { Id: "7701", Url: "/2.0/Lessons/7701" },
					Classroom: { Id: "21", Url: "/2.0/Classrooms/21" },
					// symbol arrives only through Resources (audit: Classroom is a bare ref)
					DateFrom: "2026-10-12 08:00:00",
					DateTo: "2026-10-12 08:45:00",
					LessonNo: "1",
					TimetableEntry: { Id: "501", Url: "/2.0/TimetableEntries/501" },
					DayNo: "1",
					Subject: { Id: "12", Name: "Matematyka", Short: "Mat", Url: "/2.0/Subjects/12" },
					Teacher: { Id: "55", FirstName: "Anna", LastName: "Kowalska", Url: "/2.0/Teachers/55" },
					Class: { Id: 3, Url: "/2.0/Classes/3" },
					IsSubstitutionClass: false,
					IsCanceled: false,
					SubstitutionNote: null,
					HourFrom: "08:00",
					HourTo: "08:45",
				},
			],
			[], // empty slot: no lesson in that period (audit: "slot może być pustą tablicą")
			[
				{
					Lesson: { Id: "7702", Url: "/2.0/Lessons/7702" },
					Classroom: null,
					DateFrom: "2026-10-12 10:00:00",
					DateTo: "2026-10-12 10:45:00",
					LessonNo: "3",
					TimetableEntry: { Id: "502", Url: "/2.0/TimetableEntries/502" },
					DayNo: "1",
					Subject: { Id: "13", Name: "Historia", Short: "His", Url: "/2.0/Subjects/13" },
					Teacher: { Id: "56", FirstName: "Piotr", LastName: "Nowak", Url: "/2.0/Teachers/56" },
					OrgSubject: { Id: "13", Url: "/2.0/Subjects/13" },
					OrgTeacher: { Id: "58", Url: "/2.0/Teachers/58" },
					OrgClassroom: { Id: "24", Url: "/2.0/Classrooms/24" },
					OrgLessonNo: "3",
					OrgHourFrom: "10:00",
					OrgHourTo: "10:45",
					Class: { Id: 3, Url: "/2.0/Classes/3" },
					IsSubstitutionClass: true,
					IsCanceled: false,
					SubstitutionNote: null,
					HourFrom: "10:00",
					HourTo: "10:45",
				},
			],
		],
		"2026-10-13": [
			[
				{
					Lesson: { Id: "7703", Url: "/2.0/Lessons/7703" },
					Classroom: { Id: "22", Url: "/2.0/Classrooms/22" },
					DateFrom: "2026-10-13 08:00:00",
					DateTo: "2026-10-13 08:45:00",
					LessonNo: "1",
					TimetableEntry: { Id: "503", Url: "/2.0/TimetableEntries/503" },
					DayNo: "2",
					Subject: { Id: "12", Name: "Matematyka", Short: "Mat", Url: "/2.0/Subjects/12" },
					Teacher: { Id: "55", FirstName: "Anna", LastName: "Kowalska", Url: "/2.0/Teachers/55" },
					Class: { Id: 3, Url: "/2.0/Classes/3" },
					IsSubstitutionClass: false,
					IsCanceled: true,
					SubstitutionNote: null,
					HourFrom: "08:00",
					HourTo: "08:45",
				},
			],
		],
	},
	Pages: {
		Next: "https://synergia.librus.pl/gateway/api/2.0/Timetables?weekStart=2026-10-19",
		Prev: "https://synergia.librus.pl/gateway/api/2.0/Timetables?weekStart=2026-10-05",
	},
	Resources: {
		"/2.0/Classrooms/21": { Id: "21", Symbol: "21" },
		"/2.0/Classrooms/24": { Id: "24", Symbol: "24" },
		"/2.0/Teachers/58": { Id: "58", FirstName: "Jan", LastName: "Wiśniewski" },
		"/2.0/Subjects/13": { Id: "13", Name: "Historia", Short: "His" },
	},
	Url: "https://synergia.librus.pl/gateway/api/2.0/Timetables?weekStart=2026-10-12",
};

function depsWithFixture(): HttpDeps {
	return {
		fetch: vi.fn(async (input: string | URL | Request) => {
			const url =
				typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
			expect(url).toContain("/gateway/api/2.0/Timetables?weekStart=2026-10-12");
			return Response.json(TIMETABLE_FIXTURE);
		}),
		now: () => 0,
		randomPart: () => "",
	} as HttpDeps;
}

describe("readTimetable", () => {
	it("normalizes dynamic date keys, inline subject/teacher and empty slots", async () => {
		const timetable = await readTimetable(CookieJar.empty(), "2026-10-12", depsWithFixture());
		expect(timetable.days).toHaveLength(2);
		expect(timetable.days[0]?.date).toBe("2026-10-12");
		expect(timetable.days[1]?.date).toBe("2026-10-13");

		const monday = timetable.days[0];
		expect(monday?.slots).toHaveLength(3);
		expect(monday?.slots[0]).toHaveLength(1);
		// The empty slot survives as an empty slot.
		expect(monday?.slots[1]).toEqual([]);

		const lesson = monday?.slots[0]?.[0];
		expect(lesson).toMatchObject({
			lessonId: "7701",
			subjectId: "12",
			subjectName: "Matematyka",
			teacherName: "Anna Kowalska",
			classroomSymbol: "21",
			hourFrom: "08:00",
			hourTo: "08:45",
			isCanceled: false,
			isSubstitutionClass: false,
			orgSubjectName: null,
			orgTeacherName: null,
			orgTeacherId: null,
			orgLessonNo: null,
			orgHourFrom: null,
			orgHourTo: null,
			orgClassroomSymbol: null,
		});

		const substitution = monday?.slots[2]?.[0];
		expect(substitution).toMatchObject({
			isSubstitutionClass: true,
			// OrgTeacher is a bare {Id, Url} ref — the name comes from Resources.
			orgTeacherName: "Jan Wiśniewski",
			orgSubjectName: "Historia",
			orgClassroomSymbol: "24",
			teacherName: "Piotr Nowak",
		});

		// Days sort by date even when the payload order differs.
		const tuesday = timetable.days[1];
		expect(tuesday?.slots[0]?.[0]?.isCanceled).toBe(true);
	});

	it("maps Pages.Next/Prev to next/prev weekStart dates", async () => {
		const timetable = await readTimetable(CookieJar.empty(), "2026-10-12", depsWithFixture());
		expect(timetable.nextWeekStart).toBe("2026-10-19");
		expect(timetable.prevWeekStart).toBe("2026-10-05");
	});

	it("returns null pages when Pages is missing", async () => {
		const deps = {
			fetch: vi.fn(async () => Response.json({ Timetable: {}, Resources: {}, Url: "x" })),
			now: () => 0,
			randomPart: () => "",
		} as HttpDeps;
		const timetable = await readTimetable(CookieJar.empty(), "2026-10-12", deps);
		expect(timetable.nextWeekStart).toBeNull();
		expect(timetable.prevWeekStart).toBeNull();
		expect(timetable.days).toEqual([]);
	});
});

describe("week navigation", () => {
	it("shiftWeekStart builds the previous and the next week", () => {
		expect(shiftWeekStart("2026-10-12", 1)).toBe("2026-10-19");
		expect(shiftWeekStart("2026-10-12", -1)).toBe("2026-10-05");
	});

	it("shiftWeekStart crosses month and year boundaries", () => {
		expect(shiftWeekStart("2026-10-26", 1)).toBe("2026-11-02");
		expect(shiftWeekStart("2027-01-05", -1)).toBe("2026-12-29");
	});

	it("shiftWeekStart rejects malformed input", () => {
		expect(shiftWeekStart("not-a-date", 1)).toBeNull();
		expect(shiftWeekStart("2026-10-12", Number.NaN)).toBeNull();
	});

	it("weekStartFromUrl extracts the query param, tolerates junk", () => {
		expect(weekStartFromUrl("https://x.pl/gateway/api/2.0/Timetables?weekStart=2026-10-19")).toBe(
			"2026-10-19",
		);
		expect(weekStartFromUrl("https://x.pl/gateway/api/2.0/Timetables")).toBeNull();
		expect(weekStartFromUrl(null)).toBeNull();
	});
});

describe("inline Org names", () => {
	it("recovers the substitution teacher id from the OrgTeacher Url when the ref has no Id", async () => {
		const fixture = {
			Timetable: {
				"2026-10-12": [
					[
						{
							Id: 9001,
							LessonNo: "5",
							HourFrom: "11:50",
							HourTo: "12:35",
							Subject: { Id: 13, Name: "Historia" },
							Teacher: { Id: 56, FirstName: "Renata", LastName: "Wróbel" },
							OrgTeacher: { Url: "/2.0/Teachers/58" },
							IsSubstitutionClass: true,
						},
					],
				],
			},
		};
		const deps = {
			fetch: vi.fn(async () => Response.json(fixture)),
			now: () => 0,
			randomPart: () => "",
		} as HttpDeps;
		const timetable = await readTimetable(CookieJar.empty(), "2026-10-12", deps);
		const lesson = timetable.days[0]?.slots[0]?.[0];
		expect(lesson?.isSubstitutionClass).toBe(true);
		expect(lesson?.orgTeacherId).toBe(58);
		expect(lesson?.orgTeacherName).toBeNull();
	});

	it("prefers names carried on the OrgTeacher ref itself (no Resources needed)", async () => {
		const fixture = {
			Timetable: {
				"2026-10-12": [
					[
						{
							Lesson: { Id: "1", Url: "/2.0/Lessons/1" },
							DateFrom: "2026-10-12 10:00:00",
							DateTo: "2026-10-12 10:45:00",
							LessonNo: "3",
							DayNo: "1",
							Subject: { Id: "13", Name: "Historia", Url: "/2.0/Subjects/13" },
							Teacher: {
								Id: "56",
								FirstName: "Renata",
								LastName: "Wróbel",
								Url: "/2.0/Teachers/56",
							},
							OrgTeacher: {
								Id: "58",
								FirstName: "Marzena",
								LastName: "Muda",
								Url: "/2.0/Teachers/58",
							},
							Class: null,
							IsSubstitutionClass: true,
							IsCanceled: false,
							SubstitutionNote: null,
							HourFrom: "10:00",
							HourTo: "10:45",
						},
					],
				],
			},
			Pages: {},
			// Empty Resources: only the inline names can answer here.
			Resources: {},
			Url: "x",
		};
		const deps = {
			fetch: vi.fn(async () => Response.json(fixture)),
			now: () => 0,
			randomPart: () => "",
		} as HttpDeps;
		const timetable = await readTimetable(CookieJar.empty(), "2026-10-12", deps);
		const lesson = timetable.days[0]?.slots[0]?.[0];
		expect(lesson?.orgTeacherName).toBe("Marzena Muda");
		expect(lesson?.teacherName).toBe("Renata Wróbel");
	});
});

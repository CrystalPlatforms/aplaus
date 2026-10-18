/**
 * Tool handlers against a fake LibrusClientSurface: librus-client is the
 * external boundary of this package, so the fake replaces the whole client —
 * no HTTP fixtures needed. Session retry semantics are covered too.
 */

import type { Grade, SchoolNotice } from "@repo/librus-client";
import { CookieJar, LibrusError } from "@repo/librus-client";
import { describe, expect, it, vi } from "vitest";
import { LibrusSession } from "./librus-session";
import type { LibrusClientSurface } from "./tools";
import {
	addDays,
	gradesBySubject,
	localDateOf,
	mondayOf,
	normalizeText,
	schoolNotices,
	timetableForDay,
	unreadMessages,
	upcomingHomework,
} from "./tools";

/** Local noon of a fixed date — localDateOf is stable in any timezone. */
const NOON = (year: number, month1: number, day: number) =>
	new Date(year, month1 - 1, day, 12, 0, 0).getTime();

const jarA = CookieJar.empty();
const jarB = CookieJar.empty();

/** Surface with fixture data; each fn is a vi.fn so tests can assert calls. */
function fakeSurface(overrides: Partial<LibrusClientSurface> = {}): LibrusClientSurface {
	const grades: Grade[] = [
		{
			id: 101,
			grade: "5",
			dateOccurred: "2026-10-01",
			dateAdded: "2026-10-10 08:00:00",
			semester: 1,
			subjectId: 12,
			subjectName: "Matematyka",
			categoryId: 5,
			addedById: 55,
			addedByName: "Anna Kowalska",
			studentId: 900,
			lessonId: 77,
			isConstituent: true,
			isSemester: false,
			isFinal: false,
			isSemesterProposition: false,
			isFinalProposition: false,
			commentIds: [8],
		},
		{
			id: 102,
			grade: "4",
			dateOccurred: "2026-10-05",
			dateAdded: "2026-10-05 09:00:00",
			semester: 1,
			subjectId: 13,
			subjectName: "Biologia",
			categoryId: 6,
			addedById: 56,
			addedByName: "Jan Nowak",
			studentId: 900,
			lessonId: 78,
			isConstituent: false,
			isSemester: false,
			isFinal: false,
			isSemesterProposition: false,
			isFinalProposition: false,
			commentIds: [],
		},
	];
	return {
		login: vi.fn(async () => ({
			jar: jarA,
			account: { id: 1, firstName: "A", lastName: "B", login: "x", groupId: 8 },
		})),
		readGrades: vi.fn(async () => grades),
		readSubjects: vi.fn(async () => [
			{ id: 12, name: "Matematyka" },
			{ id: 13, name: "Biologia" },
		]),
		readGradeCategories: vi.fn(async () => [
			{
				id: 5,
				name: "Sprawdzian",
				short: "S",
				standard: true,
				colorId: 1,
				isSemestral: false,
				isFinal: false,
				isSemestralProposition: false,
				isFinalProposition: false,
				blockAnyGrades: false,
			},
			{
				id: 6,
				name: "Kartkówka",
				short: "K",
				standard: true,
				colorId: 2,
				isSemestral: false,
				isFinal: false,
				isSemestralProposition: false,
				isFinalProposition: false,
				blockAnyGrades: false,
			},
		]),
		readGradeComments: vi.fn(async () => [
			{ id: 8, gradeId: 101, addedById: 55, text: "Bardzo dobra praca" },
		]),
		readTimetable: vi.fn(async () => ({
			days: [
				{
					date: "2026-10-14",
					slots: [
						[
							{
								id: 1,
								lessonId: 1,
								classroomId: 3,
								classroomSymbol: "204",
								dateFrom: "",
								dateTo: "",
								lessonNo: "1",
								dayNo: "3",
								subjectId: 12,
								subjectName: "Matematyka",
								teacherId: 55,
								teacherName: "Anna Kowalska",
								classId: 1,
								isCanceled: false,
								isSubstitutionClass: false,
								substitutionNote: null,
								hourFrom: "08:00",
								hourTo: "08:45",
								orgSubjectName: null,
								orgTeacherName: null,
								orgTeacherId: null,
								orgLessonNo: null,
								orgHourFrom: null,
								orgHourTo: null,
								orgClassroomId: null,
								orgClassroomSymbol: null,
							},
						],
						[],
						[
							{
								id: 2,
								lessonId: 2,
								classroomId: 4,
								classroomSymbol: "13",
								dateFrom: "",
								dateTo: "",
								lessonNo: "3",
								dayNo: "3",
								subjectId: 20,
								subjectName: "Fizyka",
								teacherId: 60,
								teacherName: "Marek Zieliński",
								classId: 1,
								isCanceled: true,
								isSubstitutionClass: false,
								substitutionNote: null,
								hourFrom: "10:00",
								hourTo: "10:45",
								orgSubjectName: null,
								orgTeacherName: null,
								orgTeacherId: null,
								orgLessonNo: null,
								orgHourFrom: null,
								orgHourTo: null,
								orgClassroomId: null,
								orgClassroomSymbol: null,
							},
							{
								id: 3,
								lessonId: 3,
								classroomId: 5,
								classroomSymbol: "22",
								dateFrom: "",
								dateTo: "",
								lessonNo: "4",
								dayNo: "3",
								subjectId: 21,
								subjectName: "Fizyka",
								teacherId: 60,
								teacherName: "Marek Zieliński",
								classId: 1,
								isCanceled: false,
								isSubstitutionClass: true,
								substitutionNote: "Przeniesienie",
								hourFrom: "11:00",
								hourTo: "11:45",
								orgSubjectName: "Chemia",
								orgTeacherName: "Ewa Bąk",
								orgTeacherId: 61,
								orgLessonNo: "4",
								orgHourFrom: "11:00",
								orgHourTo: "11:45",
								orgClassroomId: 5,
								orgClassroomSymbol: "22",
							},
						],
					],
				},
				{ date: "2026-10-15", slots: [] },
			],
			nextWeekStart: "2026-10-19",
			prevWeekStart: "2026-10-05",
		})),
		establishMessagesSession: vi.fn(async () => jarB),
		readInboxMessages: vi.fn(async () => ({
			messages: [
				{
					messageId: "1",
					senderName: "Sekretariat",
					topic: "Zebranie",
					content: "ukryta treść",
					sendDate: "2026-10-13",
					readDate: null,
					hasAttachments: false,
				},
				{
					messageId: "2",
					senderName: "Wychowawca",
					topic: "Wycieczka",
					content: "ukryta treść",
					sendDate: "2026-10-12",
					readDate: null,
					hasAttachments: true,
				},
				{
					messageId: "3",
					senderName: "Biblioteka",
					topic: "Zaległości",
					content: "ukryta treść",
					sendDate: "2026-10-10",
					readDate: "2026-10-11",
					hasAttachments: false,
				},
			],
			total: 3,
		})),
		readUnreadMessagesCount: vi.fn(async () => ({ inbox: 2, others: {} })),
		readHomeWorks: vi.fn(async () => [
			{
				id: 1,
				content: "Zadania 1-5",
				date: "2026-10-16",
				addDate: "2026-10-13",
				lessonNo: "2",
				timeFrom: null,
				timeTo: null,
				categoryId: null,
				categoryName: "Praca domowa",
				createdById: 55,
				createdByName: "Anna Kowalska",
				subjectId: 12,
				subjectName: "Matematyka",
			},
			{
				id: 2,
				content: "Czytanki",
				date: "2026-11-30",
				addDate: "2026-10-13",
				lessonNo: "1",
				timeFrom: null,
				timeTo: null,
				categoryId: null,
				categoryName: null,
				createdById: 56,
				createdByName: "Jan Nowak",
				subjectId: 13,
				subjectName: "Biologia",
			},
		]),
		readHomeWorkAssignments: vi.fn(async () => [
			{
				id: 9,
				topic: "Prezentacja",
				text: "",
				date: "2026-10-14",
				dueDate: "2026-10-20",
				teacherId: 60,
				teacherName: "Marek Zieliński",
				studentIds: [900],
				mustSendAttachFile: true,
				sendFilePossible: true,
				addedFiles: false,
			},
		]),
		readSchoolNotices: vi.fn(
			async (): Promise<SchoolNotice[]> => [
				{
					id: "1",
					subject: "Starsze",
					content: "Treść starszego",
					startDate: "2026-10-01",
					endDate: "2026-10-31",
					creationDate: "2026-10-01",
					wasRead: true,
					addedById: 1,
					addedByName: "Dyrekcja",
				},
				{
					id: "2",
					subject: "Nowsze",
					content: "Treść nowszego",
					startDate: "2026-10-14",
					endDate: "2026-10-20",
					creationDate: "2026-10-14",
					wasRead: false,
					addedById: 1,
					addedByName: "Dyrekcja",
				},
			],
		),
		...overrides,
	};
}

describe("gradesBySubject", () => {
	it("returns all grades with category and comments, newest first", async () => {
		const surface = fakeSurface();
		const result = await gradesBySubject(surface, jarA, {});
		expect(result.count).toBe(2);
		expect(result.grades[0]?.grade).toBe("5");
		expect(result.grades[0]?.category).toBe("Sprawdzian");
		expect(result.grades[0]?.comments).toEqual(["Bardzo dobra praca"]);
		expect(result.grades[0]?.countsToAverage).toBe(true);
		expect(result.grades[1]?.grade).toBe("4");
	});

	it("filters by subject ignoring case and Polish diacritics", async () => {
		const surface = fakeSurface();
		const result = await gradesBySubject(surface, jarA, { subject: "BIOLOGIĄ" });
		expect(result.count).toBe(1);
		expect(result.grades[0]?.subject).toBe("Biologia");
	});

	it("returns available subjects when the filter matches nothing", async () => {
		const surface = fakeSurface();
		const result = await gradesBySubject(surface, jarA, { subject: "chemia" });
		expect(result.count).toBe(0);
		expect(result.availableSubjects).toEqual(["Matematyka", "Biologia"]);
	});
});

describe("timetableForDay", () => {
	it("flattens today's lessons sorted by hour, marking canceled and substitutions", async () => {
		const surface = fakeSurface();
		const result = await timetableForDay(surface, jarA, { day: "dzis" }, () => NOON(2026, 10, 14));
		// 2026-10-14 is a Wednesday → the request must ask for Monday 2026-10-12.
		expect(surface.readTimetable).toHaveBeenCalledWith(jarA, "2026-10-12");
		expect(result.date).toBe("2026-10-14");
		expect(result.lessons.map((lesson) => lesson.hourFrom)).toEqual(["08:00", "10:00", "11:00"]);
		expect(result.lessons[1]?.status).toBe("odwolana");
		const substitution = result.lessons[2];
		expect(substitution?.status).toBe("zastepstwo");
		expect(substitution?.subject).toBe("Chemia → Fizyka");
		expect(substitution?.note).toBe("Przeniesienie");
	});

	it("returns tomorrow's (empty) day without treating it as an error", async () => {
		const surface = fakeSurface();
		const result = await timetableForDay(surface, jarA, { day: "jutro" }, () => NOON(2026, 10, 14));
		expect(surface.readTimetable).toHaveBeenCalledWith(jarA, "2026-10-12");
		expect(result.date).toBe("2026-10-15");
		expect(result.lessons).toEqual([]);
	});
});

describe("unreadMessages", () => {
	it("lists only unread metadata and never message content", async () => {
		const surface = fakeSurface();
		const result = await unreadMessages(surface, jarA, {});
		// The inbox read runs against the messages-session jar, not the G jar.
		expect(surface.establishMessagesSession).toHaveBeenCalledWith(jarA);
		expect(surface.readInboxMessages).toHaveBeenCalledWith(jarB, 1, 50);
		expect(result.unreadCount).toBe(2);
		expect(result.messages).toEqual([
			{ sender: "Sekretariat", topic: "Zebranie", sendDate: "2026-10-13" },
			{ sender: "Wychowawca", topic: "Wycieczka", sendDate: "2026-10-12" },
		]);
		for (const message of result.messages) {
			expect("content" in message).toBe(false);
		}
		expect(result.moreAvailable).toBe(false);
	});

	it("flags more available when the limit cuts the unread list", async () => {
		const surface = fakeSurface();
		const result = await unreadMessages(surface, jarA, { limit: 1 });
		expect(result.messages).toHaveLength(1);
		expect(result.moreAvailable).toBe(true);
	});
});

describe("upcomingHomework", () => {
	it("keeps only homework and assignments inside the horizon", async () => {
		const surface = fakeSurface();
		const result = await upcomingHomework(surface, jarA, { days: 14 }, () => NOON(2026, 10, 14));
		expect(result.from).toBe("2026-10-14");
		expect(result.to).toBe("2026-10-28");
		expect(result.homeworks).toEqual([
			{
				date: "2026-10-16",
				subject: "Matematyka",
				content: "Zadania 1-5",
				category: "Praca domowa",
				lessonNo: "2",
			},
		]);
		expect(result.assignments).toEqual([
			{
				dueDate: "2026-10-20",
				topic: "Prezentacja",
				teacher: "Marek Zieliński",
				mustAttachFile: true,
			},
		]);
	});
});

describe("schoolNotices", () => {
	it("sorts notices newest first and respects the limit", async () => {
		const surface = fakeSurface();
		const result = await schoolNotices(surface, jarA, { limit: 1 });
		expect(result.count).toBe(2);
		expect(result.notices).toHaveLength(1);
		expect(result.notices[0]?.subject).toBe("Nowsze");
	});
});

describe("date helpers", () => {
	it("localDateOf formats a local epoch as YYYY-MM-DD", () => {
		expect(localDateOf(NOON(2026, 10, 14))).toBe("2026-10-14");
	});

	it("addDays shifts across month ends", () => {
		expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
		expect(addDays("2026-10-14", -7)).toBe("2026-10-07");
	});

	it("mondayOf steps back to the ISO week start, Sunday included", () => {
		expect(mondayOf("2026-10-14")).toBe("2026-10-12"); // Wednesday
		expect(mondayOf("2026-10-12")).toBe("2026-10-12"); // Monday itself
		expect(mondayOf("2026-10-18")).toBe("2026-10-12"); // Sunday of the same week
	});

	it("normalizeText folds case and Polish diacritics", () => {
		expect(normalizeText("MATEMATYKA")).toBe("matematyka");
		expect(normalizeText("Żółć")).toBe("zolc");
	});
});

describe("LibrusSession", () => {
	it("logs in lazily once and reuses the jar across reads", async () => {
		const surface = fakeSurface();
		const session = new LibrusSession(surface, { login: "l", password: "p" });
		expect(surface.login).not.toHaveBeenCalled();
		await session.run((jar) => surface.readGrades(jar));
		await session.run((jar) => surface.readGrades(jar));
		expect(surface.login).toHaveBeenCalledTimes(1);
		// The reads ran against the jar the login produced.
		expect(surface.readGrades).toHaveBeenCalledWith(jarA);
	});

	it("re-logs in once when a read reports SESSION_EXPIRED", async () => {
		const readGrades = vi
			.fn()
			.mockRejectedValueOnce(new LibrusError("SESSION_EXPIRED", 401))
			.mockResolvedValueOnce([]);
		const surface = fakeSurface({ readGrades });
		const session = new LibrusSession(surface, { login: "l", password: "p" });
		const grades = await session.run((jar) => surface.readGrades(jar));
		expect(grades).toEqual([]);
		expect(surface.login).toHaveBeenCalledTimes(2);
		expect(readGrades).toHaveBeenCalledTimes(2);
	});

	it("propagates errors that are not session expiry", async () => {
		const surface = fakeSurface({
			readGrades: vi.fn().mockRejectedValue(new LibrusError("WRONG_CREDENTIALS", 403)),
		});
		const session = new LibrusSession(surface, { login: "l", password: "p" });
		await expect(session.run((jar) => surface.readGrades(jar))).rejects.toThrow(LibrusError);
		expect(surface.login).toHaveBeenCalledTimes(1);
	});
});

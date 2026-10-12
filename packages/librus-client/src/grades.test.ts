/**
 * Reader normalization against fixtures shaped per the audit JSON:
 * nested {Id, Url} references resolved through Resources when present.
 */
import { describe, expect, it, vi } from "vitest";
import { CookieJar } from "./cookie-jar";
import { readGradeCategories, readGradeComments, readGrades } from "./grades";
import type { HttpDeps } from "./http";

/** Gateway fixture: one grade plus the Resources index that names it. */
const GRADES_FIXTURE = {
	Grades: [
		{
			Id: 101,
			Grade: "5",
			Date: "2026-10-01",
			AddDate: "2026-10-01 08:00:00",
			Semester: 1,
			Subject: { Id: 12, Url: "/2.0/Subjects/12" },
			Student: { Id: 900, Url: "/2.0/Students/900" },
			Category: { Id: 5, Url: "/2.0/Categories/5" },
			AddedBy: { Id: 55, Url: "/2.0/Teachers/55" },
			Lesson: { Id: 77, Url: "/2.0/Lessons/77" },
			IsConstituent: true,
			IsSemester: false,
			IsFinal: false,
			IsSemesterProposition: false,
			IsFinalProposition: false,
		},
	],
	Resources: {
		"/2.0/Subjects/12": { Id: 12, Name: "Matematyka" },
		"/2.0/Teachers/55": { Id: 55, FirstName: "Anna", LastName: "Kowalska" },
	},
	Url: "https://synergia.librus.pl/gateway/api/2.0/Grades",
};

const CATEGORIES_FIXTURE = {
	Categories: [
		{
			Id: 5,
			Name: "Sprawdzian",
			Short: "S",
			Standard: true,
			Color: { Id: 1, Url: "/2.0/Colors/1" },
			ObligationToPerform: true,
		},
		{
			Id: 6,
			Name: "Ocena semestralna",
			Short: "H",
			Standard: false,
			Color: { Id: 1, Url: "/2.0/Colors/1" },
			IsSemestral: true,
		},
	],
	Resources: {},
	Url: "https://synergia.librus.pl/gateway/api/2.0/Grades/Categories",
};

const COMMENTS_FIXTURE = {
	Comments: [
		{
			Id: 8,
			Grade: { Id: 101, Url: "/2.0/Grades/101" },
			AddedBy: { Id: 55, Url: "/2.0/Teachers/55" },
			Text: "Bardzo dobra praca",
		},
	],
	Resources: {},
	Url: "https://synergia.librus.pl/gateway/api/2.0/Grades/Comments",
};

function depsWithFixtures(_fixtures: Record<string, unknown>): HttpDeps {
	const calls: string[] = [];
	return {
		fetch: vi.fn(async (input: string | URL | Request) => {
			const url =
				typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
			calls.push(url);
			const path = new URL(url).pathname;
			if (path.endsWith("/Grades")) return Response.json(GRADES_FIXTURE);
			if (path.endsWith("/Grades/Categories")) return Response.json(CATEGORIES_FIXTURE);
			return Response.json(COMMENTS_FIXTURE);
		}),
		now: () => 0,
		randomPart: () => "",
	} as HttpDeps;
}

describe("readGrades", () => {
	it("normalizes the fixture, resolving nested refs through Resources", async () => {
		const deps = depsWithFixtures({});
		const grades = await readGrades(CookieJar.empty(), deps);
		expect(grades).toEqual([
			{
				id: 101,
				grade: "5",
				dateOccurred: "2026-10-01",
				dateAdded: "2026-10-01 08:00:00",
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
				commentIds: [],
			},
		]);
	});

	it("works when Resources lacks an entry (names stay null)", async () => {
		const deps = depsWithFixtures({});
		const grades = await readGrades(CookieJar.empty(), deps);
		expect(grades[0]?.subjectName).toBe("Matematyka");
	});

	it("readGradeCategories maps the Categories array", async () => {
		const deps = depsWithFixtures({});
		const categories = await readGradeCategories(CookieJar.empty(), deps);
		expect(categories).toHaveLength(2);
		expect(categories[0]).toMatchObject({ id: 5, name: "Sprawdzian", short: "S", standard: true });
		expect(categories[1]?.isSemestral).toBe(true);
	});

	it("readGradeComments maps Grade/AddedBy refs and Text", async () => {
		const deps = depsWithFixtures({});

		const comments = await readGradeComments(CookieJar.empty(), deps);
		expect(comments).toEqual([{ id: 8, gradeId: 101, addedById: 55, text: "Bardzo dobra praca" }]);
	});
});

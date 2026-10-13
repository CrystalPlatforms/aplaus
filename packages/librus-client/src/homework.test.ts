/**
 * Homework readers against audit-shaped fixtures. The spelling test is the
 * regression guard for the audited 404 trap: `HomeWorkAssignments` (capital
 * W) is the only spelling the server serves.
 */
import { describe, expect, it, vi } from "vitest";
import { CookieJar } from "./cookie-jar";
import { readHomeWorkAssignments, readHomeWorks } from "./homework";
import type { HttpDeps } from "./http";

const HOMEWORKS_FIXTURE = {
	HomeWorks: [
		{
			Id: 900,
			Content: "Zadania 1-10, strona 42",
			Date: "2026-10-14",
			Category: { Id: 3, Url: "/2.0/HomeWorkCategories/3" },
			LessonNo: "4",
			TimeFrom: "11:00",
			TimeTo: "11:45",
			CreatedBy: { Id: 55, Url: "/2.0/Teachers/55" },
			Class: { Id: 3, Url: "/2.0/Classes/3" },
			Subject: { Id: 12, Url: "/2.0/Subjects/12" },
			AddDate: "2026-10-12 18:00:00",
		},
	],
	Resources: {
		"/2.0/Subjects/12": { Id: 12, Name: "Matematyka" },
		"/2.0/Teachers/55": { Id: 55, FirstName: "Anna", LastName: "Kowalska" },
		"/2.0/HomeWorkCategories/3": { Id: 3, Name: "Zadanie domowe" },
	},
	Url: "https://synergia.librus.pl/gateway/api/2.0/HomeWorks",
};

const ASSIGNMENTS_FIXTURE = {
	HomeWorkAssignments: [
		{
			Id: 910,
			Topic: "Wypracowanie",
			Text: "Opis jesieni, 2 strony",
			Date: "2026-10-12",
			DueDate: "2026-10-19",
			Teacher: { Id: 55, Url: "/2.0/Teachers/55" },
			Student: [{ Id: 900, Url: "/2.0/Students/900" }],
			StudentsWhoRead: [900],
			StudentsWhoMarkedAsDone: [],
			StudentsMarkedAsDoneDate: [],
			MustSendAttachFile: false,
			SendFilePossible: false,
			AddedFiles: false,
			HomeworkAssigmentFiles: [],
		},
	],
	Resources: {
		"/2.0/Teachers/55": { Id: 55, FirstName: "Anna", LastName: "Kowalska" },
	},
	Url: "https://synergia.librus.pl/gateway/api/2.0/HomeWorkAssignments",
};

/** Only the exact spellings are served; anything else answers 404 (audit trap). */
function depsServingOnlyCorrectSpelling(): HttpDeps {
	return {
		fetch: vi.fn(async (input: string | URL | Request) => {
			const url =
				typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
			if (url.endsWith("/HomeWorks")) return Response.json(HOMEWORKS_FIXTURE);
			if (url.endsWith("/HomeWorkAssignments")) return Response.json(ASSIGNMENTS_FIXTURE);
			return Response.json({ Error: "Not Found" }, { status: 404 });
		}),
		now: () => 0,
		randomPart: () => "",
	} as HttpDeps;
}

describe("readHomeWorks", () => {
	it("normalizes the fixture, resolving Subject/CreatedBy/Category through Resources", async () => {
		const deps = depsServingOnlyCorrectSpelling();
		const works = await readHomeWorks(CookieJar.empty(), deps);
		expect(works).toEqual([
			{
				id: 900,
				content: "Zadania 1-10, strona 42",
				date: "2026-10-14",
				addDate: "2026-10-12 18:00:00",
				lessonNo: "4",
				timeFrom: "11:00",
				timeTo: "11:45",
				categoryId: 3,
				categoryName: "Zadanie domowe",
				createdById: 55,
				createdByName: "Anna Kowalska",
				subjectId: 12,
				subjectName: "Matematyka",
			},
		]);
	});

	it("recovers the teacher id from the CreatedBy Url when the ref has no Id", async () => {
		const deps: HttpDeps = {
			fetch: vi.fn(async (input: string | URL | Request) => {
				const url =
					typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
				const path = new URL(url).pathname;
				const body = path.endsWith("/HomeWorks")
					? {
							HomeWorks: [
								{
									Id: 900,
									Content: "Zadania 1-10",
									Date: "2026-10-14",
									Subject: { Id: 12, Name: "Matematyka" },
									CreatedBy: { Url: "/2.0/Teachers/55" },
								},
							],
						}
					: { HomeWorkAssignments: [] };
				return Response.json(body);
			}),
			now: () => 0,
			randomPart: () => "",
		} as HttpDeps;
		const works = await readHomeWorks(CookieJar.empty(), deps);
		expect(works[0]?.createdById).toBe(55);
	});

	it("prefers the teacher name carried on the CreatedBy ref itself (no Resources needed)", async () => {
		const deps: HttpDeps = {
			fetch: vi.fn(async (input: string | URL | Request) => {
				const url =
					typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
				const path = new URL(url).pathname;
				const body = path.endsWith("/HomeWorks")
					? {
							HomeWorks: [
								{
									Id: 900,
									Content: "Zadania 1-10",
									Date: "2026-10-14",
									Subject: { Id: 12, Name: "Matematyka" },
									CreatedBy: { Id: 55, FirstName: "Anna", LastName: "Kowalska" },
								},
							],
						}
					: { HomeWorkAssignments: [] };
				return Response.json(body);
			}),
			now: () => 0,
			randomPart: () => "",
		} as HttpDeps;
		const works = await readHomeWorks(CookieJar.empty(), deps);
		expect(works[0]?.createdByName).toBe("Anna Kowalska");
		expect(works[0]?.subjectName).toBe("Matematyka");
	});
});

describe("readHomeWorkAssignments", () => {
	it("requests the exact capital-W spelling (404-trap regression guard)", async () => {
		const deps = depsServingOnlyCorrectSpelling();
		const assignments = await readHomeWorkAssignments(CookieJar.empty(), deps);
		// The mock 404s every misspelled path; data proves the exact spelling.
		expect(assignments).toHaveLength(1);
		const fetchMock = deps.fetch as ReturnType<typeof vi.fn>;
		const requested = fetchMock.mock.calls.map((call) => String(call[0]));
		expect(requested.some((u) => u.includes("/HomeworkAssignments"))).toBe(false);
		expect(requested.some((u) => u.includes("/HomeWorkAssignments"))).toBe(true);
	});

	it("normalizes topic, due date, teacher and student refs", async () => {
		const assignments = await readHomeWorkAssignments(
			CookieJar.empty(),
			depsServingOnlyCorrectSpelling(),
		);
		expect(assignments[0]).toEqual({
			id: 910,
			topic: "Wypracowanie",
			text: "Opis jesieni, 2 strony",
			date: "2026-10-12",
			dueDate: "2026-10-19",
			teacherId: 55,
			teacherName: "Anna Kowalska",
			studentIds: [900],
			mustSendAttachFile: false,
			sendFilePossible: false,
			addedFiles: false,
		});
	});
});

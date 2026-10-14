/** Lessons reader: names resolved from the envelope Resources index. */
import { describe, expect, it, vi } from "vitest";
import { CookieJar } from "./cookie-jar";
import type { HttpDeps } from "./http";
import { readLessons } from "./lessons";

const FIXTURE = {
	Lessons: [
		{
			Id: 701,
			Teacher: { Id: 55, Url: "/2.0/Teachers/55" },
			Subject: { Id: 12, Url: "/2.0/Subjects/12" },
			Class: { Id: 3, Url: "/2.0/Classes/3" },
		},
	],
	Resources: {
		"/2.0/Teachers/55": { Id: 55, FirstName: "Anna", LastName: "Kowalska" },
		"/2.0/Subjects/12": { Id: 12, Name: "Matematyka" },
	},
	Url: "https://synergia.librus.pl/gateway/api/2.0/Lessons",
};

function deps(): HttpDeps {
	return {
		fetch: vi.fn(async (input: string | URL | Request) => {
			const url =
				typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
			if (url.endsWith("/Lessons")) return Response.json(FIXTURE);
			return Response.json({}, { status: 404 });
		}),
		now: () => 0,
		randomPart: () => "",
	} as HttpDeps;
}

describe("readLessons", () => {
	it("normalizes lesson tuples with Resources names", async () => {
		const list = await readLessons(CookieJar.empty(), deps());
		expect(list).toEqual([
			{
				id: 701,
				subjectId: 12,
				subjectName: "Matematyka",
				teacherId: 55,
				teacherName: "Anna Kowalska",
				classId: 3,
			},
		]);
	});
});

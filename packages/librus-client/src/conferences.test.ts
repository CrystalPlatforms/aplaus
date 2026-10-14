/**
 * ParentTeacherConferences reader on the audited fixture (zebrania).
 */
import { describe, expect, it, vi } from "vitest";
import { readParentTeacherConferences } from "./conferences";
import { CookieJar } from "./cookie-jar";
import type { HttpDeps } from "./http";

const FIXTURE = {
	ParentTeacherConferences: [
		{
			Id: 88,
			Date: "2026-10-15",
			Name: "Zebranie ogólne",
			Class: { Id: 3, Url: "/2.0/Classes/3" },
			Teacher: { Id: 55, Url: "/2.0/Teachers/55" },
			Topic: "Plan na rok szkolny",
			Room: "204",
			Time: "17:00",
		},
	],
	Resources: {
		"/2.0/Teachers/55": { Id: 55, FirstName: "Anna", LastName: "Kowalska" },
	},
	Url: "https://synergia.librus.pl/gateway/api/2.0/ParentTeacherConferences",
};

function deps(): HttpDeps {
	return {
		fetch: vi.fn(async (input: string | URL | Request) => {
			const url =
				typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
			if (url.endsWith("/ParentTeacherConferences")) return Response.json(FIXTURE);
			return Response.json({}, { status: 404 });
		}),
		now: () => 0,
		randomPart: () => "",
	} as HttpDeps;
}

describe("readParentTeacherConferences", () => {
	it("normalizes the fixture, teacher name via Resources", async () => {
		const list = await readParentTeacherConferences(CookieJar.empty(), deps());
		expect(list).toEqual([
			{
				id: 88,
				date: "2026-10-15",
				name: "Zebranie ogólne",
				classId: 3,
				teacherId: 55,
				teacherName: "Anna Kowalska",
				topic: "Plan na rok szkolny",
				room: "204",
				time: "17:00",
			},
		]);
	});
});

/**
 * Classes reader: the payload is the singular `Class` object; tutors arrive
 * both as a single ClassTutor ref and the ClassTutors array (merged, deduped).
 */
import { describe, expect, it, vi } from "vitest";
import { readClasses } from "./classes";
import { CookieJar } from "./cookie-jar";
import type { HttpDeps } from "./http";

const FIXTURE = {
	Class: {
		Id: 3,
		Number: 4,
		Symbol: "b",
		BeginSchoolYear: "2026-09-01",
		EndFirstSemester: "2027-01-30",
		EndSchoolYear: "2027-06-25",
		Unit: { Id: 42, Url: "/2.0/Units/42" },
		ClassTutor: { Id: 55, Url: "/2.0/Teachers/55" },
		ClassTutors: [{ Id: 55, Url: "/2.0/Teachers/55" }],
	},
	Resources: {
		"/2.0/Teachers/55": { Id: 55, FirstName: "Anna", LastName: "Kowalska" },
	},
	Url: "https://synergia.librus.pl/gateway/api/2.0/Classes",
};

function deps(): HttpDeps {
	return {
		fetch: vi.fn(async (input: string | URL | Request) => {
			const url =
				typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
			if (url.endsWith("/Classes")) return Response.json(FIXTURE);
			return Response.json({}, { status: 404 });
		}),
		now: () => 0,
		randomPart: () => "",
	} as HttpDeps;
}

describe("readClasses", () => {
	it("normalizes the singular Class object, merging both tutor refs", async () => {
		const info = await readClasses(CookieJar.empty(), deps());
		expect(info).toEqual({
			id: 3,
			number: 4,
			symbol: "b",
			beginSchoolYear: "2026-09-01",
			endFirstSemester: "2027-01-30",
			endSchoolYear: "2027-06-25",
			unitId: 42,
			tutorIds: [55],
			tutorName: "Anna Kowalska",
		});
	});

	it("returns null when the payload has no Class object", async () => {
		const deps = {
			fetch: vi.fn(async () => Response.json({})),
			now: () => 0,
			randomPart: () => "",
		} as HttpDeps;
		await expect(readClasses(CookieJar.empty(), deps)).resolves.toBeNull();
	});
});

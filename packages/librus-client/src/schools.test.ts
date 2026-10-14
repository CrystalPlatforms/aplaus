/**
 * Schools reader: the payload key is the singular `School` object.
 */
import { describe, expect, it, vi } from "vitest";
import { CookieJar } from "./cookie-jar";
import type { HttpDeps } from "./http";
import { readSchool } from "./schools";

const FIXTURE = {
	School: {
		Id: 1,
		Name: "Szkoła Podstawowa nr 3",
		Town: "Poznań",
		Street: "ul. Szkolna 5",
		BuildingNumber: "5",
		PostCode: "60-001",
		Email: "sekretariat@example.pl",
		PhoneNumber: null,
		SchoolYear: 2026,
		NameHeadTeacher: "Jan",
		SurnameHeadTeacher: "Dyrektorski",
		LessonsRange: [{ From: "08:00", To: "16:00", RawFrom: 480, RawTo: 960 }],
	},
	Url: "https://synergia.librus.pl/gateway/api/2.0/Schools",
};

function deps(): HttpDeps {
	return {
		fetch: vi.fn(async (input: string | URL | Request) => {
			const url =
				typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
			if (url.endsWith("/Schools")) return Response.json(FIXTURE);
			return Response.json({}, { status: 404 });
		}),
		now: () => 0,
		randomPart: () => "",
	} as HttpDeps;
}

describe("readSchool", () => {
	it("normalizes the singular School object with head teacher and lessons range", async () => {
		const school = await readSchool(CookieJar.empty(), deps());
		expect(school).toEqual({
			id: 1,
			name: "Szkoła Podstawowa nr 3",
			town: "Poznań",
			street: "ul. Szkolna 5",
			buildingNumber: "5",
			postCode: "60-001",
			email: "sekretariat@example.pl",
			phoneNumber: null,
			schoolYear: 2026,
			headTeacherName: "Jan Dyrektorski",
			lessonsFrom: "08:00",
			lessonsTo: "16:00",
		});
	});

	it("returns null when the payload has no School object", async () => {
		const deps = {
			fetch: vi.fn(async () => Response.json({})),
			now: () => 0,
			randomPart: () => "",
		} as HttpDeps;
		await expect(readSchool(CookieJar.empty(), deps)).resolves.toBeNull();
	});
});

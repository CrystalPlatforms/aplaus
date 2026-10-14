/**
 * SchoolNotices reader on the audited fixture: `{SchoolNotices: [...],
 * Resources, Url}` — note `Id` is a STRING here (unlike most G resources).
 */
import { describe, expect, it, vi } from "vitest";
import { CookieJar } from "./cookie-jar";
import type { HttpDeps } from "./http";
import { readSchoolNotices } from "./notices";

const FIXTURE = {
	SchoolNotices: [
		{
			Id: "12345678",
			StartDate: "2026-10-01",
			EndDate: "2026-10-31",
			Subject: "Wywiadówka",
			Content: "Zebranie z rodzicami 15 października o 17:00.",
			AddedBy: { Id: 55, Url: "/2.0/Teachers/55" },
			CreationDate: "2026-09-30 10:00:00",
			WasRead: false,
		},
	],
	Resources: {
		"/2.0/Teachers/55": { Id: 55, FirstName: "Anna", LastName: "Kowalska" },
	},
	Url: "https://synergia.librus.pl/gateway/api 2.0/SchoolNotices",
};

function deps(): HttpDeps {
	return {
		fetch: vi.fn(async (input: string | URL | Request) => {
			const url =
				typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
			if (url.endsWith("/SchoolNotices")) return Response.json(FIXTURE);
			return Response.json({}, { status: 404 });
		}),
		now: () => 0,
		randomPart: () => "",
	} as HttpDeps;
}

function depsServing(body: unknown): HttpDeps {
	return {
		fetch: vi.fn(async () => Response.json(body)),
		now: () => 0,
		randomPart: () => "",
	} as HttpDeps;
}

describe("readSchoolNotices", () => {
	it("normalizes the fixture and keeps the string Id", async () => {
		const notices = await readSchoolNotices(CookieJar.empty(), deps());
		expect(notices).toEqual([
			{
				id: "12345678",
				subject: "Wywiadówka",
				content: "Zebranie z rodzicami 15 października o 17:00.",
				startDate: "2026-10-01",
				endDate: "2026-10-31",
				creationDate: "2026-09-30 10:00:00",
				wasRead: false,
				addedById: 55,
				addedByName: "Anna Kowalska",
			},
		]);
	});

	it("keeps items without an Id out of the list", async () => {
		const body = {
			SchoolNotices: [{ StartDate: "2026-10-01" }, { Id: "9", StartDate: "2026-10-01" }],
		};
		const notices = await readSchoolNotices(CookieJar.empty(), depsServing(body));
		expect(notices.map((n) => n.id)).toEqual(["9"]);
	});
});

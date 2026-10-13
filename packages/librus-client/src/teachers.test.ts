/**
 * Teachers reader: the account dictionary that fills unresolved teacher
 * names. Not in the audited confirmed list, so 404/403 must resolve to an
 * empty list, never fail the caller.
 */
import { describe, expect, it, vi } from "vitest";
import { CookieJar } from "./cookie-jar";
import type { HttpDeps } from "./http";
import { readTeachers } from "./teachers";

function depsWith(status: number, body: unknown): HttpDeps {
	return {
		fetch: vi.fn(async () => Response.json(body, { status })),
		now: () => 0,
		randomPart: () => "",
	} as HttpDeps;
}

const TEACHERS_FIXTURE = {
	Teachers: [
		{ Id: 55, FirstName: "Anna", LastName: "Kowalska" },
		{ Id: 56, FirstName: "Piotr", LastName: "Nowak" },
		{ Id: "bad", FirstName: "Bez", LastName: "Id" },
	],
	Resources: {},
	Url: "https://synergia.librus.pl/gateway/api/2.0/Teachers",
};

describe("readTeachers", () => {
	it("normalizes the dictionary entries", async () => {
		const teachers = await readTeachers(CookieJar.empty(), depsWith(200, TEACHERS_FIXTURE));
		expect(teachers).toEqual([
			{ id: 55, firstName: "Anna", lastName: "Kowalska" },
			{ id: 56, firstName: "Piotr", lastName: "Nowak" },
		]);
	});

	it("resolves to an empty list on 404 (endpoint not served to this account)", async () => {
		const teachers = await readTeachers(CookieJar.empty(), depsWith(404, { Error: "Not Found" }));
		expect(teachers).toEqual([]);
	});

	it("resolves to an empty list on 403", async () => {
		const teachers = await readTeachers(CookieJar.empty(), depsWith(403, { Error: "Forbidden" }));
		expect(teachers).toEqual([]);
	});
});

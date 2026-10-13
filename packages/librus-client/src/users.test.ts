/**
 * Users reader: the ONLY name source on real accounts (Teacher/OrgTeacher/
 * AddedBy refs are bare {Id, Url} into the Users space, Resources do not
 * cover them and /Teachers answers 404). 404/403 must resolve to null.
 */
import { describe, expect, it, vi } from "vitest";
import { CookieJar } from "./cookie-jar";
import type { HttpDeps } from "./http";
import { readUser } from "./users";

function depsWith(status: number, body: unknown): HttpDeps {
	return {
		fetch: vi.fn(async () => Response.json(body, { status })),
		now: () => 0,
		randomPart: () => "",
	} as HttpDeps;
}

describe("readUser", () => {
	it("normalizes the User envelope", async () => {
		const user = await readUser(
			CookieJar.empty(),
			1332267,
			depsWith(200, {
				User: { Id: 1332267, FirstName: "Marzena", LastName: "Muda", GroupId: 1 },
				Resources: {},
			}),
		);
		expect(user).toEqual({ id: 1332267, firstName: "Marzena", lastName: "Muda" });
	});

	it("resolves to null on 404", async () => {
		const user = await readUser(CookieJar.empty(), 1, depsWith(404, { Error: "Not Found" }));
		expect(user).toBeNull();
	});

	it("resolves to null on 403", async () => {
		const user = await readUser(CookieJar.empty(), 1, depsWith(403, { Error: "Forbidden" }));
		expect(user).toBeNull();
	});
});

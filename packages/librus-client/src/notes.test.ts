/**
 * Notes reader: the element shape was never observed (all audited accounts
 * answered an empty array), so the parser is defensive — an item counts when
 * it carries a numeric Id; every other field stays null on surprises.
 */
import { describe, expect, it, vi } from "vitest";
import { CookieJar } from "./cookie-jar";
import type { HttpDeps } from "./http";
import { readNotes } from "./notes";

function depsServing(body: unknown): HttpDeps {
	return {
		fetch: vi.fn(async () => Response.json(body)),
		now: () => 0,
		randomPart: () => "",
	} as HttpDeps;
}

describe("readNotes", () => {
	it("resolves an empty array to an empty list", async () => {
		const list = await readNotes(CookieJar.empty(), depsServing({ Notes: [] }));
		expect(list).toEqual([]);
	});

	it("counts an item with only an Id; unknown fields stay null", async () => {
		const body = { Notes: [{ Id: 5, Totally: "unknown" }] };
		const list = await readNotes(CookieJar.empty(), depsServing(body));
		expect(list).toEqual([
			{ id: 5, content: null, addedDate: null, addedById: null, addedByName: null },
		]);
	});

	it("resolves AddedBy name through Resources", async () => {
		const body = {
			Notes: [{ Id: 6, Content: "Uwaga", AddedBy: { Id: 55, Url: "/2.0/Teachers/55" } }],
			Resources: { "/2.0/Teachers/55": { Id: 55, FirstName: "Anna", LastName: "Kowalska" } },
		};
		const list = await readNotes(CookieJar.empty(), depsServing(body));
		expect(list).toEqual([
			{ id: 6, content: "Uwaga", addedDate: null, addedById: 55, addedByName: "Anna Kowalska" },
		]);
	});
});

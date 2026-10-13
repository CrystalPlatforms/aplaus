/**
 * Classrooms reader: the room dictionary filling timetable room symbols.
 * Outside the audited confirmed list, so 404/403 must resolve to [].
 */
import { describe, expect, it, vi } from "vitest";
import { readClassrooms } from "./classrooms";
import { CookieJar } from "./cookie-jar";
import type { HttpDeps } from "./http";

function depsWith(status: number, body: unknown): HttpDeps {
	return {
		fetch: vi.fn(async () => Response.json(body, { status })),
		now: () => 0,
		randomPart: () => "",
	} as HttpDeps;
}

const CLASSROOMS_FIXTURE = {
	Classrooms: [
		{ Id: "21", Symbol: "21", Name: "Sala 21" },
		{ Id: "24", Symbol: "24", Name: "Pracownia fizyczna" },
		{ NoId: true },
	],
	Resources: {},
	Url: "https://synergia.librus.pl/gateway/api/2.0/Classrooms",
};

describe("readClassrooms", () => {
	it("normalizes the room dictionary entries", async () => {
		const rooms = await readClassrooms(CookieJar.empty(), depsWith(200, CLASSROOMS_FIXTURE));
		expect(rooms).toEqual([
			{ id: "21", symbol: "21", name: "Sala 21" },
			{ id: "24", symbol: "24", name: "Pracownia fizyczna" },
		]);
	});

	it("resolves to an empty list on 404", async () => {
		const rooms = await readClassrooms(CookieJar.empty(), depsWith(404, { Error: "Not Found" }));
		expect(rooms).toEqual([]);
	});

	it("resolves to an empty list on 403", async () => {
		const rooms = await readClassrooms(CookieJar.empty(), depsWith(403, { Error: "Forbidden" }));
		expect(rooms).toEqual([]);
	});
});

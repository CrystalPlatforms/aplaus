/**
 * Subjects reader: the dictionary filling grade/lesson/homework subject
 * names. Outside the audited confirmed list, so 404/403 must resolve to [].
 */
import { describe, expect, it, vi } from "vitest";
import { CookieJar } from "./cookie-jar";
import type { HttpDeps } from "./http";
import { readSubjects } from "./subjects";

function depsWith(status: number, body: unknown): HttpDeps {
	return {
		fetch: vi.fn(async () => Response.json(body, { status })),
		now: () => 0,
		randomPart: () => "",
	} as HttpDeps;
}

const SUBJECTS_FIXTURE = {
	Subjects: [
		{ Id: 12, Name: "Matematyka", Short: "Mat" },
		{ Id: 13, Name: "Historia" },
		{ NoId: true },
	],
	Resources: {},
	Url: "https://synergia.librus.pl/gateway/api/2.0/Subjects",
};

describe("readSubjects", () => {
	it("normalizes the subject dictionary entries", async () => {
		const subjects = await readSubjects(CookieJar.empty(), depsWith(200, SUBJECTS_FIXTURE));
		expect(subjects).toEqual([
			{ id: 12, name: "Matematyka" },
			{ id: 13, name: "Historia" },
		]);
	});

	it("resolves to an empty list on 404", async () => {
		const subjects = await readSubjects(CookieJar.empty(), depsWith(404, { Error: "Not Found" }));
		expect(subjects).toEqual([]);
	});

	it("resolves to an empty list on 403", async () => {
		const subjects = await readSubjects(CookieJar.empty(), depsWith(403, { Error: "Forbidden" }));
		expect(subjects).toEqual([]);
	});
});

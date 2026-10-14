/**
 * Justifications reader on the audited fixture. The 200 payload is the one G
 * exception: `{status, message, data}` with lowercase keys — this suite pins
 * that shape (the G envelope would answer `{Justifications: [...]}`).
 */
import { describe, expect, it, vi } from "vitest";
import { CookieJar } from "./cookie-jar";
import type { HttpDeps } from "./http";
import { readJustifications } from "./justifications";

const FIXTURE = {
	status: "Ok",
	message: "Pobrano",
	data: [
		{
			id: 41,
			messageFromParent: "Prosze o usprawiedliwienie",
			postDate: "2026-10-10 08:00:00",
			justificationStatus: "accepted",
			lessons: [
				{ number: 1, date: "2026-10-09" },
				{ number: 2, date: "2026-10-09" },
			],
			attachment: true,
			dateFrom: "2026-10-09",
			dateTo: "2026-10-09",
			justifiedAbsences: 2,
			notifiedTeachers: [{ name: "Anna Kowalska" }],
		},
	],
	Resources: {},
	Url: "https://synergia.librus.pl/gateway/api/2.0/Justifications",
};

function depsServing(body: unknown, status = 200): HttpDeps {
	return {
		fetch: vi.fn(async () => Response.json(body, { status })),
		now: () => 0,
		randomPart: () => "",
	} as HttpDeps;
}

describe("readJustifications", () => {
	it("normalizes the {status, message, data} envelope, not the G shape", async () => {
		const list = await readJustifications(CookieJar.empty(), depsServing(FIXTURE));
		expect(list).toEqual([
			{
				id: 41,
				messageFromParent: "Prosze o usprawiedliwienie",
				postDate: "2026-10-10 08:00:00",
				justificationStatus: "accepted",
				lessons: [
					{ number: 1, date: "2026-10-09" },
					{ number: 2, date: "2026-10-09" },
				],
				hasAttachment: true,
				dateFrom: "2026-10-09",
				dateTo: "2026-10-09",
				justifiedAbsences: 2,
				notifiedTeachers: ["Anna Kowalska"],
			},
		]);
	});

	it("keeps items without an id out of the list", async () => {
		const body = { status: "Ok", message: "", data: [{ id: "not-a-number" }, { id: 7 }] };
		const list = await readJustifications(CookieJar.empty(), depsServing(body));
		expect(list.map((j) => j.id)).toEqual([7]);
	});

	it("propagates the 403 of a student account as FORBIDDEN", async () => {
		const error = {
			Status: "Error",
			Code: "AccessDenied",
			Message: "Brak dostępu",
		};
		await expect(
			readJustifications(CookieJar.empty(), depsServing(error, 403)),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});

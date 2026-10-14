/**
 * Picker odbiorców: readReceiversByType próbuje receivers/{type}, potem
 * zbiorcze receivers, normalizuje i deduplikuje wpisy.
 */
import { describe, expect, it, vi } from "vitest";
import { CookieJar } from "./cookie-jar";
import type { HttpDeps } from "./http";
import { readReceiversByType } from "./receivers";

function depsServingM(routes: Record<string, unknown>): { deps: HttpDeps; requests: string[] } {
	const requests: string[] = [];
	const deps: HttpDeps = {
		fetch: vi.fn(async (input: string | URL | Request) => {
			const url =
				typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
			requests.push(url);
			for (const [path, body] of Object.entries(routes)) {
				if (url.includes(path)) return Response.json(body);
			}
			return Response.json({}, { status: 404 });
		}),
		now: () => 0,
		randomPart: () => "",
	};
	return { deps, requests };
}

const JAR = CookieJar.empty();

describe("readReceiversByType", () => {
	it("czyta receivers/{type} i normalizuje firstName/lastName", async () => {
		const { deps, requests } = depsServingM({
			"receivers/schoolReceivers": {
				data: {
					list: [
						{ accountId: 301, firstName: "Anna", lastName: "Kowalska" },
						{ accountId: "302", name: "Jan Nowak" },
					],
				},
			},
		});
		const list = await readReceiversByType(JAR, "schoolReceivers", deps);
		expect(list).toEqual([
			{ typeId: "schoolReceivers", accountId: "301", name: "Anna Kowalska" },
			{ typeId: "schoolReceivers", accountId: "302", name: "Jan Nowak" },
		]);
		// Najpierw kadra (404), potem kandydaci — trzeci (receivers/{type}) trafia.
		// Najpierw kadra (404), potem kandydaci — trzeci (receivers/{type}) trafia.
		expect(requests[3]).toContain("/api/receivers/schoolReceivers");
	});

	it("czyta /receivers/groups/{type} z kluczem receiverId (kontrakt ze skanu)", async () => {
		const { deps } = depsServingM({
			"receivers/groups/teachers": {
				data: { list: [{ receiverId: 5, firstName: "Jan", lastName: "Ibidło" }] },
			},
		});
		const list = await readReceiversByType(JAR, "teachers", deps);
		expect(list).toEqual([{ typeId: "teachers", accountId: "5", name: "Jan Ibidło" }]);
	});

	it("404 na receivers/{type} spada na dalszych kandydatów (tu: types/{type} zwraca dane)", async () => {
		const { deps, requests } = depsServingM({
			// Kolejność ma znaczenie: includes() dopasowuje pierwszy pasujący klucz.
			"receivers/schoolReceivers": { status: 404, body: {} },
			"api/receivers": { data: { schoolReceivers: [{ accountId: 55, name: "Pan Jan" }] } },
		});
		const list = await readReceiversByType(JAR, "schoolReceivers", deps);
		expect(list).toEqual([{ typeId: "schoolReceivers", accountId: "55", name: "Pan Jan" }]);
		// URL pierwszego kandydata (receivers/groups/{t}) już zawiera podciąg
		// api/receivers — fixture zbiorczy serwuje dane od razu.
		expect(requests).toHaveLength(1);
	});

	it("obie odpowiedzi bez elementów → pusta lista zamiast błędu", async () => {
		const { deps } = depsServingM({});
		expect(await readReceiversByType(JAR, "schoolReceivers", deps)).toEqual([]);
	});
});

describe("HITL r.2 — nowe kandydaty ścieżek i kształtów", () => {
	it("dopasowuje klucz grouped bez wielkości liter (SchoolReceivers)", async () => {
		const { deps } = depsServingM({
			"receivers/schoolReceivers": { data: { SchoolReceivers: [{ accountId: 9, name: "Ola" }] } },
		});
		const list = await readReceiversByType(JAR, "schoolReceivers", deps);
		expect(list).toEqual([{ typeId: "SchoolReceivers", accountId: "9", name: "Ola" }]);
	});

	it("404 na pierwszych dwóch kandydatach → dane z receivers?type={type}", async () => {
		const { deps, requests } = depsServingM({
			"receivers/schoolReceivers": { status: 404, body: {} },
			"api/receivers?": { data: { schoolReceivers: [{ accountId: 77, name: "Ela" }] } },
		});
		const list = await readReceiversByType(JAR, "schoolReceivers", deps);
		expect(list).toEqual([{ typeId: "schoolReceivers", accountId: "77", name: "Ela" }]);
		// 404 na groups/{t}, groups/jst-{t}, receivers/{t}, types/{t} — dane
		// dopiero z trasy receivers?type={t} (piąty kandydat).
		// Kadra (404) + 5 kandydatów — dane z receivers?type={t} (6. żądanie).
		expect(requests).toHaveLength(6);
	});
});

describe("HITL r.15 — członkowie własnej grupy", () => {
	it("pseudo-typ group-{id} czyta /receivers-management z kluczem receiverId", async () => {
		const { deps, requests } = depsServingM({
			"receivers/custom-groups/21109/receivers-management": {
				data: { list: [{ receiverId: 9, firstName: "Ola", lastName: "Nowak" }] },
			},
		});
		const list = await readReceiversByType(JAR, "group-21109", deps);
		expect(list).toEqual([{ typeId: "schoolReceivers", accountId: "9", name: "Ola Nowak" }]);
		expect(requests[0]).toContain("receivers-management");
	});
});

describe("HITL r.16 — ground truth odbiorców", () => {
	it("Nauczyciele = student-subjects (przedmioty) x school-employees (nazwiska)", async () => {
		const { deps } = depsServingM({
			"receivers/student-subjects": {
				data: [{ teacherIdentifier: 2111928, subject: "Muzyka" }],
			},
			"receivers/groups/school-employees": {
				receivers: [{ accountId: "2111928", label: "Banachewicz Ewa" }],
			},
		});
		const list = await readReceiversByType(JAR, "teachers", deps);
		expect(list).toEqual([
			{ typeId: "teachers", accountId: "2111928", name: "Banachewicz Ewa — Muzyka" },
		]);
	});

	it("Wychowawcy = tylko nauczyciel z przedmiotem „Godzina wychowawcza”, samo nazwisko", async () => {
		const { deps } = depsServingM({
			"receivers/student-subjects": {
				data: [
					{ teacherIdentifier: 1292957, subject: "Godzina wychowawcza" },
					{ teacherIdentifier: 2111928, subject: "Muzyka" },
				],
			},
			"receivers/groups/school-employees": {
				receivers: [
					{ accountId: "1292957", label: "Kowalska Anna" },
					{ accountId: "2111928", label: "Banachewicz Ewa" },
				],
			},
		});
		const list = await readReceiversByType(JAR, "tutors", deps);
		expect(list).toEqual([{ typeId: "tutors", accountId: "1292957", name: "Kowalska Anna" }]);
	});

	it("kategorie pracowników (headteachers itd.) wypełnia kadra szkoły", async () => {
		const { deps } = depsServingM({
			"receivers/groups/school-employees": {
				receivers: [{ accountId: "1", label: "A B" }],
			},
		});
		const list = await readReceiversByType(JAR, "headteachers", deps);
		expect(list).toEqual([{ typeId: "headteachers", accountId: "1", name: "A B" }]);
	});

	it("rady rodziców (403 dla ucznia) pozostają puste — bez wrzucania kadry", async () => {
		const { deps } = depsServingM({
			"receivers/groups/school-employees": {
				receivers: [{ accountId: "1", label: "A B" }],
			},
		});
		expect(await readReceiversByType(JAR, "parentsCouncil", deps)).toEqual([]);
	});
});

describe("HITL r.17 — kadra szkoły jako kategoria", () => {
	it("school-employees czyta pełną listę pracowników z label", async () => {
		const { deps } = depsServingM({
			"receivers/groups/school-employees": {
				receivers: [
					{ accountId: "2111928", label: "Banachewicz Ewa" },
					{ accountId: "2765789", label: "Barańska Aleksandra" },
				],
			},
		});
		const list = await readReceiversByType(JAR, "school-employees", deps);
		expect(list).toEqual([
			{ typeId: "school-employees", accountId: "2111928", name: "Banachewicz Ewa" },
			{ typeId: "school-employees", accountId: "2765789", name: "Barańska Aleksandra" },
		]);
	});
});

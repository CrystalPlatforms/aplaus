/**
 * Attendance readers against audit-shaped fixtures: records carry Type refs,
 * the Types dictionary arrives in two observed variants (inline ColorRGB or
 * a Color ref resolved via Resources).
 */
import { describe, expect, it, vi } from "vitest";
import { readAttendances, readAttendanceTypes } from "./attendances";
import { CookieJar } from "./cookie-jar";
import type { HttpDeps } from "./http";

const ATTENDANCES_FIXTURE = {
	Attendances: [
		{
			Id: 501,
			Lesson: { Id: 77, Url: "/2.0/Lessons/77" },
			Student: { Id: 900, Url: "/2.0/Students/900" },
			Date: "2026-10-12",
			AddDate: "2026-10-12 16:00:00",
			LessonNo: 1,
			Semester: 1,
			Type: { Id: 1, Url: "/2.0/Attendances/Types/1" },
			AddedBy: { Id: 55, Url: "/2.0/Teachers/55" },
		},
		{
			Id: 502,
			Lesson: { Id: 78, Url: "/2.0/Lessons/78" },
			Student: { Id: 900, Url: "/2.0/Students/900" },
			Date: "2026-10-12",
			AddDate: "2026-10-12 16:00:00",
			LessonNo: 2,
			Semester: 1,
			Type: { Id: 2, Url: "/2.0/Attendances/Types/2" },
			AddedBy: { Id: 55, Url: "/2.0/Teachers/55" },
		},
		{
			Id: 503,
			Lesson: { Id: 79, Url: "/2.0/Lessons/79" },
			Student: { Id: 900, Url: "/2.0/Students/900" },
			Date: "2026-10-13",
			AddDate: "2026-10-13 16:00:00",
			LessonNo: 3,
			Semester: 2,
			Type: { Id: 3, Url: "/2.0/Attendances/Types/3" },
			AddedBy: { Id: 55, Url: "/2.0/Teachers/55" },
		},
	],
	Resources: {},
	Url: "https://synergia.librus.pl/gateway/api/2.0/Attendances",
};

const TYPES_FIXTURE = {
	Types: [
		{
			Id: 1,
			Name: "Obecność",
			Short: "ob",
			Standard: true,
			ColorRGB: "#3b82f6",
			IsPresenceKind: true,
			Order: 1,
			Identifier: "presence",
		},
		{
			Id: 2,
			Name: "Nieobecność",
			Short: "nb",
			Standard: true,
			Color: { Id: 4, Url: "/2.0/Colors/4" },
			IsPresenceKind: false,
			Order: 2,
			Identifier: "absence",
		},
		{
			Id: 3,
			Name: "Spóźnienie",
			Short: "sp",
			Standard: true,
			ColorRGB: "#f59e0b",
			IsPresenceKind: false,
			Order: 3,
			Identifier: "lateness",
		},
	],
	Resources: {
		"/2.0/Colors/4": { Id: 4, ColorRGB: "#ef4444" },
	},
	Url: "https://synergia.librus.pl/gateway/api/2.0/Attendances/Types",
};

function depsServingFixtures(): HttpDeps {
	return {
		fetch: vi.fn(async (input: string | URL | Request) => {
			const url =
				typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
			if (url.endsWith("/Attendances/Types")) return Response.json(TYPES_FIXTURE);
			if (url.endsWith("/Attendances")) return Response.json(ATTENDANCES_FIXTURE);
			return Response.json({ Error: "Not Found" }, { status: 404 });
		}),
		now: () => 0,
		randomPart: () => "",
	} as HttpDeps;
}

describe("readAttendances", () => {
	it("normalizes records with Type/AddedBy refs and semester", async () => {
		const attendances = await readAttendances(CookieJar.empty(), depsServingFixtures());
		expect(attendances).toEqual([
			{
				id: 501,
				lessonId: 77,
				date: "2026-10-12",
				addDate: "2026-10-12 16:00:00",
				lessonNo: 1,
				semester: 1,
				typeId: 1,
				addedById: 55,
			},
			{
				id: 502,
				lessonId: 78,
				date: "2026-10-12",
				addDate: "2026-10-12 16:00:00",
				lessonNo: 2,
				semester: 1,
				typeId: 2,
				addedById: 55,
			},
			{
				id: 503,
				lessonId: 79,
				date: "2026-10-13",
				addDate: "2026-10-13 16:00:00",
				lessonNo: 3,
				semester: 2,
				typeId: 3,
				addedById: 55,
			},
		]);
	});
});

describe("readAttendanceTypes", () => {
	it("normalizes both observed variants: inline ColorRGB and Color ref via Resources", async () => {
		const types = await readAttendanceTypes(CookieJar.empty(), depsServingFixtures());
		expect(types).toEqual([
			{
				id: 1,
				name: "Obecność",
				short: "ob",
				standard: true,
				colorHex: "#3b82f6",
				isPresenceKind: true,
				order: 1,
				identifier: "presence",
			},
			{
				id: 2,
				name: "Nieobecność",
				short: "nb",
				standard: true,
				colorHex: "#ef4444",
				isPresenceKind: false,
				order: 2,
				identifier: "absence",
			},
			{
				id: 3,
				name: "Spóźnienie",
				short: "sp",
				standard: true,
				colorHex: "#f59e0b",
				isPresenceKind: false,
				order: 3,
				identifier: "lateness",
			},
		]);
	});
});

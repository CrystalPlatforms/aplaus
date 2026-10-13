/**
 * resolveHomeworkTeachers: CreatedBy/Teacher refs point into the Users space
 * (/Teachers answers 404 on real accounts), so names come from Users/{id}.
 */
import { CookieJar, type HomeWork, type HomeWorkAssignment } from "@repo/librus-client";
import { describe, expect, it, vi } from "vitest";
import { resolveHomeworkTeachers } from "./homework-service";

const HOMEWORK = [
	{
		id: 900,
		content: "Zadania 1-10",
		date: "2026-10-14",
		addDate: "",
		lessonNo: "4",
		timeFrom: "11:00",
		timeTo: "11:45",
		categoryId: null,
		categoryName: null,
		createdById: 1332267,
		createdByName: null,
		subjectId: null,
		subjectName: null,
	},
] as unknown as HomeWork[];
const ASSIGNMENTS: HomeWorkAssignment[] = [];

describe("resolveHomeworkTeachers", () => {
	it("fills CreatedBy names from Users/{id}", async () => {
		const readUserFn = vi.fn(async (_jar: unknown, id: string | number) =>
			String(id) === "1332267" ? { id: 1332267, firstName: "Marzena", lastName: "Muda" } : null,
		);
		const { homeWorks } = await resolveHomeworkTeachers(
			CookieJar.empty(),
			HOMEWORK,
			ASSIGNMENTS,
			readUserFn as never,
		);
		expect(homeWorks[0]?.createdByName).toBe("Marzena Muda");
	});

	it("skips the lookup entirely when every name is already present", async () => {
		const readUserFn = vi.fn(async () => {
			throw new Error("must not be called");
		});
		const named: HomeWork[] = HOMEWORK.map((w) => ({ ...w, createdByName: "Jan Testowy" }));
		const { homeWorks } = await resolveHomeworkTeachers(
			CookieJar.empty(),
			named,
			ASSIGNMENTS,
			readUserFn as never,
		);
		expect(homeWorks[0]?.createdByName).toBe("Jan Testowy");
	});
});

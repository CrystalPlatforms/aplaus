/**
 * fillGradeNames: the /Teachers and /Subjects dictionaries fill the names
 * that the Grades envelope leaves unresolved ("—" in the grade drawer).
 */

import { CookieJar, type Grade, type Subject, type Teacher } from "@repo/librus-client";
import { describe, expect, it, vi } from "vitest";
import { fillGradeNames, resolveGradeTeachers } from "./grades-service";

function gradeOf(partial: Partial<Grade>): Grade {
	return {
		id: 1,
		grade: "5",
		dateOccurred: "2026-10-01",
		dateAdded: "",
		semester: 1,
		subjectId: null,
		subjectName: null,
		categoryId: null,
		addedById: null,
		addedByName: null,
		studentId: null,
		lessonId: null,
		isConstituent: true,
		isSemester: false,
		isFinal: false,
		isSemesterProposition: false,
		isFinalProposition: false,
		commentIds: [],
		...partial,
	};
}

describe("fillGradeNames", () => {
	it("fills names only where the envelope left them unresolved", () => {
		const teachers: Teacher[] = [
			{ id: 55, firstName: "Anna", lastName: "Kowalska" },
			{ id: 56, firstName: "Piotr", lastName: "Nowak" },
		];
		const subjects: Subject[] = [{ id: 12, name: "Matematyka" }];
		const grades = [
			gradeOf({ id: 101, addedById: 55, subjectId: 12 }),
			gradeOf({ id: 102, addedById: 99, subjectId: 99 }),
		];

		const filled = fillGradeNames(grades, teachers, subjects);
		expect(filled[0]?.addedByName).toBe("Anna Kowalska");
		expect(filled[0]?.subjectName).toBe("Matematyka");
		expect(filled[1]?.addedByName).toBeNull(); // teacher id not in the dictionary
		expect(filled[1]?.subjectName).toBeNull(); // subject id not in the dictionary
	});

	it("keeps envelope-provided names intact", () => {
		const grades = [
			gradeOf({
				id: 101,
				addedById: 55,
				addedByName: "Anna Kowalska",
				subjectId: 12,
				subjectName: "Matematyka",
			}),
		];
		const filled = fillGradeNames(grades, [], []);
		expect(filled[0]?.addedByName).toBe("Anna Kowalska");
		expect(filled[0]?.subjectName).toBe("Matematyka");
	});
});

describe("resolveGradeTeachers", () => {
	it("fills AddedBy names from Users/{id} when the envelope leaves them bare", async () => {
		const readUserFn = vi.fn(async (_jar: unknown, id: string | number) =>
			String(id) === "1332267" ? { id: 1332267, firstName: "Marzena", lastName: "Muda" } : null,
		);
		const grades = [gradeOf({ id: 101, addedById: 1332267, addedByName: null })];
		const resolved = await resolveGradeTeachers(CookieJar.empty(), grades, readUserFn as never);
		expect(resolved[0]?.addedByName).toBe("Marzena Muda");
	});

	it("keeps the grade untouched when the user is unreadable", async () => {
		const readUserFn = vi.fn(async () => null);
		const grades = [gradeOf({ id: 101, addedById: 99, addedByName: null })];
		const resolved = await resolveGradeTeachers(CookieJar.empty(), grades, readUserFn as never);
		expect(resolved[0]?.addedByName).toBeNull();
	});
});

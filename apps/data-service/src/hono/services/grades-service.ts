/**
 * Grades proxy: jar from KV, readers from librus-client.
 */
import {
	CookieJar,
	type Grade,
	type GradeCategory,
	type GradeComment,
	readGradeCategories,
	readGradeComments,
	readGrades,
	readSubjects,
	readTeachers,
	readUser,
	type Subject,
	type Teacher,
} from "@repo/librus-client";
import { loadAccount } from "@/kv/store";
import type { Result } from "../types/result";
import { toAppError } from "./librus-errors";

export interface GradesView {
	grades: Grade[];
	categories: GradeCategory[];
	comments: GradeComment[];
	/** The /Subjects dictionary, for name lookups when a grade list is empty. */
	subjects: Subject[];
}

/** Injectable boundary: the Librus readers. Tests replace them wholesale. */
export interface GradesDeps {
	readGrades: typeof readGrades;
	readGradeCategories: typeof readGradeCategories;
	readGradeComments: typeof readGradeComments;
	readTeachers: typeof readTeachers;
	readSubjects: typeof readSubjects;
}

const defaultGradesDeps: GradesDeps = {
	readGrades,
	readGradeCategories,
	readGradeComments,
	readTeachers,
	readSubjects,
};

/**
 * Fills names the Grades envelope leaves unresolved: AddedBy is only a
 * {Id, Url} ref and the Resources index does not always carry the teacher —
 * /Teachers is the account dictionary that does. Same for Subject names via
 * /Subjects (both best-effort, [] on 404/403).
 */
export function fillGradeNames(grades: Grade[], teachers: Teacher[], subjects: Subject[]): Grade[] {
	const teacherById = new Map(teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`.trim()]));
	const subjectById = new Map(subjects.map((s) => [s.id, s.name]));
	return grades.map((g) => ({
		...g,
		addedByName: g.addedByName ?? teacherById.get(g.addedById ?? -1) ?? null,
		subjectName: g.subjectName ?? subjectById.get(g.subjectId ?? -1) ?? null,
	}));
}

/**
 * Fills AddedBy names the Grades envelope cannot provide: the ref is a bare
 * {Id, Url} into the Users space and /Teachers answers 404 on real accounts,
 * so the name comes from Users/{id}. Best-effort per user.
 */
export async function resolveGradeTeachers(
	jar: CookieJar,
	grades: Grade[],
	readUserFn: typeof readUser = readUser,
): Promise<Grade[]> {
	const ids = new Set<string>();
	for (const grade of grades) {
		if (!grade.addedByName && grade.addedById != null) ids.add(String(grade.addedById));
	}
	if (ids.size === 0) return grades;
	const users = await Promise.all([...ids].map((id) => readUserFn(jar, id).catch(() => null)));
	const byId = new Map<string, string>();
	for (const user of users) {
		if (user) byId.set(String(user.id), `${user.firstName} ${user.lastName}`.trim());
	}
	return grades.map((g) => ({
		...g,
		addedByName: g.addedByName ?? byId.get(String(g.addedById ?? "")) ?? null,
	}));
}

/** Reads grades for the device-account context. */
export async function getGrades(
	kv: KVNamespace,
	accountId: string,
	deps: GradesDeps = defaultGradesDeps,
): Promise<Result<GradesView>> {
	const account = await loadAccount(kv, accountId);
	if (!account) {
		return {
			ok: false,
			error: {
				code: "SESSION_EXPIRED",
				message: "Sesja wygasła. Zaloguj się ponownie.",
				status: 401,
			},
		};
	}
	const jar = CookieJar.fromDTO(account.jar);
	try {
		const [grades, categories, comments, teachers, subjects] = await Promise.all([
			deps.readGrades(jar),
			deps.readGradeCategories(jar),
			deps.readGradeComments(jar),
			deps.readTeachers(jar).catch(() => [] as Teacher[]),
			deps.readSubjects(jar).catch(() => [] as Subject[]),
		]);
		const named = await resolveGradeTeachers(jar, fillGradeNames(grades, teachers, subjects));
		return {
			ok: true,
			data: { grades: named, categories, comments, subjects },
		};
	} catch (error) {
		return { ok: false, error: toAppError(error) };
	}
}

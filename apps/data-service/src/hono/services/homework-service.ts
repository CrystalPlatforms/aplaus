/**
 * Homework proxy: jar from KV, readers from librus-client.
 */
import {
	CookieJar,
	type HomeWork,
	type HomeWorkAssignment,
	readHomeWorkAssignments,
	readHomeWorks,
	readSubjects,
	readTeachers,
	readUser,
	type Subject,
	type Teacher,
} from "@repo/librus-client";
import { loadAccount } from "@/kv/store";
import type { Result } from "../types/result";
import { toAppError } from "./librus-errors";

export interface HomeworkView {
	homeWorks: HomeWork[];
	assignments: HomeWorkAssignment[];
}

/** Injectable boundary: the Librus readers. Tests replace them wholesale. */
export interface HomeworkDeps {
	readHomeWorks: typeof readHomeWorks;
	readHomeWorkAssignments: typeof readHomeWorkAssignments;
	readTeachers: typeof readTeachers;
	readSubjects: typeof readSubjects;
}

const defaultHomeworkDeps: HomeworkDeps = {
	readHomeWorks,
	readHomeWorkAssignments,
	readTeachers,
	readSubjects,
};

/**
 * Fills names the envelopes leave unresolved: teacher names (CreatedBy/
 * Teacher are {Id, Url} refs whose Resources entries are not always present)
 * from /Teachers, subject names from /Subjects.
 */
function fillNamesHomework(
	homeWorks: HomeWork[],
	assignments: HomeWorkAssignment[],
	teachers: Teacher[],
	subjects: Subject[],
): { homeWorks: HomeWork[]; assignments: HomeWorkAssignment[] } {
	const teacherById = new Map(teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`.trim()]));
	const subjectById = new Map(subjects.map((s) => [s.id, s.name]));
	return {
		homeWorks: homeWorks.map((w) => ({
			...w,
			createdByName: w.createdByName ?? teacherById.get(w.createdById ?? -1) ?? null,
			subjectName: w.subjectName ?? subjectById.get(w.subjectId ?? -1) ?? null,
		})),
		assignments: assignments.map((a) => ({
			...a,
			teacherName: a.teacherName ?? teacherById.get(a.teacherId ?? -1) ?? null,
		})),
	};
}

/**
 * Fills teacher names the HomeWorks envelopes cannot provide: CreatedBy/Teacher
 * refs point into the Users space, /Teachers answers 404 on real accounts, so
 * the names come from Users/{id}. Best-effort per user.
 */
export async function resolveHomeworkTeachers(
	jar: CookieJar,
	homeWorks: HomeWork[],
	assignments: HomeWorkAssignment[],
	readUserFn: typeof readUser = readUser,
): Promise<{ homeWorks: HomeWork[]; assignments: HomeWorkAssignment[] }> {
	const ids = new Set<string>();
	for (const w of homeWorks) {
		if (!w.createdByName && w.createdById != null) ids.add(String(w.createdById));
	}
	for (const a of assignments) {
		if (!a.teacherName && a.teacherId != null) ids.add(String(a.teacherId));
	}
	if (ids.size === 0) return { homeWorks, assignments };
	const users = await Promise.all([...ids].map((id) => readUserFn(jar, id).catch(() => null)));
	const byId = new Map<string, string>();
	for (const user of users) {
		if (user) byId.set(String(user.id), `${user.firstName} ${user.lastName}`.trim());
	}
	return {
		homeWorks: homeWorks.map((w) => ({
			...w,
			createdByName: w.createdByName ?? byId.get(String(w.createdById ?? "")) ?? null,
		})),
		assignments: assignments.map((a) => ({
			...a,
			teacherName: a.teacherName ?? byId.get(String(a.teacherId ?? "")) ?? null,
		})),
	};
}

/** Reads homework entries + assignments in the active-account context. */
export async function getHomework(
	kv: KVNamespace,
	accountId: string,
	deps: HomeworkDeps = defaultHomeworkDeps,
): Promise<Result<HomeworkView>> {
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
		const [homeWorks, assignments, teachers, subjects] = await Promise.all([
			deps.readHomeWorks(jar),
			deps.readHomeWorkAssignments(jar),
			deps.readTeachers(jar).catch(() => [] as Teacher[]),
			deps.readSubjects(jar).catch(() => [] as Subject[]),
		]);
		const dictionaryFilled = fillNamesHomework(homeWorks, assignments, teachers, subjects);
		const named = await resolveHomeworkTeachers(
			jar,
			dictionaryFilled.homeWorks,
			dictionaryFilled.assignments,
		);
		return { ok: true, data: named };
	} catch (error) {
		return { ok: false, error: toAppError(error) };
	}
}

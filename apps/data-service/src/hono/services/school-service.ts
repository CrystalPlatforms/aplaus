/**
 * School-domain proxy services: school meta, notices, notes, conferences,
 * lessons and justifications.
 *
 * Justifications carries the role gate: only parent accounts (groupId 5) may
 * read it; any other role answers FORBIDDEN without calling Librus.
 */
import {
	CookieJar,
	readClasses,
	readJustifications,
	readLessons,
	readNotes,
	readParentTeacherConferences,
	readSchool,
	readSchoolNotices,
	readSubjects,
	readTeachers,
	readUser,
} from "@repo/librus-client";
import { loadAccount } from "@/kv/store";
import type { Result } from "../types/result";
import { toAppError } from "./librus-errors";

/** Injectable boundary: the Librus readers, replaced wholesale in tests. */
export interface SchoolDeps {
	readSchool: typeof readSchool;
	readClasses: typeof readClasses;
	readLessons: typeof readLessons;
	readSubjects: typeof readSubjects;
	readTeachers: typeof readTeachers;
	readUser: typeof readUser;
	readNotes: typeof readNotes;
	readSchoolNotices: typeof readSchoolNotices;
	readParentTeacherConferences: typeof readParentTeacherConferences;
	readJustifications: typeof readJustifications;
}

const defaultSchoolDeps: SchoolDeps = {
	readSchool,
	readClasses,
	readLessons,
	readSubjects,
	readTeachers,
	readUser,
	readNotes,
	readSchoolNotices,
	readParentTeacherConferences,
	readJustifications,
};

interface Session {
	account: import("@/kv/store").AccountRecord;
	jar: CookieJar;
}

async function loadSession(kv: KVNamespace, accountId: string): Promise<Result<Session>> {
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
	return { ok: true, data: { account, jar: CookieJar.fromDTO(account.jar) } };
}

type OverviewLesson = Awaited<ReturnType<typeof readLessons>>[number];
type OverviewClasses = Awaited<ReturnType<typeof readClasses>>;

/**
 * Fills the names the envelopes leave unresolved: the /Subjects and /Teachers
 * dictionaries first; whatever is still nameless comes from Users/{id}
 * (/Teachers answers 404 on real accounts), best-effort, capped at 30 lookups.
 */
async function fillOverviewNames(
	jar: CookieJar,
	classes: OverviewClasses,
	lessons: OverviewLesson[],
	subjects: Awaited<ReturnType<typeof readSubjects>>,
	teachers: Awaited<ReturnType<typeof readTeachers>>,
	deps: SchoolDeps,
): Promise<{ classes: OverviewClasses; lessons: OverviewLesson[] }> {
	const teacherById = new Map(teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`.trim()]));
	const subjectById = new Map(subjects.map((s) => [s.id, s.name]));
	let lessonsNamed = lessons.map((lesson) => ({
		...lesson,
		subjectName: lesson.subjectName ?? subjectById.get(lesson.subjectId ?? -1) ?? null,
		teacherName: lesson.teacherName ?? teacherById.get(lesson.teacherId ?? -1) ?? null,
	}));
	let classesNamed =
		classes && classes.tutorName === null && classes.tutorIds.length > 0
			? { ...classes, tutorName: teacherById.get(classes.tutorIds[0] ?? -1) ?? null }
			: classes;
	const unresolved = new Set<string>();
	for (const lesson of lessonsNamed) {
		if (!lesson.teacherName && lesson.teacherId !== null) unresolved.add(String(lesson.teacherId));
	}
	if (classesNamed?.tutorName === null) {
		for (const tutorId of classesNamed.tutorIds) unresolved.add(String(tutorId));
	}
	if (unresolved.size === 0) {
		return { classes: classesNamed, lessons: lessonsNamed };
	}
	const capped = [...unresolved].slice(0, 30);
	const users = await Promise.all(capped.map((id) => deps.readUser(jar, id).catch(() => null)));
	const userById = new Map(
		users
			.filter((user) => user !== null)
			.map((user) => [String(user.id), `${user.firstName} ${user.lastName}`.trim()]),
	);
	lessonsNamed = lessonsNamed.map((lesson) => ({
		...lesson,
		teacherName: lesson.teacherName ?? userById.get(String(lesson.teacherId)) ?? null,
	}));
	if (classesNamed?.tutorName === null) {
		classesNamed = {
			...classesNamed,
			tutorName: userById.get(String(classesNamed.tutorIds[0])) ?? null,
		};
	}
	return { classes: classesNamed, lessons: lessonsNamed };
}

/** School + class + lessons overview for the school screen. */
export async function getSchoolOverview(
	kv: KVNamespace,
	accountId: string,
	deps: SchoolDeps = defaultSchoolDeps,
): Promise<
	Result<{
		school: Awaited<ReturnType<typeof readSchool>>;
		classes: Awaited<ReturnType<typeof readClasses>>;
		lessons: Awaited<ReturnType<typeof readLessons>>;
		subjects: Awaited<ReturnType<typeof readSubjects>>;
	}>
> {
	const session = await loadSession(kv, accountId);
	if (!session.ok) return session;
	try {
		const [school, classes, lessons, subjects, teachers] = await Promise.all([
			deps.readSchool(session.data.jar),
			deps.readClasses(session.data.jar),
			deps.readLessons(session.data.jar),
			deps.readSubjects(session.data.jar).catch(() => []),
			deps.readTeachers(session.data.jar).catch(() => []),
		]);
		const filled = await fillOverviewNames(
			session.data.jar,
			classes,
			lessons,
			subjects,
			teachers,
			deps,
		);
		// /Lessons carries one record per weekly lesson group, so subjects
		// repeat (WF x2, German x3). The screen wants one row per subject+teacher.
		const seen = new Set<string>();
		const lessonsUnique = filled.lessons.filter((lesson) => {
			const key =
				lesson.subjectId === null
					? `id:${lesson.id}`
					: `${lesson.subjectId}|${lesson.teacherId ?? "-"}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
		return {
			ok: true,
			data: { school, classes: filled.classes, lessons: lessonsUnique, subjects },
		};
	} catch (error) {
		return { ok: false, error: toAppError(error) };
	}
}

/** School notices (ogłoszenia) with their validity periods. */
export async function getSchoolNotices(
	kv: KVNamespace,
	accountId: string,
	deps: SchoolDeps = defaultSchoolDeps,
): Promise<Result<Awaited<ReturnType<typeof readSchoolNotices>>>> {
	const session = await loadSession(kv, accountId);
	if (!session.ok) return session;
	try {
		const notices = await deps.readSchoolNotices(session.data.jar);
		return { ok: true, data: notices };
	} catch (error) {
		return { ok: false, error: toAppError(error) };
	}
}

/** Notes (uwagi). */
export async function getNotes(
	kv: KVNamespace,
	accountId: string,
	deps: SchoolDeps = defaultSchoolDeps,
): Promise<Result<Awaited<ReturnType<typeof readNotes>>>> {
	const session = await loadSession(kv, accountId);
	if (!session.ok) return session;
	try {
		const notes = await deps.readNotes(session.data.jar);
		return { ok: true, data: notes };
	} catch (error) {
		return { ok: false, error: toAppError(error) };
	}
}

/** Parent-teacher conferences (zebrania). */
export async function getConferences(
	kv: KVNamespace,
	accountId: string,
	deps: SchoolDeps = defaultSchoolDeps,
): Promise<Result<Awaited<ReturnType<typeof readParentTeacherConferences>>>> {
	const session = await loadSession(kv, accountId);
	if (!session.ok) return session;
	try {
		const conferences = await deps.readParentTeacherConferences(session.data.jar);
		return { ok: true, data: conferences };
	} catch (error) {
		return { ok: false, error: toAppError(error) };
	}
}

/**
 * Justifications with the role gate: only parent accounts (groupId 5) may
 * read them; anything else answers FORBIDDEN without calling Librus.
 */
export async function getJustifications(
	kv: KVNamespace,
	accountId: string,
	deps: SchoolDeps = defaultSchoolDeps,
): Promise<Result<Awaited<ReturnType<typeof readJustifications>>>> {
	const session = await loadSession(kv, accountId);
	if (!session.ok) return session;
	if (session.data.account.groupId !== 5) {
		return {
			ok: false,
			error: {
				code: "FORBIDDEN",
				message: "Usprawiedliwienia są dostępne tylko dla kont rodzica.",
				status: 403,
			},
		};
	}
	try {
		const justifications = await deps.readJustifications(session.data.jar);
		return { ok: true, data: justifications };
	} catch (error) {
		return { ok: false, error: toAppError(error) };
	}
}

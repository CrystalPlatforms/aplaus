/**
 * Timetable + calendar proxy: jar from KV, readers from librus-client.
 */
import {
	type Classroom,
	CookieJar,
	readCalendars,
	readClassFreeDays,
	readClassrooms,
	readSubjects,
	readTeachers,
	readTimetable,
	readUser,
	type Subject,
	type Teacher,
	type Timetable,
} from "@repo/librus-client";
import { loadAccount } from "@/kv/store";
import type { Result } from "../types/result";
import { toAppError } from "./librus-errors";

export interface CalendarView {
	calendars: { id: string | number | null; url: string | null }[];
	freeDays: { id: string | number | null; date: string; name: string | null }[];
}

/** Injectable boundary: the Librus readers. Tests replace them wholesale. */
export interface TimetableDeps {
	readTimetable: typeof readTimetable;
	readCalendars: typeof readCalendars;
	readClassFreeDays: typeof readClassFreeDays;
	readTeachers: typeof readTeachers;
	readClassrooms: typeof readClassrooms;
	readSubjects: typeof readSubjects;
	readUser: typeof readUser;
}

const defaultTimetableDeps: TimetableDeps = {
	readTimetable,
	readCalendars,
	readClassFreeDays,
	readTeachers,
	readClassrooms,
	readSubjects,
	readUser,
};

/**
 * Fills what the Timetables envelope leaves as bare refs: its Resources
 * entries carry only Urls (audit-confirmed), so the original teacher of a
 * substitution comes from the /Teachers dictionary, room symbols from
 * /Classrooms and subject names from /Subjects. Best-effort: missing
 * dictionaries change nothing.
 */
export function fillTimetableNames(
	timetable: Timetable,
	teachers: Teacher[],
	classrooms: Classroom[],
	subjects: Subject[] = [],
): Timetable {
	const teacherName = new Map(
		teachers.map((t) => [String(t.id), `${t.firstName} ${t.lastName}`.trim()]),
	);
	const roomSymbol = new Map(classrooms.map((c) => [String(c.id), c.symbol]));
	const subjectName = new Map(subjects.map((s) => [String(s.id), s.name]));
	return {
		...timetable,
		days: timetable.days.map((day) => ({
			...day,
			slots: day.slots.map((slot) =>
				slot.map((lesson) => ({
					...lesson,
					classroomSymbol:
						lesson.classroomSymbol ?? roomSymbol.get(String(lesson.classroomId ?? "")) ?? null,
					teacherName:
						lesson.teacherName ?? teacherName.get(String(lesson.teacherId ?? "")) ?? null,
					orgTeacherName:
						lesson.orgTeacherName ?? teacherName.get(String(lesson.orgTeacherId ?? "")) ?? null,
					orgClassroomSymbol:
						lesson.orgClassroomSymbol ??
						roomSymbol.get(String(lesson.orgClassroomId ?? "")) ??
						null,
					subjectName:
						lesson.subjectName ?? subjectName.get(String(lesson.subjectId ?? "")) ?? null,
					orgSubjectName:
						lesson.orgSubjectName ?? subjectName.get(String(lesson.subjectId ?? "")) ?? null,
				})),
			),
		})),
	};
}

function missingTeacherIds(timetable: Timetable): Set<string> {
	const ids = new Set<string>();
	for (const day of timetable.days) {
		for (const slot of day.slots) {
			for (const lesson of slot) {
				if (!lesson.teacherName && lesson.teacherId != null) ids.add(String(lesson.teacherId));
				if (!lesson.orgTeacherName && lesson.orgTeacherId != null) {
					ids.add(String(lesson.orgTeacherId));
				}
			}
		}
	}
	return ids;
}

/**
 * Fills teacher names the Timetables envelope cannot provide: OrgTeacher refs
 * carry only {Id, Url} (no inline name, no Resources entry) and /Teachers
 * answers 404 on real accounts, so the name comes from Users/{id}. Best-effort:
 * an unreadable user leaves the name as-is.
 */
export async function resolveTeacherNames(
	jar: CookieJar,
	timetable: Timetable,
	readUserFn: typeof readUser = readUser,
): Promise<Timetable> {
	const ids = missingTeacherIds(timetable);
	if (ids.size === 0) return timetable;
	const users = await Promise.all([...ids].map((id) => readUserFn(jar, id).catch(() => null)));
	const byId = new Map<string, string>();
	for (const user of users) {
		if (user) byId.set(String(user.id), `${user.firstName} ${user.lastName}`.trim());
	}
	return {
		...timetable,
		days: timetable.days.map((day) => ({
			...day,
			slots: day.slots.map((slot) =>
				slot.map((lesson) => ({
					...lesson,
					teacherName: lesson.teacherName ?? byId.get(String(lesson.teacherId ?? "")) ?? null,
					orgTeacherName:
						lesson.orgTeacherName ?? byId.get(String(lesson.orgTeacherId ?? "")) ?? null,
				})),
			),
		})),
	};
}

/** Reads one week of the timetable in the device's active-account context. */
export async function getTimetable(
	kv: KVNamespace,
	accountId: string,
	weekStart: string,
	deps: TimetableDeps = defaultTimetableDeps,
): Promise<Result<Timetable>> {
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
		const [timetable, teachers, classrooms, subjects] = await Promise.all([
			deps.readTimetable(jar, weekStart),
			deps.readTeachers(jar).catch(() => [] as Teacher[]),
			deps.readClassrooms(jar).catch(() => [] as Classroom[]),
			deps.readSubjects(jar).catch(() => [] as Subject[]),
		]);
		const named = await resolveTeacherNames(
			jar,
			fillTimetableNames(timetable, teachers, classrooms, subjects),
		);
		return { ok: true, data: named };
	} catch (error) {
		return { ok: false, error: toAppError(error) };
	}
}

/** Reads the calendars + class free days of the active account. */
export async function getCalendar(
	kv: KVNamespace,
	accountId: string,
	deps: TimetableDeps = defaultTimetableDeps,
): Promise<Result<CalendarView>> {
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
		const [calendars, freeDays] = await Promise.all([
			deps.readCalendars(jar),
			deps.readClassFreeDays(jar),
		]);
		return { ok: true, data: { calendars, freeDays } };
	} catch (error) {
		return { ok: false, error: toAppError(error) };
	}
}

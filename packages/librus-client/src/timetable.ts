/**
 * Timetable reader: `Timetables?weekStart=YYYY-MM-DD`.
 *
 * G envelope per audit: `{ Timetable: { <date>: [[slot entries]] },
 * Pages: { Next, Prev } }`. The Timetable keys are dynamic dates; each date
 * maps to an array of period slots and each slot is an array of lesson
 * entries (a slot can be an empty array — no lesson in that period).
 */
import type { CookieJar } from "./cookie-jar";
import { gatewayRequest } from "./gateway";
import type { HttpDeps } from "./http";

/** One lesson entry in the week grid. */
export interface TimetableLesson {
	id: string | number | null;
	lessonId: string | number | null;
	classroomId: string | number | null;
	classroomSymbol: string | null;
	dateFrom: string;
	dateTo: string;
	/** Period number; Librus sends strings here. */
	lessonNo: string | null;
	dayNo: string | null;
	subjectId: string | number | null;
	subjectName: string | null;
	teacherId: string | number | null;
	teacherName: string | null;
	classId: number | null;
	isCanceled: boolean;
	isSubstitutionClass: boolean;
	substitutionNote: string | null;
	hourFrom: string;
	hourTo: string;
	/** Original (pre-substitution) values, per the audit's Org* fields. */
	orgSubjectName: string | null;
	orgTeacherName: string | null;
	orgTeacherId: string | number | null;
	orgLessonNo: string | null;
	orgHourFrom: string | null;
	orgHourTo: string | null;
	orgClassroomId: string | number | null;
	orgClassroomSymbol: string | null;
}

/** One day of the week: its date and its period slots. */
export interface TimetableDay {
	date: string;
	slots: TimetableLesson[][];
}

export interface Timetable {
	days: TimetableDay[];
	/** weekStart of the next/previous week, mapped from Pages.Next/Prev. */
	nextWeekStart: string | null;
	prevWeekStart: string | null;
}

/** Extracts the `weekStart` query param from a Pages.Next/Prev URL. */
export function weekStartFromUrl(url: string | null | undefined): string | null {
	if (!url) return null;
	try {
		const parsed = new URL(url, "https://synergia.librus.pl");
		const value = parsed.searchParams.get("weekStart");
		return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
	} catch {
		return null;
	}
}

/** Shifts a YYYY-MM-DD date by whole weeks (negative goes back). */
export function shiftWeekStart(weekStart: string, weeks: number): string | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !Number.isInteger(weeks)) return null;
	const date = new Date(`${weekStart}T00:00:00Z`);
	if (Number.isNaN(date.getTime())) return null;
	date.setUTCDate(date.getUTCDate() + weeks * 7);
	return date.toISOString().slice(0, 10);
}

function asString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
	return typeof value === "number" ? value : null;
}

function refId(ref: unknown): string | number | null {
	if (typeof ref !== "object" || ref === null) return null;
	const id = (ref as { Id?: unknown }).Id;
	return typeof id === "string" || typeof id === "number" ? id : null;
}

/**
 * Some envelopes send a teacher ref as a bare {Url} with no Id (the observed
 * account pattern), which makes the /Teachers dictionary match impossible.
 * The id still rides on the Url ("/2.0/Teachers/58"), so recover it there.
 */
function refIdWithUrlFallback(ref: unknown): string | number | null {
	const id = refId(ref);
	if (id !== null) return id;
	const url = typeof ref === "object" && ref !== null ? (ref as { Url?: unknown }).Url : null;
	if (typeof url !== "string") return null;
	const match = /\/(\d+)(?:\/)?$/.exec(url);
	return match ? Number(match[1]) : null;
}

function personNameOf(resource: Record<string, unknown> | null): string | null {
	if (!resource) return null;
	const first = asString(resource.FirstName);
	const last = asString(resource.LastName);
	return [first, last].filter(Boolean).join(" ") || null;
}

/**
 * Resolves a {Id, Url} ref through Resources. The Org- and Classroom refs
 * carry no inline names (audit: OrgTeacher/OrgSubject/OrgClassroom are
 * {Id, Url}), so the week grid needs the envelope's Resources index; keys
 * may differ from the ref URL by host/scheme, hence the path-suffix fallback.
 */
function resourceAt(
	resources: Record<string, unknown>,
	ref: unknown,
): Record<string, unknown> | null {
	if (typeof ref !== "object" || ref === null) return null;
	const url = asString((ref as Record<string, unknown>).Url);
	if (!url) return null;
	const direct = resources[url];
	if (typeof direct === "object" && direct !== null) return direct as Record<string, unknown>;
	const path = url.replace(/^https?:\/\/[^/]+/, "").toLowerCase();
	for (const [key, value] of Object.entries(resources)) {
		if (typeof value !== "object" || value === null) continue;
		const keyPath = key.replace(/^https?:\/\/[^/]+/, "").toLowerCase();
		if (keyPath === path || key.endsWith(path) || path.endsWith(keyPath)) {
			return value as Record<string, unknown>;
		}
	}
	return null;
}

function asInline(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function normalizeLesson(raw: unknown, resources: Record<string, unknown>): TimetableLesson | null {
	if (typeof raw !== "object" || raw === null) return null;
	const e = raw as Record<string, unknown>;
	const subject = typeof e.Subject === "object" && e.Subject !== null ? e.Subject : null;
	const teacher = typeof e.Teacher === "object" && e.Teacher !== null ? e.Teacher : null;
	const classroom = typeof e.Classroom === "object" && e.Classroom !== null ? e.Classroom : null;
	const s = (subject ?? {}) as Record<string, unknown>;
	const t = (teacher ?? {}) as Record<string, unknown>;
	const c = (classroom ?? {}) as Record<string, unknown>;
	// Inline names win when the ref carries them; Resources and the server-side
	// /Teachers + /Classrooms dictionaries are the fallback chain.
	const orgTeacher = asInline(e.OrgTeacher);
	const orgSubject = asInline(e.OrgSubject);
	const orgClassroom = asInline(e.OrgClassroom);
	return {
		id: refId(e.Lesson),
		lessonId: refId(e.Lesson),
		classroomId: refId(e.Classroom),
		classroomSymbol: asString(c.Symbol) ?? asString(resourceAt(resources, e.Classroom)?.Symbol),
		dateFrom: asString(e.DateFrom) ?? "",
		dateTo: asString(e.DateTo) ?? "",
		lessonNo: asString(e.LessonNo),
		dayNo: asString(e.DayNo),
		subjectId: refId(e.Subject),
		subjectName:
			asString(s.Name) ?? asString(s.Short) ?? asString(resourceAt(resources, e.Subject)?.Name),
		teacherName: personNameOf(t) ?? personNameOf(resourceAt(resources, e.Teacher)),
		teacherId: refIdWithUrlFallback(e.Teacher),
		classId: asNumber((e.Class as Record<string, unknown> | undefined)?.Id),
		isCanceled: e.IsCanceled === true,
		isSubstitutionClass: e.IsSubstitutionClass === true,
		substitutionNote: asString(e.SubstitutionNote),
		hourFrom: asString(e.HourFrom) ?? "",
		hourTo: asString(e.HourTo) ?? "",
		orgSubjectName:
			asString(orgSubject?.Name) ??
			asString(orgSubject?.Short) ??
			asString(resourceAt(resources, e.OrgSubject)?.Name),
		orgTeacherName: personNameOf(orgTeacher) ?? personNameOf(resourceAt(resources, e.OrgTeacher)),
		orgTeacherId: refIdWithUrlFallback(e.OrgTeacher),
		orgLessonNo: asString(e.OrgLessonNo),
		orgHourFrom: asString(e.OrgHourFrom),
		orgHourTo: asString(e.OrgHourTo),
		orgClassroomId: refId(e.OrgClassroom),
		orgClassroomSymbol:
			asString(orgClassroom?.Symbol) ?? asString(resourceAt(resources, e.OrgClassroom)?.Symbol),
	};
}

/** Reads and normalizes /Timetables for one week. */
export async function readTimetable(
	jar: CookieJar,
	weekStart: string,
	deps?: HttpDeps,
): Promise<Timetable> {
	const { body } = await gatewayRequest(
		jar,
		`Timetables?weekStart=${encodeURIComponent(weekStart)}`,
		deps,
	);
	const envelope = body as {
		Timetable?: Record<string, unknown>;
		Pages?: { Next?: unknown; Prev?: unknown };
		Resources?: unknown;
	};
	const timetable =
		typeof envelope.Timetable === "object" && envelope.Timetable !== null ? envelope.Timetable : {};
	const resources =
		typeof envelope.Resources === "object" && envelope.Resources !== null
			? (envelope.Resources as Record<string, unknown>)
			: {};
	const days: TimetableDay[] = [];
	for (const date of Object.keys(timetable)) {
		const slots = timetable[date];
		if (!Array.isArray(slots)) continue;
		days.push({
			date,
			slots: slots.map((slot) => {
				if (!Array.isArray(slot)) return [];
				return slot
					.map((entry) => normalizeLesson(entry, resources))
					.filter((l): l is TimetableLesson => l !== null);
			}),
		});
	}
	days.sort((a, b) => a.date.localeCompare(b.date));
	return {
		days,
		nextWeekStart: weekStartFromUrl(asString(envelope.Pages?.Next)),
		prevWeekStart: weekStartFromUrl(asString(envelope.Pages?.Prev)),
	};
}

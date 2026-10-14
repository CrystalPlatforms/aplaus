/**
 * Justifications reader: `/Justifications` (usprawiedliwienia).
 *
 * The one G resource whose 200 payload is NOT the usual `{<Resource>,
 * Resources, Url}` envelope — per audit it is `{ status, message, data: [...] }`
 * with lowercase keys throughout. A student account (role 8) gets 403; the
 * FORBIDDEN error propagates — the UI must gate the call by role first.
 */
import type { CookieJar } from "./cookie-jar";
import { gatewayRequest } from "./gateway";
import type { HttpDeps } from "./http";

export interface Justification {
	id: number;
	messageFromParent: string | null;
	postDate: string | null;
	justificationStatus: string | null;
	lessons: { number: number | null; date: string | null }[];
	hasAttachment: boolean;
	dateFrom: string | null;
	dateTo: string | null;
	justifiedAbsences: number | null;
	notifiedTeachers: string[];
}

function lessonsOf(j: Record<string, unknown>): Justification["lessons"] {
	const lessons: Justification["lessons"] = [];
	if (!Array.isArray(j.lessons)) return lessons;
	for (const rawLesson of j.lessons) {
		if (typeof rawLesson !== "object" || rawLesson === null) continue;
		const lesson = rawLesson as Record<string, unknown>;
		lessons.push({
			number: typeof lesson.number === "number" ? lesson.number : null,
			date: typeof lesson.date === "string" ? lesson.date : null,
		});
	}
	return lessons;
}

function notifiedTeachersOf(j: Record<string, unknown>): string[] {
	const names: string[] = [];
	if (!Array.isArray(j.notifiedTeachers)) return names;
	for (const rawTeacher of j.notifiedTeachers) {
		if (typeof rawTeacher !== "object" || rawTeacher === null) continue;
		const name = (rawTeacher as { name?: unknown }).name;
		if (typeof name === "string") names.push(name);
	}
	return names;
}

function normalizeJustification(raw: unknown): Justification | null {
	if (typeof raw !== "object" || raw === null) return null;
	const j = raw as Record<string, unknown>;
	const id = typeof j.id === "number" ? j.id : null;
	if (id === null) return null;
	const lessons = lessonsOf(j);
	const notifiedTeachers = notifiedTeachersOf(j);
	return {
		id,
		messageFromParent: typeof j.messageFromParent === "string" ? j.messageFromParent : null,
		postDate: typeof j.postDate === "string" ? j.postDate : null,
		justificationStatus: typeof j.justificationStatus === "string" ? j.justificationStatus : null,
		lessons,
		hasAttachment: j.attachment === true,
		dateFrom: typeof j.dateFrom === "string" ? j.dateFrom : null,
		dateTo: typeof j.dateTo === "string" ? j.dateTo : null,
		justifiedAbsences: typeof j.justifiedAbsences === "number" ? j.justifiedAbsences : null,
		notifiedTeachers,
	};
}

/** Reads /Justifications and normalizes the {status, message, data} envelope. */
export async function readJustifications(
	jar: CookieJar,
	deps?: HttpDeps,
): Promise<Justification[]> {
	const { body } = await gatewayRequest(jar, "Justifications", deps);
	const envelope = body as { data?: unknown };
	const list = Array.isArray(envelope.data) ? envelope.data : [];
	return list
		.map((raw) => normalizeJustification(raw))
		.filter((j): j is Justification => j !== null);
}

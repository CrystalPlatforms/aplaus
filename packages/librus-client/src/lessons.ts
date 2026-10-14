/**
 * Lessons reader: `/Lessons` — the account's lesson tuples (subject, teacher,
 * class) with names resolved from the envelope's `Resources` index.
 *
 * Shape per audit: `{ Lessons: [{ Id, Teacher: {Id,Url}, Subject: {Id,Url},
 * Class: {Id,Url} }], Resources, Url }`.
 */
import type { CookieJar } from "./cookie-jar";
import { gatewayRequest } from "./gateway";
import type { HttpDeps } from "./http";

/** One lesson tuple, normalized. */
export interface Lesson {
	id: number;
	subjectId: number | null;
	subjectName: string | null;
	teacherId: number | null;
	teacherName: string | null;
	classId: number | null;
}

function asString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
	return typeof value === "number" ? value : null;
}

function resourceOf(
	resources: Record<string, unknown>,
	ref: unknown,
): Record<string, unknown> | null {
	if (typeof ref !== "object" || ref === null) return null;
	const url = (ref as { Url?: unknown }).Url;
	if (typeof url !== "string") return null;
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

function personNameOf(resources: Record<string, unknown>, ref: unknown): string | null {
	const person = resourceOf(resources, ref);
	if (!person) return null;
	const first = asString(person.FirstName);
	const last = asString(person.LastName);
	return [first, last].filter(Boolean).join(" ") || null;
}

function refId(ref: unknown): number | null {
	if (typeof ref !== "object" || ref === null) return null;
	const id = (ref as { Id?: unknown }).Id;
	return typeof id === "number" ? id : null;
}

function normalizeLesson(raw: unknown, resources: Record<string, unknown>): Lesson | null {
	if (typeof raw !== "object" || raw === null) return null;
	const l = raw as Record<string, unknown>;
	const id = asNumber(l.Id);
	if (id === null) return null;
	const subject = resourceOf(resources, l.Subject);
	const teacher = resourceOf(resources, l.Teacher);
	return {
		id,
		subjectId: refId(l.Subject),
		subjectName: subject ? asString(subject.Name) : null,
		teacherId: refId(l.Teacher),
		teacherName: teacher ? personNameOf(resources, l.Teacher) : null,
		classId: refId(l.Class),
	};
}

/** Reads and normalizes /Lessons. */
export async function readLessons(jar: CookieJar, deps?: HttpDeps): Promise<Lesson[]> {
	const { body } = await gatewayRequest(jar, "Lessons", deps);
	const envelope = body as { Lessons?: unknown; Resources?: unknown };
	const list = Array.isArray(envelope.Lessons) ? envelope.Lessons : [];
	const resources =
		typeof envelope.Resources === "object" && envelope.Resources !== null
			? (envelope.Resources as Record<string, unknown>)
			: {};
	return list.map((raw) => normalizeLesson(raw, resources)).filter((l): l is Lesson => l !== null);
}

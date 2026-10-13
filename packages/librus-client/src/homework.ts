/**
 * Homework readers: `HomeWorks` (schedule entries) and
 * `HomeWorkAssignments` (assignments).
 *
 * The exact spelling `HomeWorkAssignments` (capital W) is load-bearing: the
 * audit recorded a 404 on the mis-spelled /HomeworkAssignments. Keep it.
 */
import type { CookieJar } from "./cookie-jar";
import { gatewayRequest } from "./gateway";
import type { HttpDeps } from "./http";

/** One schedule homework entry, normalized. */
export interface HomeWork {
	id: number;
	content: string;
	/** Date of the lesson the homework is for. */
	date: string;
	addDate: string;
	lessonNo: string | null;
	timeFrom: string | null;
	timeTo: string | null;
	categoryId: number | null;
	categoryName: string | null;
	createdById: number | null;
	createdByName: string | null;
	subjectId: number | null;
	subjectName: string | null;
}

/** One assignment, normalized. */
export interface HomeWorkAssignment {
	id: number;
	topic: string;
	text: string;
	date: string;
	/** Submission deadline. */
	dueDate: string;
	teacherId: number | null;
	teacherName: string | null;
	studentIds: number[];
	mustSendAttachFile: boolean;
	sendFilePossible: boolean;
	addedFiles: boolean;
}

function asString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
	return typeof value === "number" ? value : null;
}

/**
 * Some envelopes send refs as bare {Url} with no Id; recover the id from the
 * Url's trailing numeric segment ("/2.0/Teachers/55" -> 55) so the /Teachers
 * dictionary match stays possible.
 */
function refIdWithUrlFallback(ref: unknown): number | null {
	const id = refId(ref);
	if (id !== null) return id;
	const url = typeof ref === "object" && ref !== null ? (ref as { Url?: unknown }).Url : null;
	if (typeof url !== "string") return null;
	const match = /\/(\d+)(?:\/)?$/.exec(url);
	return match ? Number(match[1]) : null;
}

function refId(ref: unknown): number | null {
	if (typeof ref !== "object" || ref === null) return null;
	const id = (ref as { Id?: unknown }).Id;
	return typeof id === "number" ? id : null;
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
	// Tolerant fallback: the ref URL and the Resources keys do not always agree
	// on host/scheme — compare the path part instead.
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

function nameOf(resources: Record<string, unknown>, ref: unknown): string | null {
	const resource = resourceOf(resources, ref);
	if (!resource) return null;
	return asString(resource.Name);
}

function inlineNameOf(ref: unknown): string | null {
	if (typeof ref !== "object" || ref === null) return null;
	const inline = ref as { Name?: unknown; Short?: unknown };
	return asString(inline.Name) ?? asString(inline.Short);
}

function inlinePersonNameOf(ref: unknown): string | null {
	if (typeof ref !== "object" || ref === null) return null;
	const inline = ref as { FirstName?: unknown; LastName?: unknown };
	return [asString(inline.FirstName), asString(inline.LastName)].filter(Boolean).join(" ") || null;
}

function normalizeHomeWork(raw: unknown, resources: Record<string, unknown>): HomeWork | null {
	if (typeof raw !== "object" || raw === null) return null;
	const w = raw as Record<string, unknown>;
	const id = asNumber(w.Id);
	if (id === null) return null;
	return {
		id,
		content: asString(w.Content) ?? "",
		date: asString(w.Date) ?? "",
		addDate: asString(w.AddDate) ?? "",
		lessonNo: asString(w.LessonNo),
		timeFrom: asString(w.TimeFrom),
		timeTo: asString(w.TimeTo) ?? null,
		categoryId: refId(w.Category),
		categoryName: nameOf(resources, w.Category),
		createdById: refIdWithUrlFallback(w.CreatedBy),
		createdByName: inlinePersonNameOf(w.CreatedBy) ?? personNameOf(resources, w.CreatedBy),
		subjectId: refId(w.Subject),
		subjectName: inlineNameOf(w.Subject) ?? nameOf(resources, w.Subject),
	};
}

/**
 * Reads and normalizes /HomeWorks. Subject/CreatedBy/Category refs resolve
 * through Resources.
 */
export async function readHomeWorks(jar: CookieJar, deps?: HttpDeps): Promise<HomeWork[]> {
	const { body } = await gatewayRequest(jar, "HomeWorks", deps);
	const envelope = body as { HomeWorks?: unknown; Resources?: unknown };
	const list = Array.isArray(envelope.HomeWorks) ? envelope.HomeWorks : [];
	const resources =
		typeof envelope.Resources === "object" && envelope.Resources !== null
			? (envelope.Resources as Record<string, unknown>)
			: {};
	return list
		.map((raw) => normalizeHomeWork(raw, resources))
		.filter((w): w is HomeWork => w !== null);
}

function normalizeAssignment(
	raw: unknown,
	resources: Record<string, unknown>,
): HomeWorkAssignment | null {
	if (typeof raw !== "object" || raw === null) return null;
	const a = raw as Record<string, unknown>;
	const id = asNumber(a.Id);
	if (id === null) return null;
	const studentIds = Array.isArray(a.Student)
		? a.Student.map((s) => refId(s)).filter((id): id is number => id !== null)
		: [];
	return {
		id,
		topic: asString(a.Topic) ?? "",
		text: asString(a.Text) ?? "",
		date: asString(a.Date) ?? "",
		dueDate: asString(a.DueDate) ?? "",
		teacherId: refId(a.Teacher),
		teacherName: personNameOf(resources, a.Teacher),
		studentIds,
		mustSendAttachFile: a.MustSendAttachFile === true,
		sendFilePossible: a.SendFilePossible === true,
		addedFiles: a.AddedFiles === true,
	};
}

/**
 * Reads and normalizes /HomeWorkAssignments. The path spelling with a capital
 * W is what the server serves — a 404 goes to the mis-spelled lowercase form.
 */
export async function readHomeWorkAssignments(
	jar: CookieJar,
	deps?: HttpDeps,
): Promise<HomeWorkAssignment[]> {
	const { body } = await gatewayRequest(jar, "HomeWorkAssignments", deps);
	const envelope = body as { HomeWorkAssignments?: unknown; Resources?: unknown };
	const list = Array.isArray(envelope.HomeWorkAssignments) ? envelope.HomeWorkAssignments : [];
	const resources =
		typeof envelope.Resources === "object" && envelope.Resources !== null
			? (envelope.Resources as Record<string, unknown>)
			: {};
	return list
		.map((raw) => normalizeAssignment(raw, resources))
		.filter((a): a is HomeWorkAssignment => a !== null);
}

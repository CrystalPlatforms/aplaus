/**
 * Grades readers: Grades, Grades/Categories, Grades/Comments.
 *
 * Normalizes the G envelope into flat typed objects, resolving {Id, Url} refs
 * through Resources when the resource object is present.
 */
import type { CookieJar } from "./cookie-jar";
import { gatewayRequest } from "./gateway";
import type { HttpDeps } from "./http";

/** One grade, normalized. Names resolved via Resources when available. */
export interface Grade {
	id: number;
	grade: string;
	dateOccurred: string;
	dateAdded: string;
	semester: number;
	subjectId: number | null;
	subjectName: string | null;
	categoryId: number | null;
	addedById: number | null;
	addedByName: string | null;
	studentId: number | null;
	lessonId: number | null;
	isConstituent: boolean;
	isSemester: boolean;
	isFinal: boolean;
	isSemesterProposition: boolean;
	isFinalProposition: boolean;
	commentIds: number[];
}

export interface GradeCategory {
	id: number;
	name: string;
	short: string | null;
	standard: boolean;
	colorId: number | null;
	isSemestral: boolean;
	isFinal: boolean;
	isSemestralProposition: boolean;
	isFinalProposition: boolean;
	blockAnyGrades: boolean;
}

export interface GradeComment {
	id: number;
	gradeId: number | null;
	addedById: number | null;
	text: string | null;
}

interface Ref {
	Id?: unknown;
	Url?: string;
}

function refId(ref: unknown): number | null {
	if (typeof ref !== "object" || ref === null) return null;
	const id = (ref as Ref).Id;
	return typeof id === "number" ? id : null;
}

function refUrl(ref: unknown): string | null {
	if (typeof ref !== "object" || ref === null) return null;
	const url = (ref as Ref).Url;
	return typeof url === "string" ? url : null;
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
	const url = refUrl(ref);
	if (!url) return null;
	const direct = resources[url];
	if (typeof direct === "object" && direct !== null) return direct as Record<string, unknown>;
	// The ref URL and the Resources keys do not always agree on host/scheme —
	// fall back to comparing the path part ("/2.0/Teachers/55").
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

/**
 * Some envelopes send a teacher ref as a bare {Url} with no Id ("AddedBy" is
 * the observed case), which makes the /Teachers dictionary match impossible.
 * The id still rides on the Url ("/2.0/Teachers/55"), so recover it there.
 */
function refIdWithUrlFallback(ref: unknown): number | null {
	const id = refId(ref);
	if (id !== null) return id;
	const url = refUrl(ref);
	if (!url) return null;
	const match = /\/(\d+)(?:\/)?$/.exec(url);
	return match ? Number(match[1]) : null;
}

function normalizeGrade(raw: unknown, resources: Record<string, unknown>): Grade | null {
	if (typeof raw !== "object" || raw === null) return null;
	const g = raw as Record<string, unknown>;
	const id = asNumber(g.Id);
	if (id === null) return null;
	return {
		id,
		grade: asString(g.Grade) ?? "",
		dateOccurred: asString(g.Date) ?? "",
		dateAdded: asString(g.AddDate) ?? "",
		semester: asNumber(g.Semester) ?? 0,
		subjectId: refId(g.Subject),
		subjectName: inlineNameOf(g.Subject) ?? nameOf(resources, g.Subject),
		categoryId: refId(g.Category),
		addedById: refIdWithUrlFallback(g.AddedBy),
		addedByName: inlinePersonNameOf(g.AddedBy) ?? personNameOf(resources, g.AddedBy),
		studentId: refId(g.Student),
		lessonId: refId(g.Lesson),
		isConstituent: g.IsConstituent === true,
		isSemester: g.IsSemester === true,
		isFinal: g.IsFinal === true,
		isSemesterProposition: g.IsSemesterProposition === true,
		isFinalProposition: g.IsFinalProposition === true,
		commentIds: commentIdsOf(g.Comments),
	};
}

function commentIdsOf(value: unknown): number[] {
	if (!Array.isArray(value)) return [];
	return value.map((ref) => refId(ref)).filter((id): id is number => id !== null);
}

/** Reads and normalizes /Grades. */
export async function readGrades(jar: CookieJar, deps?: HttpDeps): Promise<Grade[]> {
	const { body } = await gatewayRequest(jar, "Grades", deps);
	const envelope = body as { Grades?: unknown; Resources?: unknown };
	const list = Array.isArray(envelope.Grades) ? envelope.Grades : [];
	const resources =
		typeof envelope.Resources === "object" && envelope.Resources !== null
			? (envelope.Resources as Record<string, unknown>)
			: {};
	return list
		.map((raw) => normalizeGrade(raw, resources))
		.filter((grade): grade is Grade => grade !== null);
}

/** Reads and normalizes /Grades/Categories. */
export async function readGradeCategories(
	jar: CookieJar,
	deps?: HttpDeps,
): Promise<GradeCategory[]> {
	const { body } = await gatewayRequest(jar, "Grades/Categories", deps);
	const envelope = body as { Categories?: unknown };
	const list = Array.isArray(envelope.Categories) ? envelope.Categories : [];
	return list.map(normalizeCategory).filter((c): c is GradeCategory => c !== null);
}

function normalizeCategory(raw: unknown): GradeCategory | null {
	if (typeof raw !== "object" || raw === null) return null;
	const c = raw as Record<string, unknown>;
	const id = asNumber(c.Id);
	if (id === null) return null;
	return {
		id,
		name: asString(c.Name) ?? "",
		short: asString(c.Short),
		standard: c.Standard === true,
		colorId: refId(c.Color),
		isSemestral: c.IsSemestral === true,
		isFinal: c.IsFinal === true,
		isSemestralProposition: c.IsSemestralProposition === true,
		isFinalProposition: c.IsFinalProposition === true,
		blockAnyGrades: c.BlockAnyGrades === true,
	};
}

/** Reads and normalizes /Grades/Comments. */
export async function readGradeComments(jar: CookieJar, deps?: HttpDeps): Promise<GradeComment[]> {
	const { body } = await gatewayRequest(jar, "Grades/Comments", deps);
	const envelope = body as { Comments?: unknown };
	const list = Array.isArray(envelope.Comments) ? envelope.Comments : [];
	return list.map(normalizeComment).filter((c): c is GradeComment => c !== null);
}

function normalizeComment(raw: unknown): GradeComment | null {
	if (typeof raw !== "object" || raw === null) return null;
	const c = raw as Record<string, unknown>;
	const id = asNumber(c.Id);
	if (id === null) return null;
	return {
		id,
		gradeId: refId(c.Grade),
		addedById: refId(c.AddedBy),
		text: asString(c.Text),
	};
}

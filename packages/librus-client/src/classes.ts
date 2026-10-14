/** Class reader for /Classes — the payload is the singular `Class` object. */
import type { CookieJar } from "./cookie-jar";
import { gatewayRequest } from "./gateway";
import type { HttpDeps } from "./http";

export interface ClassInfo {
	id: number;
	number: number | null;
	symbol: string | null;
	beginSchoolYear: string | null;
	endFirstSemester: string | null;
	endSchoolYear: string | null;
	unitId: number | null;
	tutorIds: number[];
	tutorName: string | null;
}

function tutorRefsOf(c: Record<string, unknown>): unknown[] {
	const refs: unknown[] = [];
	if (Array.isArray(c.ClassTutors)) refs.push(...c.ClassTutors);
	if (c.ClassTutor && typeof c.ClassTutor === "object") refs.push(c.ClassTutor);
	return refs;
}

function unitIdOf(c: Record<string, unknown>): number | null {
	const unitRef = c.Unit as { Id?: unknown } | undefined;
	return typeof unitRef?.Id === "number" ? unitRef.Id : null;
}

function classFieldsOf(c: Record<string, unknown>, resources: unknown): Omit<ClassInfo, "id"> {
	const tutorIds: number[] = [];
	for (const ref of tutorRefsOf(c)) {
		const tid =
			typeof (ref as { Id?: unknown }).Id === "number" ? (ref as { Id: number }).Id : null;
		if (tid !== null && !tutorIds.includes(tid)) tutorIds.push(tid);
	}
	return {
		number: typeof c.Number === "number" ? c.Number : null,
		symbol: typeof c.Symbol === "string" ? c.Symbol : null,
		beginSchoolYear: typeof c.BeginSchoolYear === "string" ? c.BeginSchoolYear : null,
		endFirstSemester: typeof c.EndFirstSemester === "string" ? c.EndFirstSemester : null,
		endSchoolYear: typeof c.EndSchoolYear === "string" ? c.EndSchoolYear : null,
		unitId: unitIdOf(c),
		tutorIds,
		tutorName: tutorNameOf(c, resources),
	};
}

export async function readClasses(jar: CookieJar, deps?: HttpDeps): Promise<ClassInfo | null> {
	const { body } = await gatewayRequest(jar, "Classes", deps);
	const envelope = body as { Class?: unknown; Resources?: unknown };
	if (typeof envelope.Class !== "object" || envelope.Class === null) return null;
	const c = envelope.Class as Record<string, unknown>;
	const id = typeof c.Id === "number" ? c.Id : null;
	if (id === null) return null;
	return { id, ...classFieldsOf(c, envelope.Resources) };
}

function resourceOf(
	resources: Record<string, unknown>,
	url: string,
): Record<string, unknown> | null {
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

function personNameOf(person: Record<string, unknown>): string | null {
	const first = typeof person.FirstName === "string" ? person.FirstName : "";
	const last = typeof person.LastName === "string" ? person.LastName : "";
	return [first, last].filter(Boolean).join(" ") || null;
}

function tutorNameOf(c: Record<string, unknown>, resources: unknown): string | null {
	if (typeof resources !== "object" || resources === null) return null;
	const res = resources as Record<string, unknown>;
	for (const ref of tutorRefsOf(c)) {
		if (typeof ref !== "object" || ref === null) continue;
		const url = (ref as { Url?: unknown }).Url;
		if (typeof url !== "string") continue;
		const person = resourceOf(res, url);
		if (person) return personNameOf(person);
	}
	return null;
}

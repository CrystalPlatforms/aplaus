/**
 * Subjects reader: `/Subjects` — the account dictionary of subjects.
 *
 * Not in the audited confirmed list, so the call is best-effort: a 404 or
 * 403 (account without the dictionary) resolves to an empty list instead of
 * failing the whole proxy read. Consumers use it to fill subject names that
 * the Grades/Timetables/HomeWorks envelopes leave unresolved.
 */
import type { CookieJar } from "./cookie-jar";
import { LibrusError } from "./errors";
import { gatewayRequest } from "./gateway";
import type { HttpDeps } from "./http";

export interface Subject {
	id: number;
	name: string;
}

function asString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
	return typeof value === "number" ? value : null;
}

/** Reads /Subjects; resolves to [] when the account has no dictionary. */
export async function readSubjects(jar: CookieJar, deps?: HttpDeps): Promise<Subject[]> {
	let body: unknown;
	try {
		({ body } = await gatewayRequest(jar, "Subjects", deps));
	} catch (error) {
		if (isLibrusError(error) && (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")) {
			return [];
		}
		throw error;
	}
	const envelope = body as { Subjects?: unknown };
	const list = Array.isArray(envelope.Subjects) ? envelope.Subjects : [];
	const subjects: Subject[] = [];
	for (const raw of list) {
		if (typeof raw !== "object" || raw === null) continue;
		const s = raw as Record<string, unknown>;
		const id = asNumber(s.Id);
		if (id === null) continue;
		subjects.push({ id, name: asString(s.Name) ?? asString(s.Short) ?? "" });
	}
	return subjects;
}

function isLibrusError(error: unknown): error is LibrusError {
	return error instanceof LibrusError;
}

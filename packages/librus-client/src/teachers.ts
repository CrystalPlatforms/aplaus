/**
 * Teachers reader: `/Teachers` — the account dictionary of teachers.
 *
 * Not in the audited confirmed list, so the call is best-effort: a 404 or
 * 403 (account without the dictionary) resolves to an empty list instead of
 * failing the whole proxy read. Consumers use it to fill names that the
 * Grades/HomeWorks envelopes leave unresolved.
 */
import type { CookieJar } from "./cookie-jar";
import { LibrusError } from "./errors";
import { gatewayRequest } from "./gateway";
import type { HttpDeps } from "./http";

export interface Teacher {
	id: number;
	firstName: string;
	lastName: string;
}

function asString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
	return typeof value === "number" ? value : null;
}

/** Reads /Teachers; resolves to [] when the account has no dictionary. */
export async function readTeachers(jar: CookieJar, deps?: HttpDeps): Promise<Teacher[]> {
	let body: unknown;
	try {
		({ body } = await gatewayRequest(jar, "Teachers", deps));
	} catch (error) {
		if (isLibrusError(error) && (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")) {
			return [];
		}
		throw error;
	}
	const envelope = body as { Teachers?: unknown };
	const list = Array.isArray(envelope.Teachers) ? envelope.Teachers : [];
	const teachers: Teacher[] = [];
	for (const raw of list) {
		if (typeof raw !== "object" || raw === null) continue;
		const t = raw as Record<string, unknown>;
		const id = asNumber(t.Id);
		if (id === null) continue;
		teachers.push({
			id,
			firstName: asString(t.FirstName) ?? "",
			lastName: asString(t.LastName) ?? "",
		});
	}
	return teachers;
}

function isLibrusError(error: unknown): error is LibrusError {
	return error instanceof LibrusError;
}

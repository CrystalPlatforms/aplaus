/**
 * Classrooms reader: `/Classrooms` — the account dictionary of rooms.
 *
 * Like /Teachers, it is outside the audited confirmed list, so the call is
 * best-effort: 404/403 resolve to an empty list. Consumers use it to fill
 * room symbols the Timetables envelope leaves as bare {Id, Url} refs (its
 * Resources entries carry no Symbol — audit-confirmed).
 */
import type { CookieJar } from "./cookie-jar";
import { LibrusError } from "./errors";
import { gatewayRequest } from "./gateway";
import type { HttpDeps } from "./http";

export interface Classroom {
	/** Room id; Timetable refs use string ids here. */
	id: string | number;
	symbol: string | null;
	name: string | null;
}

function asString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

/** Reads /Classrooms; resolves to [] when the account has no dictionary. */
export async function readClassrooms(jar: CookieJar, deps?: HttpDeps): Promise<Classroom[]> {
	let body: unknown;
	try {
		({ body } = await gatewayRequest(jar, "Classrooms", deps));
	} catch (error) {
		if (
			error instanceof LibrusError &&
			(error.code === "NOT_FOUND" || error.code === "FORBIDDEN")
		) {
			return [];
		}
		throw error;
	}
	const envelope = body as { Classrooms?: unknown };
	const list = Array.isArray(envelope.Classrooms) ? envelope.Classrooms : [];
	const rooms: Classroom[] = [];
	for (const raw of list) {
		if (typeof raw !== "object" || raw === null) continue;
		const c = raw as Record<string, unknown>;
		const id = typeof c.Id === "string" || typeof c.Id === "number" ? c.Id : null;
		if (id === null) continue;
		rooms.push({ id, symbol: asString(c.Symbol), name: asString(c.Name) });
	}
	return rooms;
}

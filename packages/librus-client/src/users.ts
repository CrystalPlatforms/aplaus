/**
 * Users reader: `Users/{id}` — the per-user name lookup.
 *
 * On this account shape Teachers/OrgTeacher/AddedBy refs carry only {Id, Url}
 * pointing at api.librus.pl/2.0/Users/…, the envelope's Resources do not
 * cover them and /Teachers answers 404 — the name exists only here.
 * Best-effort: 404/403 resolves to null instead of failing the proxy read.
 */
import type { CookieJar } from "./cookie-jar";
import { LibrusError } from "./errors";
import { gatewayRequest } from "./gateway";
import type { HttpDeps } from "./http";

export interface User {
	id: number | string;
	firstName: string;
	lastName: string;
}

function asString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

/** Reads one user; resolves to null when the account cannot see it. */
export async function readUser(
	jar: CookieJar,
	id: string | number,
	deps?: HttpDeps,
): Promise<User | null> {
	let body: unknown;
	try {
		({ body } = await gatewayRequest(jar, `Users/${encodeURIComponent(String(id))}`, deps));
	} catch (error) {
		if (
			error instanceof LibrusError &&
			(error.code === "NOT_FOUND" || error.code === "FORBIDDEN")
		) {
			return null;
		}
		throw error;
	}
	const envelope = body as { User?: unknown };
	if (typeof envelope.User !== "object" || envelope.User === null) return null;
	const raw = envelope.User as Record<string, unknown>;
	const userId = typeof raw.Id === "number" || typeof raw.Id === "string" ? raw.Id : null;
	if (userId === null) return null;
	return {
		id: userId,
		firstName: asString(raw.FirstName) ?? "",
		lastName: asString(raw.LastName) ?? "",
	};
}

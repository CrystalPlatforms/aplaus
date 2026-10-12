/**
 * Cookie jar for the Librus session.
 *
 * The protocol spans several hosts (synergia.librus.pl, api.librus.pl, and
 * wiadomosci.librus.pl later). The audit requires cookies per domain and per
 * path. One jar travels through the whole login dance and is persisted to KV
 * as a plain DTO, so a session survives isolate restarts.
 */
import { appliesTo, parseSetCookie } from "./cookie-parse";

export interface CookieRecord {
	name: string;
	value: string;
	/** Host the cookie belongs to; a leading dot means "any subdomain". */
	domain: string;
	path: string;
	/** Unix seconds; absent means a session cookie. */
	expires?: number;
}

/** Plain, JSON-serializable snapshot of a jar — what gets stored in KV. */
export type CookieJarDTO = CookieRecord[];

/**
 * Stores cookies per domain and path, and answers the `Cookie:` header for a
 * request URL. RFC 6265 longest-path-first ordering is not implemented —
 * Librus does not depend on cookie order, so stored order is used.
 */
export class CookieJar {
	private cookies = new Map<string, CookieRecord>();

	static empty(): CookieJar {
		return new CookieJar();
	}

	static fromDTO(dto: CookieJarDTO): CookieJar {
		const jar = CookieJar.empty();
		for (const record of dto) {
			jar.cookies.set(keyOf(record), record);
		}
		return jar;
	}

	storeFromResponse(url: URL, headers: string[]): void {
		for (const header of headers) {
			const cookie = parseSetCookie(header, url.hostname);
			if (cookie) this.cookies.set(keyOf(cookie), cookie);
		}
	}

	cookieHeader(_url: URL): string | null {
		const now = Date.now() / 1000;
		const matches = [...this.cookies.values()].filter((c) => appliesTo(c, _url, now));
		if (matches.length === 0) return null;
		return matches.map((c) => `${c.name}=${c.value}`).join("; ");
	}

	/** Plain snapshot for persistence (KV) or assertions. */
	toDTO(): CookieJarDTO {
		return [...this.cookies.values()];
	}
}

function keyOf(cookie: CookieRecord): string {
	return `${cookie.domain}|${cookie.path}|${cookie.name}`;
}

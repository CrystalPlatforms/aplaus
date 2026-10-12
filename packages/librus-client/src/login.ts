/**
 * The Librus login dance: portal → OAuth (x-baner) → goTo → Synergia.
 */
import { buildBaner } from "./baner";
import { CookieJar } from "./cookie-jar";
import { LibrusError } from "./errors";
import { defaultDeps, type HttpDeps, walkRedirects } from "./http";
import { readMe } from "./me";

const PORTAL_LOGIN_URL = "https://synergia.librus.pl/loguj/portalRodzina";
const USER_AGENT = "librus-api-verification/1.0";
export interface LibrusAccount {
	id: number;
	firstName: string;
	lastName: string;
	login: string;
	/** Librus role: 8 = uczeń, 5 = rodzic. */
	groupId: number;
}

export interface LoginOutcome {
	jar: CookieJar;
	account: LibrusAccount;
}

/**
 * Resolves the `goTo` continuation address no matter its shape: a full URL, a
 * scheme-less host ("synergia.librus.pl/x") or a relative path ("/x"). Null
 * when nothing parses — the caller maps that to a typed login failure.
 */
export function resolveContinueUrl(raw: string, base: string): string | null {
	const candidates = [raw, `https://${raw}`];
	for (const candidate of candidates) {
		try {
			return new URL(candidate, base).toString();
		} catch {
			/* try the next shape */
		}
	}
	return null;
}

export async function loginToLibrus(
	login: string,
	password: string,
	deps: HttpDeps = defaultDeps,
): Promise<LoginOutcome> {
	const jar = CookieJar.empty();
	const portal = await walkRedirects(
		PORTAL_LOGIN_URL,
		{ method: "GET", headers: { "User-Agent": USER_AGENT } },
		jar,
		deps,
	);
	if (portal.response.status !== 200) {
		throw new LibrusError("LOGIN_FAILED", 502);
	}
	// The credentials POST goes to the state-bearing OAuth address observed in
	// the chain, not to the final (state-stripped) page URL — posting to the
	// stripped URL answers with an OAuth `error=invalid_request` redirect. The
	// audit says exactly this: the state-parameter address is dynamic and must
	// never be hardcoded, but it IS the address to use.
	const formUrl =
		portal.visited
			.find((u) => u.hostname === "api.librus.pl" && u.searchParams.has("state"))
			?.toString() ?? portal.url.toString();
	const body = new URLSearchParams({ action: "login", login, pass: password });
	const baner = buildBaner(deps.now(), deps.randomPart());
	// The POST must carry the session cookies gathered during the OAuth walk
	// (the audit's request snapshot includes `Cookie:`) — walkRedirects is what
	// attaches them; a bare fetch here would send the login without a session
	// and the server would bounce it back to the form.
	const loginResponse = await walkRedirects(
		formUrl,
		{
			method: "POST",
			headers: {
				"User-Agent": USER_AGENT,
				"Content-Type": "application/x-www-form-urlencoded",
				Accept: "application/json",
				"X-Requested-With": "XMLHttpRequest",
				Origin: "https://api.librus.pl",
				Referer: formUrl,
				"x-baner": baner,
			},
			body: body.toString(),
		},
		jar,
		deps,
	);
	if (loginResponse.response.status === 403) {
		throw new LibrusError("WRONG_CREDENTIALS", 403);
	}
	if (!loginResponse.response.ok) {
		throw new LibrusError("LOGIN_FAILED", 502);
	}
	const payload = (await loginResponse.response.json()) as { status?: string; goTo?: string };
	if (typeof payload.goTo !== "string") {
		throw new LibrusError("LOGIN_FAILED", 502);
	}
	// The audit shows `goTo` as a full URL, but the server also emits relative
	// or scheme-less addresses; a raw `new URL(goTo)` on those crashes with
	// "Invalid URL string." mid-login. Resolve every shape or fail typed.
	const goToUrl = resolveContinueUrl(payload.goTo.trim(), formUrl);
	if (!goToUrl) {
		throw new LibrusError("LOGIN_FAILED", 502);
	}

	const synergia = await walkRedirects(
		goToUrl,
		{ method: "GET", headers: { "User-Agent": USER_AGENT } },
		jar,
		deps,
	);
	if (!synergia.url.hostname.endsWith("librus.pl") || synergia.response.status !== 200) {
		throw new LibrusError("LOGIN_FAILED", 502);
	}

	const me = await readMe(jar, deps);
	return { jar, account: me };
}

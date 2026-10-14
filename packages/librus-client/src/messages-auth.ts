/**
 * Messages (M) session: the `wiadomosci3` to `MultiDomainLogon` chain.
 *
 * GET synergia.librus.pl/wiadomosci3 with the G jar redirects into
 * wiadomosci.librus.pl; the MultiDomainLogon hop sets the M session cookies.
 * Returns a jar holding ONLY wiadomosci.librus.pl cookies, kept next to the
 * G jar (the plan's two-jar account model). The confidential token and
 * encoded login in the redirect URL are never logged - nothing here prints.
 */
import { CookieJar } from "./cookie-jar";
import { LibrusError } from "./errors";
import { defaultDeps, type HttpDeps, walkRedirects } from "./http";

const USER_AGENT = "librus-api-verification/1.0";
const M_HOST_SUFFIX = "wiadomosci.librus.pl";

export async function establishMessagesSession(
	gJar: CookieJar,
	deps: HttpDeps = defaultDeps,
): Promise<CookieJar> {
	const walkJar = CookieJar.fromDTO(gJar.toDTO());
	const walk = await walkRedirects(
		"https://synergia.librus.pl/wiadomosci3",
		{ method: "GET", headers: { Accept: "text/html", "User-Agent": USER_AGENT } },
		walkJar,
		deps,
	);
	const landedOnM = walk.url.hostname.endsWith(M_HOST_SUFFIX);
	if (!walk.response.ok) {
		throw new LibrusError("UNEXPECTED_RESPONSE", 502);
	}
	if (!landedOnM) {
		// wiadomosci3 redirected back into Synergia (e.g. the login form) - the
		// G session is stale; map that to the same code the readers use so the
		// device renewal flow picks it up.
		throw new LibrusError("SESSION_EXPIRED", 401);
	}
	return mJarOf(walkJar);
}

/** Extracts the wiadomosci.librus.pl cookies from a walked jar. */
function mJarOf(jar: CookieJar): CookieJar {
	const mDto = jar
		.toDTO()
		.filter((cookie) => cookie.domain.replace(/^\./, "").endsWith(M_HOST_SUFFIX));
	return CookieJar.fromDTO(mDto);
}

/**
 * Gateway transport for the Synergia API (G): one authenticated GET with the
 * session jar, HTTP-status-first error mapping.
 *
 * 401 -> SESSION_EXPIRED, 403 -> FORBIDDEN, 404 -> NOT_FOUND, before parsing.
 */
import type { CookieJar } from "./cookie-jar";
import { LibrusError } from "./errors";
import { defaultDeps, type HttpDeps, walkRedirects } from "./http";

const USER_AGENT = "librus-api-verification/1.0";

export interface GatewayResponse {
	/** The raw parsed body of the final response. */
	body: unknown;
	/** The URL of the final response. */
	url: URL;
}

export async function gatewayRequest(
	jar: CookieJar,
	path: string,
	deps: HttpDeps = defaultDeps,
): Promise<GatewayResponse> {
	const walk = await walkRedirects(
		`https://synergia.librus.pl/gateway/api/2.0/${path}`,
		{ method: "GET", headers: { Accept: "application/json", "User-Agent": USER_AGENT } },
		jar,
		deps,
	);
	const { response } = walk;
	if (response.status === 401) throw new LibrusError("SESSION_EXPIRED", 401);
	if (response.status === 403) throw new LibrusError("FORBIDDEN", 403);
	if (response.status === 404) throw new LibrusError("NOT_FOUND", 404);
	if (!response.ok) throw new LibrusError("UNEXPECTED_RESPONSE", 502);
	const body = await response.json();
	return { body, url: walk.url };
}

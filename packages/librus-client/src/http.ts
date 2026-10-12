/**
 * Fetch wrapper for the Librus protocol.
 *
 * The login dance must observe every redirect itself (the audit says the OAuth
 * state-parameter URLs are dynamic), so nothing here follows redirects
 * automatically — each hop merges Set-Cookie into the jar and re-attaches the
 * jar-derived Cookie header. `fetch` is injectable so tests can mock at the
 * HTTP boundary.
 */
import type { CookieJar } from "./cookie-jar";

type FetchLike = typeof fetch;

export interface HttpDeps {
	fetch: FetchLike;
	now: () => number;
	randomPart: () => string;
}

export const defaultDeps: HttpDeps = {
	// The arrow keeps the global receiver: workerd's native fetch throws
	// "Illegal invocation" when invoked detached (`deps.fetch(...)`), while
	// Node's undici fetch hides the difference — which is why only production
	// (and the workerd test pool) ever saw the failure.
	fetch: (...args) => fetch(...args),
	now: () => Date.now(),
	randomPart: () => randomBanerPart(),
};

import { randomBanerPart } from "./baner";

const MAX_REDIRECTS = 10;

export interface WalkedResponse {
	response: Response;
	/** URL that produced the final response. */
	url: URL;
	/** Every URL the walk requested, in order — the OAuth state-bearing form
	 * address is an intermediate hop, not the final one. */
	visited: URL[];
}

/**
 * GET/POST with the jar, following 3xx hops manually (max 10), merging cookies
 * on every hop. Returns the first response that is not a redirect.
 */
export async function walkRedirects(
	url: string,
	init: RequestInit & { method: "GET" | "POST" },
	jar: CookieJar,
	deps: HttpDeps,
): Promise<WalkedResponse> {
	let current: string = url;
	const visited: URL[] = [];
	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		const target = new URL(current);
		visited.push(target);
		const headers = new Headers(init.headers);
		const cookie = jar.cookieHeader(target);
		if (cookie) headers.set("Cookie", cookie);
		const response = await deps.fetch(target.toString(), {
			method: init.method,
			headers,
			body: init.body,
			redirect: "manual",
		});
		const setCookies =
			typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
		jar.storeFromResponse(target, setCookies);
		const location = response.headers.get("location");
		const isRedirect = response.status >= 300 && response.status < 400 && location;
		if (!isRedirect || hop === MAX_REDIRECTS) {
			return { response, url: target, visited };
		}
		current = new URL(location, target).toString();
	}
	// Unreachable: the loop returns on the last hop.
	throw new Error("unreachable");
}

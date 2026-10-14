/**
 * The M session chain on mocks: GET wiadomosci3 (with the G cookies) follows
 * a redirect into wiadomosci.librus.pl whose MultiDomainLogon hop sets the M
 * cookies. The token in that URL is confidential — no console output may ever
 * contain it.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { CookieJar } from "./cookie-jar";
import type { HttpDeps } from "./http";
import { establishMessagesSession } from "./messages-auth";

const M_REDIRECT_URL =
	"https://wiadomosci.librus.pl/index/MultiDomainLogon?token=SECRET-TOKEN-XYZ&login=SECRETLOGIN";
const M_COOKIE = "session_m=abc123; Path=/; Domain=.wiadomosci.librus.pl";

function gJarWithSessionCookie(): CookieJar {
	const jar = CookieJar.empty();
	jar.storeFromResponse(new URL("https://synergia.librus.pl/loguj/portalRodzina"), [
		"D5SID=secretD5; Path=/",
	]);
	return jar;
}

function depsWithChain(landOnM: boolean): HttpDeps {
	return {
		fetch: vi.fn(async (input: string | URL | Request) => {
			const url =
				typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
			if (url.includes("wiadomosci3")) {
				if (!landOnM) {
					return new Response(null, {
						status: 302,
						headers: { Location: "https://synergia.librus.pl/loguj/portalRodzina" },
					});
				}
				return new Response(null, {
					status: 302,
					headers: { Location: M_REDIRECT_URL },
				});
			}
			if (url.includes("MultiDomainLogon")) {
				return new Response("<html/>", {
					status: 200,
					headers: { "Set-Cookie": M_COOKIE },
				});
			}
			return Response.json({});
		}),
		now: () => 0,
		randomPart: () => "",
	} as HttpDeps;
}

describe("establishMessagesSession", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("walks wiadomosci3 -> MultiDomainLogon and returns an M-only jar", async () => {
		const spyLog = vi.spyOn(console, "log").mockImplementation(() => {});
		const spyInfo = vi.spyOn(console, "info").mockImplementation(() => {});
		const spyWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const spyError = vi.spyOn(console, "error").mockImplementation(() => {});
		const jar = gJarWithSessionCookie();
		const mJar = await establishMessagesSession(jar, depsWithChain(true));
		const dto = mJar.toDTO();
		expect(dto.length).toBeGreaterThan(0);
		for (const cookie of dto) {
			expect(cookie.domain.replace(/^\./, "").endsWith("wiadomosci.librus.pl")).toBe(true);
			expect(cookie.domain.replace(/^\./, "").endsWith("synergia.librus.pl")).toBe(false);
		}
		// The confidential token never reaches any console output.
		for (const spy of [spyLog, spyInfo, spyWarn, spyError]) {
			for (const call of spy.mock.calls) {
				expect(String(call)).not.toContain("SECRET-TOKEN-XYZ");
				expect(String(call)).not.toContain("SECRETLOGIN");
			}
		}
	});

	it("maps a bounce back to Synergia to SESSION_EXPIRED", async () => {
		const jar = gJarWithSessionCookie();
		await expect(establishMessagesSession(jar, depsWithChain(false))).rejects.toMatchObject({
			code: "SESSION_EXPIRED",
		});
	});
});

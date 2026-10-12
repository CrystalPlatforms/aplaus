import { describe, expect, it } from "vitest";
import { CookieJar } from "./cookie-jar";

function _responseFor(_url: string, cookies: string[]): Response {
	const headers = new Headers();
	for (const cookie of cookies) {
		headers.append("set-cookie", cookie);
	}
	return new Response(null, { status: 200, headers });
}

describe("CookieJar", () => {
	it("keeps cookies per domain: synergia vs api.librus.pl", () => {
		const jar = CookieJar.empty();
		jar.storeFromResponse(new URL("https://synergia.librus.pl/x"), [
			"s=abc; Domain=synergia.librus.pl; Path=/",
		]);
		jar.storeFromResponse(new URL("https://api.librus.pl/x"), [
			"o=def; Domain=api.librus.pl; Path=/",
		]);
		const toSynergia = jar.cookieHeader(
			new URL("https://synergia.librus.pl/gateway/api/2.0/Grades"),
		);
		expect(toSynergia).toContain("s=abc");
		expect(toSynergia).not.toContain("o=def");
		const toApi = jar.cookieHeader(new URL("https://api.librus.pl/OAuth/Authorization"));
		expect(toApi).toContain("o=def");
		expect(toApi).not.toContain("s=abc");
	});

	it("keeps cookies per path: a /sub cookie does not travel to /", () => {
		const jar = CookieJar.empty();
		jar.storeFromResponse(new URL("https://synergia.librus.pl/sub/x"), [
			"deep=1; Domain=synergia.librus.pl; Path=/sub",
		]);
		const toRoot = jar.cookieHeader(new URL("https://synergia.librus.pl/gateway/api/2.0/Grades"));
		expect(toRoot).toBeNull();
		const toSub = jar.cookieHeader(new URL("https://synergia.librus.pl/sub/y"));
		expect(toSub).toBe("deep=1");
	});

	it("a dot-domain cookie (.librus.pl) travels to both hosts", () => {
		const jar = CookieJar.empty();
		jar.storeFromResponse(new URL("https://synergia.librus.pl/x"), [
			"wide=1; Domain=.librus.pl; Path=/",
		]);
		expect(jar.cookieHeader(new URL("https://synergia.librus.pl/y"))).toContain("wide=1");
		expect(jar.cookieHeader(new URL("https://api.librus.pl/y"))).toContain("wide=1");
	});

	it("round-trips through the DTO (KV persistence)", () => {
		const jar = CookieJar.empty();
		jar.storeFromResponse(new URL("https://synergia.librus.pl/x"), [
			"s=abc; Domain=synergia.librus.pl; Path=/",
		]);
		const restored = CookieJar.fromDTO(JSON.parse(JSON.stringify(jar.toDTO())));
		expect(restored.cookieHeader(new URL("https://synergia.librus.pl/y"))).toBe("s=abc");
	});
});

/**
 * The login dance against mocked HTTP — the only boundary this package mocks.
 * The scripted chain follows the audit: portal 302 -> OAuth form -> POST creds
 * -> goTo chain -> Synergia, then /Me.
 */
import { describe, expect, it, vi } from "vitest";
import type { HttpDeps } from "./http";
import { loginToLibrus } from "./login";

const NOW_MS = 1760000000000;
const RANDOM = "123456789012345";

interface Call {
	method: string;
	url: string;
	baner?: string;
	body?: string;
}

function depsFor(responses: Array<Response | Response[]>, calls: Call[]): HttpDeps {
	const queue = [...responses];
	return {
		fetch: vi.fn((input: string | URL | Request, init?: RequestInit) =>
			recordAndRespond(input, init, calls, queue),
		),
		now: () => NOW_MS,
		randomPart: () => RANDOM,
	} as HttpDeps;
}

function recordAndRespond(
	input: string | URL | Request,
	init: RequestInit | undefined,
	calls: Call[],
	queue: Array<Response | Response[]>,
): Promise<Response> {
	const url =
		typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
	const call: Call = { method: init?.method ?? "GET", url };
	calls.push(call);
	const baner = new Headers(init?.headers).get("x-baner");
	if (baner) call.baner = baner;
	if (typeof init?.body === "string") call.body = init.body;
	const next = queue.shift();
	return Promise.resolve(Array.isArray(next) ? (next.shift() as Response) : (next as Response));
}

/** Builds a Response with Set-Cookie headers attached. */
function responseWith(status: number, headers: Record<string, string>, body?: string): Response {
	const h = new Headers(headers);
	if (headers["set-cookie"]) {
		for (const cookie of headers["set-cookie"].split("\n")) {
			h.append("set-cookie", cookie);
		}
	}
	return new Response(body ?? null, { status, headers: h });
}

const portal302 = () =>
	responseWith(302, {
		location: "https://api.librus.pl/OAuth/Authorization?client_id=Demo&state=abc",
		"set-cookie": "portalSid=abc; Domain=.librus.pl; Path=/",
	});
const formPage = () => responseWith(200, {}, "<html>login form</html>");
const loginOk = () =>
	responseWith(
		200,
		{ "content-type": "application/json" },
		JSON.stringify({
			status: "ok",
			goTo: "https://api.librus.pl/OAuth/Authorization?code=42",
		}),
	);
const goTo302 = () =>
	responseWith(302, {
		location: "https://synergia.librus.pl/loguj?ticket=t1",
		"set-cookie": "synergiaSid=xyz; Domain=synergia.librus.pl; Path=/",
	});
const synergia200 = () =>
	responseWith(200, {
		"set-cookie": "synergiaSid2=zzz; Domain=synergia.librus.pl; Path=/",
	});
const me200 = () =>
	responseWith(
		200,
		{ "content-type": "application/json" },
		JSON.stringify({
			Me: {
				Account: { Id: 7, FirstName: "Adam", LastName: "Testowy", GroupId: 8, Login: "adam7" },
				User: { FirstName: "Adam", LastName: "Testowy" },
			},
		}),
	);

/** Encodes a string the way the x-baner header does (each char +20). */
function banerEncode(value: string): string {
	let out = "";
	for (const ch of value) out += String.fromCodePoint((ch.codePointAt(0) ?? 0) + 20);
	return out;
}

describe("loginToLibrus", () => {
	it("walks portal -> OAuth form -> creds -> goTo -> Synergia, then /Me", async () => {
		const calls: Call[] = [];
		const deps = depsFor(
			[portal302(), formPage(), loginOk(), goTo302(), synergia200(), me200()],
			calls,
		);
		const outcome = await loginToLibrus("adam", "pass", deps);
		expect(outcome.account).toEqual({
			id: 7,
			firstName: "Adam",
			lastName: "Testowy",
			login: "adam7",
			groupId: 8,
		});
		expect(calls.map((c) => new URL(c.url).pathname)).toEqual([
			"/loguj/portalRodzina",
			"/OAuth/Authorization",
			"/OAuth/Authorization",
			"/OAuth/Authorization",
			"/loguj",
			"/gateway/api/2.0/Me",
		]);
	});

	it("sends x-baner as <random+20>_<unix-ms+20> on the credentials POST", async () => {
		const calls: Call[] = [];
		const deps = depsFor(
			[portal302(), formPage(), loginOk(), goTo302(), synergia200(), me200()],
			calls,
		);
		await loginToLibrus("adam", "pass", deps);
		const post = calls.find((c) => c.method === "POST");
		expect(post).toBeDefined();
		expect(post?.baner).toBe(`${banerEncode(RANDOM)}_${banerEncode(String(NOW_MS))}`);
		expect(post?.body).toContain("action=login");
	});

	it("maps 403 with errors[] to WRONG_CREDENTIALS with a Polish message", async () => {
		const calls: Call[] = [];
		const deps = depsFor(
			[
				portal302(),
				formPage(),
				responseWith(
					403,
					{ "content-type": "application/json" },
					JSON.stringify({
						status: "error",
						errors: [{ code: 1, message: "Bad credentials" }],
					}),
				),
			],
			calls,
		);
		const promise = loginToLibrus("adam", "wrong", deps);
		await expect(promise).rejects.toMatchObject({
			code: "WRONG_CREDENTIALS",
			userMessage: "Nieprawidłowy login lub hasło.",
		});
		expect(calls).toHaveLength(3);
	});

	it.each([
		["relative path", "/loguj?ticket=t1", "https://api.librus.pl/loguj?ticket=t1"],
		[
			"scheme-less host",
			"synergia.librus.pl/loguj?ticket=t1",
			"https://synergia.librus.pl/loguj?ticket=t1",
		],
		[
			"full url",
			"https://synergia.librus.pl/loguj?ticket=t1",
			"https://synergia.librus.pl/loguj?ticket=t1",
		],
	])("follows a %s goTo without crashing on URL parsing", async (_shape, goTo, _expected) => {
		const calls: Call[] = [];
		const deps = depsFor(
			[
				portal302(),
				formPage(),
				responseWith(
					200,
					{ "content-type": "application/json" },
					JSON.stringify({ status: "ok", goTo }),
				),
				goTo302(),
				synergia200(),
				me200(),
			],
			calls,
		);
		const outcome = await loginToLibrus("adam", "pass", deps);
		expect(outcome.account.firstName).toBe("Adam");
		const walked = calls.map((c) => new URL(c.url).pathname);
		expect(walked).toContain("/loguj");
		expect(walked).toContain("/gateway/api/2.0/Me");
	});
});

function _recordAndRespond(
	input: string | URL | Request,
	init: RequestInit | undefined,
	calls: Call[],
	queue: Array<Response | Response[]>,
): Promise<Response> {
	const url =
		typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
	const call: Call = { method: init?.method ?? "GET", url };
	calls.push(call);
	const baner = new Headers(init?.headers).get("x-baner");
	if (baner) call.baner = baner;
	if (typeof init?.body === "string") call.body = init.body;
	const next = queue.shift();
	return Promise.resolve(Array.isArray(next) ? (next.shift() as Response) : (next as Response));
}

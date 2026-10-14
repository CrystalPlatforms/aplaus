/**
 * Tester diagnostyczny: każdy kandydat daje status + fragment odpowiedzi,
 * nigdy nie rzuca (błędy sesji/sieci lądują jako status 0 i komunikat).
 */
import { describe, expect, it, vi } from "vitest";
import { CookieJar } from "./cookie-jar";
import type { HttpDeps } from "./http";
import { probeMessagesEndpoints } from "./probe";

function depsServingM(routes: Record<string, { status?: number; body?: unknown }>): HttpDeps {
	return {
		fetch: vi.fn(async (input: string | URL | Request) => {
			const url =
				typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
			for (const [path, route] of Object.entries(routes)) {
				if (url.includes(path)) {
					return Response.json(route.body ?? {}, { status: route.status ?? 200 });
				}
			}
			return Response.json({}, { status: 404 });
		}),
		now: () => 0,
		randomPart: () => "",
	};
}

describe("probeMessagesEndpoints", () => {
	it("zwraca status i fragment dla każdego kandydata, nigdy nie rzuca", async () => {
		const deps = depsServingM({ "receivers/types": { body: { data: { list: [] } } } });
		const results = await probeMessagesEndpoints(CookieJar.empty(), "schoolReceivers", deps);
		expect(results).toHaveLength(13);
		const sanity = results[0];
		expect(sanity?.path).toBe("me");
		expect(sanity?.status).toBe(404);
		const types = results[1];
		expect(types?.status).toBe(200);
		const tagList = results[11];
		expect(tagList?.method).toBe("GET");
		expect(tagList?.path).toBe("tags");
		const groupsList = results[12];
		expect(groupsList?.path).toBe("receivers/custom-groups");
	});

	it("gdy lista grup ma groupId, sprawdza odczyt członków grupy", async () => {
		const deps = depsServingM({
			"receivers/custom-groups": {
				body: { groups: [{ groupId: 21108, name: "siema" }] },
			},
		});
		const results = await probeMessagesEndpoints(CookieJar.empty(), "teachers", deps);
		expect(results).toHaveLength(15);
		// Dynamiczne próby członków wchodzą zaraz po liście grup.
		const members = results[13];
		expect(members?.path).toBe("receivers/custom-groups/21108");
		const membersMgmt = results[14];
		expect(membersMgmt?.path).toBe("receivers/custom-groups/21108/receivers-management");
	});
});

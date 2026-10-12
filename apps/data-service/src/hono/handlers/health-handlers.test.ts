/**
 * Readiness integration: with the real KV binding (workerd simulation from
 * wrangler.jsonc) the probe answers 200; without a usable binding, 503.
 */
import { env } from "cloudflare:workers";
import { App } from "../app";

const readiness = (ip: string, withKv = true) =>
	App.request(
		"/health/ready",
		{ headers: { "cf-connecting-ip": ip } },
		withKv ? env : ({ ...env, KV: undefined } as unknown as typeof env),
	);

describe("readiness probe", () => {
	it("answers 200 when the KV binding is present", async () => {
		const res = await readiness("198.51.100.10");
		expect(res.status).toBe(200);
		const body = (await res.json()) as { kv: string; service: string };
		expect(body.kv).toBe("available");
		expect(body.service).toBe("aplaus-ds");
	});

	it("answers 503 when KV is unreachable", async () => {
		const res = await readiness("198.51.100.11", false);
		expect(res.status).toBe(503);
		const body = (await res.json()) as { kv: string };
		expect(body.kv).toBe("unavailable");
	});
});

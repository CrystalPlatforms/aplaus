/**
 * Skaner kodu klienta: znajduje ścieżkę wejściową SPA, pobiera paczki JS
 * i wyciąga wzorce kontraktów (endpointy receiver + colorRgb).
 */
import { describe, expect, it, vi } from "vitest";
import { scanMessagesClient } from "./client-scan";
import { CookieJar } from "./cookie-jar";
import type { HttpDeps } from "./http";

describe("scanMessagesClient", () => {
	it("skanuje HTML wejścia i paczki JS, wyciąga endpointy i colorRgb", async () => {
		const deps: HttpDeps = {
			fetch: vi.fn(async (input: string | URL | Request) => {
				const url = String(input);
				if (url.endsWith("/!messages_v2")) {
					return new Response(
						'<html><body><script src="/static/app.123.js"></script></body></html>',
						{ status: 200 },
					);
				}
				if (url.includes("/static/app.123.js")) {
					const bundle = [
						'fetch("/api/receivers/types/"+e)',
						"x=`/api/receivers/` + t + `/list`",
						'POST "/api/tags" colorRgb:"#4285f4"',
						"var colorRgb=this.props.colorRgb||'#ff0000'",
					].join("\n");
					return new Response(bundle, { status: 200 });
				}
				return new Response(null, { status: 404 });
			}),
			now: () => 0,
			randomPart: () => "",
		};
		const result = await scanMessagesClient(CookieJar.empty(), CookieJar.empty(), deps);
		expect(result.entryPath).toBe("/!messages_v2");
		expect(result.scripts).toHaveLength(1);
		const labels = result.matches.map((m) => m.label);
		expect(labels).toContain("endpoint-odbiorcy");
		expect(labels).toContain("colorRgb");
	});
});

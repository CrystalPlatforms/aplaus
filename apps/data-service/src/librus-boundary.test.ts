/**
 * workerd's native fetch requires the global receiver: calling it detached
 * (`deps.fetch(...)`) throws "Illegal invocation". The Node suite of
 * librus-client cannot see this (undici fetch is receiver-agnostic), so the
 * guard is asserted here, in the real runtime the Worker ships in.
 */
import { defaultDeps } from "@repo/librus-client";
import { describe, expect, it } from "vitest";

describe("defaultDeps under workerd", () => {
	it("fetch survives being called as a method on a plain object", async () => {
		const error = await defaultDeps
			.fetch("http://127.0.0.1:1/unreachable") // nothing listens there: a network error is expected
			.then(
				() => null,
				(e: unknown) => e,
			);
		expect(error).toBeInstanceOf(Error);
		// The failure must be a network error, NOT an "Illegal invocation" TypeError.
		expect((error as Error).message.toLowerCase()).not.toContain("illegal invocation");
	});
});

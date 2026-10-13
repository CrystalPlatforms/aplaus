/**
 * Session expiry end to end through the real App tree: a proxy 401 whose
 * silent renewal also fails clears the session and the auth gate falls back
 * to the login screen — without any apiFetch mock (only fetch is mocked).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => void storage.set(key, value),
	removeItem: (key: string) => void storage.delete(key),
	clear: () => void storage.clear(),
});

import App from "./App";
import { getToken, setToken } from "./lib/api";
import { setActiveAccountId, setCredentials } from "./lib/credentials";

const SESSION_EXPIRED = () =>
	new Response(JSON.stringify({ error: "Sesja wygasła.", code: "SESSION_EXPIRED" }), {
		status: 401,
	});

describe("session expiry through the App gate", () => {
	beforeEach(() => {
		storage.clear();
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("shows the login screen when the second attempt (renewal) also fails", async () => {
		setToken("device-token-1");
		setCredentials("librus:7", { login: "adam", password: "secret" });
		setActiveAccountId("librus:7");

		const fetchMock = vi
			.fn()
			// /api/me answers 401 SESSION_EXPIRED...
			.mockResolvedValueOnce(SESSION_EXPIRED())
			// ...the renewal fails (stored password no longer valid)...
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ error: "Złe hasło", code: "WRONG_CREDENTIALS" }), {
					status: 401,
				}),
			);
		vi.spyOn(window, "fetch").mockImplementation(fetchMock);

		render(
			<QueryClientProvider
				client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
			>
				<App />
			</QueryClientProvider>,
		);

		// ...and the auth gate falls back to the login screen. The splash also
		// reads "Aplaus", so the login button is the reliable final-state probe.
		await waitFor(() => expect(screen.getByText("Zaloguj się")).toBeTruthy(), { timeout: 4000 });
		// The device token survives: the next login re-attaches to the same
		// device, so the account list (and every account on it) is not lost.
		expect(getToken()).toBe("device-token-1");
	});

	it("keeps the device token when /api/me fails with a network error", async () => {
		setToken("device-token-1");
		setCredentials("librus:7", { login: "adam", password: "secret" });
		setActiveAccountId("librus:7");

		vi.spyOn(window, "fetch").mockRejectedValue(new TypeError("network down"));

		render(
			<QueryClientProvider
				client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
			>
				<App />
			</QueryClientProvider>,
		);

		await waitFor(() => expect(screen.getByText("Zaloguj się")).toBeTruthy(), { timeout: 4000 });
		expect(getToken()).toBe("device-token-1");
	});
});

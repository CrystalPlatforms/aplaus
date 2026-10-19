/**
 * The auth gate is reactive: logging in shows the shell and logging out shows
 * the login screen WITHOUT a manual page refresh. Both flows are asserted end
 * to end through the real App tree, with the API boundary mocked.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/api")>();
	return { ...actual, apiFetch: apiFetchMock };
});

import App from "./App";

/**
 * Node 26's experimental global localStorage is unavailable without a CLI flag
 * and jsdom's copy is shadowed by it, so the tests run against a plain
 * in-memory stub with the same surface.
 */
const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => void storage.set(key, value),
	removeItem: (key: string) => void storage.delete(key),
	clear: () => void storage.clear(),
});

const ACCOUNT = {
	id: "librus:7",
	firstName: "Adam",
	lastName: "Testowy",
	role: "Uczeń",
	groupId: 8,
};
const GRADES = { grades: [], categories: [], comments: [] };

/** Routes the mock by path, like the real API would. */
function routeApi() {
	apiFetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
		if (path === "/api/login") {
			return { deviceToken: "tok-1", account: ACCOUNT };
		}
		if (path === "/api/me") {
			return ACCOUNT;
		}
		if (path === "/api/grades") {
			return GRADES;
		}
		throw new Error(`unexpected api call: ${path} ${init?.method ?? "GET"}`);
	});
}

function renderApp() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={client}>
			<App />
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	storage.clear();
	apiFetchMock.mockReset();
	routeApi();
});

describe("auth gate reactivity", () => {
	it("shows the shell right after login, without a manual refresh", async () => {
		renderApp();
		await waitFor(() => screen.getByPlaceholderText("Login Librusa"));
		fireEvent.change(screen.getByPlaceholderText("Login Librusa"), { target: { value: "adam" } });
		fireEvent.change(screen.getByPlaceholderText("Hasło"), { target: { value: "secret" } });
		fireEvent.click(screen.getByRole("button", { name: "Zaloguj się" }));
		// The deliberate 1 s loader stay delays the switch past the default timeout.
		// Both banner variants (mobile top bar + desktop sidebar) live in the
		// DOM; the CSS media queries decide which is visible.
		await waitFor(() => expect(screen.getAllByText(/Adam/).length).toBeGreaterThan(0), {
			timeout: 3000,
		});
	});

	it("shows the login screen right after logout, without a manual refresh", async () => {
		storage.set("aplaus.deviceToken", "tok-1");
		renderApp();
		await waitFor(() => expect(screen.getAllByText(/Adam/).length).toBeGreaterThan(0));
		// Two Wyloguj buttons exist (mobile top bar + desktop sidebar); both
		// trigger the same logout.
		const wyloguj = screen.getAllByRole("button", { name: "Wyloguj" }).at(0);
		expect(wyloguj).toBeTruthy();
		fireEvent.click(wyloguj as HTMLElement);
		await waitFor(() => expect(screen.getByPlaceholderText("Login Librusa")).toBeTruthy());
	});
});

/**
 * The shell banner + account switcher: switching accounts re-renders the
 * login banner with the other account's name and role.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/api")>();
	return { ...actual, apiFetch: apiFetchMock };
});

/**
 * Node's experimental global localStorage is unavailable without a CLI flag
 * and shadows jsdom's copy — the tests run against an in-memory stub.
 */
const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => void storage.set(key, value),
	removeItem: (key: string) => void storage.delete(key),
	clear: () => void storage.clear(),
});

import { setToken } from "@/lib/api";
import { AuthProvider } from "@/lib/auth";
import { AppShell } from "./AppShell";

const ACCOUNT_A = {
	id: "librus:7",
	firstName: "Adam",
	lastName: "Testowy",
	role: "Uczeń",
	groupId: 8,
};
const ACCOUNT_B = {
	id: "librus:9",
	firstName: "Filip",
	lastName: "Drugi",
	role: "Rodzic",
	groupId: 5,
};

function renderShell() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={client}>
			<AuthProvider>
				<AppShell />
			</AuthProvider>
		</QueryClientProvider>,
	);
}

describe("AppShell account switching", () => {
	beforeEach(() => {
		storage.clear();
		setToken("device-token-1");
		apiFetchMock.mockReset();
		let active = ACCOUNT_A;
		apiFetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
			if (path === "/api/me") return active;
			if (path === "/api/accounts")
				return { accounts: [ACCOUNT_A, ACCOUNT_B], activeAccountId: active.id };
			if (path === "/api/accounts/switch") {
				expect(String(init?.body)).toContain(ACCOUNT_B.id);
				active = ACCOUNT_B;
				return ACCOUNT_B;
			}
			if (path === "/api/grades") return { grades: [], categories: [], comments: [] };
			throw new Error(`unexpected api call: ${path}`);
		});
	});

	it("banner shows the logged-in account; switching re-renders the other one", async () => {
		renderShell();
		// The banner renders twice (mobile top bar + desktop sidebar variant);
		// both update when the account switches.
		await waitFor(() =>
			expect(screen.getAllByTestId("login-banner")[0]?.textContent).toContain("Adam"),
		);

		const przelacz = screen.getAllByRole("button", { name: /Przełącz konto/ }).at(0);
		expect(przelacz).toBeTruthy();
		fireEvent.click(przelacz as HTMLElement);
		await waitFor(() => expect(screen.getByRole("dialog", { name: "Konta" })).toBeTruthy());

		fireEvent.click(screen.getByText("Filip Drugi"));
		await waitFor(() =>
			expect(screen.getAllByTestId("login-banner")[0]?.textContent).toContain("Filip"),
		);
		// The banner carries the switched account's role too.
		expect(screen.getAllByTestId("login-banner")[0]?.textContent).toContain("Rodzic");
	});
});

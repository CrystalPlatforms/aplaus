/**
 * The justifications role gate: a student account (groupId 8) renders nothing
 * and sends ZERO requests — the query is enabled only for parents (groupId 5).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/api")>();
	return { ...actual, apiFetch: apiFetchMock };
});

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth")>();
	return { ...actual, useAuth: authMock };
});

import { JustificationsScreen } from "./JustificationsScreen";

function renderJustifications() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={client}>
			<JustificationsScreen />
		</QueryClientProvider>,
	);
}

describe("JustificationsScreen role gate", () => {
	beforeEach(() => {
		apiFetchMock.mockReset();
		apiFetchMock.mockResolvedValue([]);
	});

	it("student account (8): renders nothing and sends zero requests", async () => {
		authMock.mockReturnValue({
			account: { id: "librus:7", firstName: "Adam", lastName: "T", role: "Uczeń", groupId: 8 },
		});
		renderJustifications();
		// Let any (disallowed) query tick settle before asserting the register.
		await waitFor(() => expect(true).toBe(true));
		expect(apiFetchMock).not.toHaveBeenCalled();
		expect(screen.queryByText("Brak usprawiedliwień.")).toBeNull();
	});

	it("parent account (5): renders justifications from fixtures", async () => {
		authMock.mockReturnValue({
			account: { id: "librus:9", firstName: "Filip", lastName: "R", role: "Rodzic", groupId: 5 },
		});
		apiFetchMock.mockResolvedValue([
			{
				id: 41,
				messageFromParent: "Prosze o usprawiedliwienie",
				postDate: "2026-10-10 08:00:00",
				justificationStatus: "accepted",
				lessons: [{ number: 1, date: "2026-10-09" }],
				hasAttachment: true,
				dateFrom: "2026-10-09",
				dateTo: "2026-10-09",
				justifiedAbsences: 2,
				notifiedTeachers: ["Anna Kowalska"],
			},
		]);
		renderJustifications();
		await waitFor(() => expect(screen.getByText("Prosze o usprawiedliwienie")).toBeTruthy());
		expect(screen.getByText(/lekcja 1 \(2026-10-09\)/)).toBeTruthy();
		expect(screen.getByText(/Anna Kowalska/)).toBeTruthy();
	});
});

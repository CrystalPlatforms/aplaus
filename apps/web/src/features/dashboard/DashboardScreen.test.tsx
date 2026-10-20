/**
 * The kokpit renders its four cards from fixtures; a failing query only
 * breaks its own card, not the screen.
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

import { DashboardScreen } from "./DashboardScreen";

const ACCOUNT = { id: "librus:7", firstName: "Adam", groupId: 8, lastName: "T", role: "Uczeń" };

function renderDashboard() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={client}>
			<DashboardScreen />
		</QueryClientProvider>,
	);
}

describe("DashboardScreen", () => {
	beforeEach(() => {
		apiFetchMock.mockReset();
		authMock.mockReturnValue({ account: ACCOUNT });
		apiFetchMock.mockImplementation(async (path: string) => {
			if (path === "/api/grades")
				return {
					grades: [
						{ id: 1, grade: "5", subjectName: "Matematyka", dateAdded: "2026-10-12 08:00:00" },
					],
					categories: [],
					comments: [],
					subjects: [],
				};
			if (path.startsWith("/api/timetable"))
				return {
					days: [
						{
							date: "2026-10-13",
							slots: [[{ subjectName: "Matematyka", hourFrom: "08:00", hourTo: "08:45" }]],
						},
					],
					nextWeekStart: null,
					prevWeekStart: null,
				};
			if (path === "/api/homework")
				return {
					homeWorks: [],
					assignments: [{ id: 9, topic: "Wypracowanie", dueDate: "2026-10-19" }],
				};
			if (path === "/api/school/notices")
				return [
					{
						id: "55",
						subject: "Wywiadówka",
						content: "Zaproszenie",
						startDate: "2020-01-01",
						endDate: "2099-12-31",
					},
				];
			throw new Error(`unexpected api call: ${path}`);
		});
	});

	it("greets the account and renders all four cards from fixtures", async () => {
		renderDashboard();
		await waitFor(() => expect(screen.getByText("Cześć, Adam")).toBeTruthy());
		await waitFor(() => expect(screen.getAllByText("Matematyka").length).toBeGreaterThan(0));
		expect(screen.getByText("Najnowsze oceny")).toBeTruthy();
		expect(screen.getByText("Dzisiejszy plan")).toBeTruthy();
		expect(screen.getByText("Zadania na najbliższy czas")).toBeTruthy();
		expect(screen.getByText("Ogłoszenia")).toBeTruthy();
		expect(screen.getByText("Wypracowanie")).toBeTruthy();
		expect(screen.getByText("Wywiadówka")).toBeTruthy();
	});

	it("keeps the screen alive when one query fails — only that card errors", async () => {
		apiFetchMock.mockImplementation(async (path: string) => {
			if (path === "/api/grades") throw new Error("boom");
			if (path.startsWith("/api/timetable"))
				return { days: [], nextWeekStart: null, prevWeekStart: null };
			if (path === "/api/homework") return { homeWorks: [], assignments: [] };
			if (path === "/api/school/notices") return [];
			throw new Error(`unexpected api call: ${path}`);
		});
		renderDashboard();
		await waitFor(() => expect(screen.getByText("Nie udało się pobrać ocen.")).toBeTruthy());
		expect(screen.getByText("Zadania na najbliższy czas")).toBeTruthy();
		expect(screen.getByText("Ogłoszenia")).toBeTruthy();
	});

	it("lays the four cards on the shared Card in a two-column grid from md", async () => {
		const { container } = renderDashboard();
		await waitFor(() => expect(screen.getByText("Najnowsze oceny")).toBeTruthy());
		// One DOM ships both layouts: single column below md, two from md up.
		const grid = container.querySelector(".md\\:grid-cols-2");
		expect(grid).toBeTruthy();
		expect(container.querySelectorAll('[data-slot="card"]').length).toBe(4);
	});
});

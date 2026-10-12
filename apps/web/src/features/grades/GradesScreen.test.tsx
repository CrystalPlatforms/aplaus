/**
 * GradesScreen renders list, detail and statistics from fixture data. The API
 * boundary (apiFetch) is mocked — the only boundary a component test mocks.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/api")>();
	return { ...actual, apiFetch: apiFetchMock };
});

import { GradesScreen } from "./GradesScreen";

const FIXTURE = {
	grades: [
		{
			id: 101,
			grade: "5",
			dateOccurred: "2026-10-01",
			dateAdded: "2026-10-01 08:00:00",
			semester: 1,
			subjectId: 12,
			subjectName: "Matematyka",
			categoryId: 5,
			addedById: 55,
			addedByName: "Anna Kowalska",
			studentId: 900,
			lessonId: 77,
			isConstituent: true,
			isSemester: false,
			isFinal: false,
			isSemesterProposition: false,
			isFinalProposition: false,
			commentIds: [],
		},
		{
			id: 102,
			grade: "3-",
			dateOccurred: "2026-10-02",
			dateAdded: "2026-10-02 09:00:00",
			semester: 1,
			subjectId: 12,
			subjectName: "Matematyka",
			categoryId: 5,
			addedById: 55,
			addedByName: "Anna Kowalska",
			studentId: 900,
			lessonId: 77,
			isConstituent: true,
			isSemester: false,
			isFinal: false,
			isSemesterProposition: false,
			isFinalProposition: false,
			commentIds: [],
		},
	],
	categories: [
		{
			id: 5,
			name: "Sprawdzian",
			short: "S",
			standard: true,
			colorId: 1,
			isSemestral: false,
			isFinal: false,
			isSemestralProposition: false,
			isFinalProposition: false,
			blockAnyGrades: false,
		},
	],
	comments: [{ id: 8, gradeId: 101, addedById: 55, text: "Bardzo dobra praca" }],
};

function renderGrades() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={client}>
			<GradesScreen />
		</QueryClientProvider>,
	);
}

describe("GradesScreen", () => {
	beforeEach(() => {
		apiFetchMock.mockReset();
		apiFetchMock.mockResolvedValue(FIXTURE);
	});

	it("renders the subject list, statistics and average from fixtures", async () => {
		renderGrades();
		await waitFor(() => expect(screen.getByText("Matematyka")).toBeTruthy());
		expect(screen.getAllByText("Sprawdzian").length).toBeGreaterThan(0);
		expect(screen.getByText("Średnia ogólna")).toBeTruthy();
		expect(screen.getAllByText("3.88").length).toBe(2);
	});

	it("opens the detail sheet with category, teacher, comment and flags", async () => {
		renderGrades();
		await waitFor(() => expect(screen.getByText("Matematyka")).toBeTruthy());
		const chip = screen.getByText("5", { selector: "span" });
		chip.click();
		await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
		expect(screen.getByText("Kategoria")).toBeTruthy();
		expect(screen.getAllByText("Sprawdzian").length).toBeGreaterThan(0);
		expect(screen.getByText("Anna Kowalska")).toBeTruthy();
		expect(screen.getByText("Bardzo dobra praca")).toBeTruthy();
		expect(screen.getAllByText("Liczy się do średniej").length).toBeGreaterThan(0);
	});
});

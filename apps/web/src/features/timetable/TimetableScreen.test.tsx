/**
 * TimetableScreen renders the week grid from fixtures. The API boundary
 * (apiFetch) is mocked — the only boundary a component test mocks.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/api")>();
	return { ...actual, apiFetch: apiFetchMock };
});

import { RouterProvider } from "@/lib/router";
import { TimetableScreen } from "./TimetableScreen";

const TIMETABLE_FIXTURE = {
	days: [
		{
			date: "2026-10-12",
			slots: [
				[
					{
						id: "7701",
						lessonId: "7701",
						classroomId: "21",
						classroomSymbol: "21",
						dateFrom: "2026-10-12 08:00:00",
						dateTo: "2026-10-12 08:45:00",
						lessonNo: "1",
						dayNo: "1",
						subjectId: "12",
						subjectName: "Matematyka",
						teacherId: "55",
						teacherName: "Anna Kowalska",
						classId: 3,
						isCanceled: false,
						isSubstitutionClass: false,
						substitutionNote: null,
						hourFrom: "08:00",
						hourTo: "08:45",
					},
				],
			],
		},
		{
			date: "2026-10-13",
			slots: [
				[
					{
						id: "7702",
						lessonId: "7702",
						classroomId: null,
						classroomSymbol: null,
						dateFrom: "2026-10-13 08:00:00",
						dateTo: "2026-10-13 08:45:00",
						lessonNo: "1",
						dayNo: "2",
						subjectId: "13",
						subjectName: "Historia",
						teacherId: "56",
						teacherName: "Piotr Nowak",
						classId: 3,
						isCanceled: true,
						isSubstitutionClass: false,
						substitutionNote: null,
						hourFrom: "08:00",
						hourTo: "08:45",
					},
				],
				[
					{
						id: "7703",
						lessonId: "7703",
						classroomId: null,
						classroomSymbol: null,
						dateFrom: "2026-10-13 10:00:00",
						dateTo: "2026-10-13 10:45:00",
						lessonNo: "3",
						dayNo: "2",
						subjectId: "14",
						subjectName: "Biologia",
						teacherId: "57",
						teacherName: "Ewa Zielińska",
						classId: 3,
						isCanceled: false,
						isSubstitutionClass: true,
						substitutionNote: null,
						hourFrom: "10:00",
						hourTo: "10:45",
						orgSubjectName: "Biologia",
						orgTeacherName: "Jan Wiśniewski",
						orgTeacherId: "58",
						orgLessonNo: "3",
						orgHourFrom: "10:00",
						orgHourTo: "10:45",
						orgClassroomSymbol: null,
					},
				],
			],
		},
	],
	nextWeekStart: "2026-10-19",
	prevWeekStart: "2026-10-05",
};

const FREE_DAYS_FIXTURE = {
	calendars: [],
	freeDays: [
		{ id: "1", date: "2026-11-01", name: "Wszystkich Świętych" },
		{ id: "2", date: "2026-12-25", name: "Boże Narodzenie" },
	],
};

function renderTimetable() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={client}>
			<RouterProvider>
				<TimetableScreen />
			</RouterProvider>
		</QueryClientProvider>,
	);
}

describe("TimetableScreen", () => {
	beforeEach(() => {
		// The screen renders the current week; pin the clock to the middle of
		// the fixture week (2026-10-12…18) so the test is calendar-independent.
		vi.setSystemTime(new Date("2026-10-14T10:00:00"));
		apiFetchMock.mockReset();
		apiFetchMock.mockImplementation(async (path: string) => {
			if (path.startsWith("/api/timetable")) return TIMETABLE_FIXTURE;
			if (path.startsWith("/api/calendar/free-days")) return FREE_DAYS_FIXTURE;
			throw new Error(`unexpected path ${path}`);
		});
	});

	it("renders the day cards with subjects from fixtures", async () => {
		const { container } = renderTimetable();
		await waitFor(() => expect(screen.getByText("Matematyka")).toBeTruthy());
		expect(screen.getByText("Historia")).toBeTruthy();
		expect(container.textContent).toContain("Anna Kowalska");
	});

	it("distinguishes canceled lessons and substitutions visually, not only by color", async () => {
		renderTimetable();
		await waitFor(() => expect(screen.getByText("Historia")).toBeTruthy());

		// Both flags carry data attributes AND textual labels.
		const canceled = screen.getByText("Historia").closest("[data-flag]");
		expect(canceled?.getAttribute("data-flag")).toBe("canceled");
		expect(canceled?.textContent).toContain("Odwołana");

		const substitution = screen.getByText("Biologia").closest("[data-flag]");
		expect(substitution?.getAttribute("data-flag")).toBe("substitution");
		expect(substitution?.textContent).toContain("Zastępstwo");
		// Substitution shows the original teacher struck through, then the new one.
		const struck = substitution?.querySelector(".line-through");
		expect(struck?.textContent).toBe("Jan Wiśniewski");
		expect(substitution?.textContent).toContain("Ewa Zielińska");

		// The two states are distinguishable from each other.
		expect(canceled?.getAttribute("data-flag")).not.toBe(substitution?.getAttribute("data-flag"));
	});

	it("renders class free days from fixtures", async () => {
		renderTimetable();
		await waitFor(() => expect(screen.getByTestId("free-days-card")).toBeTruthy());
		expect(screen.getByText("Wszystkich Świętych")).toBeTruthy();
		expect(screen.getByText("Boże Narodzenie")).toBeTruthy();
	});

	it("opens the lesson detail overlay on tap", async () => {
		renderTimetable();
		await waitFor(() => expect(screen.getByText("Matematyka")).toBeTruthy());
		fireEvent.click(screen.getByText("Matematyka"));
		// The dialog's accessible name comes from the visible title (Radix
		// aria-labelledby), not an aria-label.
		const dialog = await waitFor(() => screen.getByRole("dialog", { name: "Matematyka" }));
		expect(dialog).toBeTruthy();
		expect(screen.getByText("Nauczyciel")).toBeTruthy();
		expect(screen.getByText("Sala")).toBeTruthy();
		fireEvent.click(screen.getByText("Oceny"));
		await waitFor(() => expect(window.location.pathname).toBe("/grades/subject/12"));
	});

	it("shows a textual week range and navigation buttons", async () => {
		renderTimetable();
		await waitFor(() => expect(screen.getByText("Matematyka")).toBeTruthy());
		expect(screen.getByLabelText("Poprzedni tydzień")).toBeTruthy();
		expect(screen.getByLabelText("Następny tydzień")).toBeTruthy();
		expect(screen.getByText("12.10 – 18.10")).toBeTruthy();
	});
});

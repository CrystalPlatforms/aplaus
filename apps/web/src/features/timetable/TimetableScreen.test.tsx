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
import { TopBar } from "../shell/TopBar";
import { resetTimetableNav } from "./nav-store";
import { TimetableScreen } from "./TimetableScreen";
import { setTimetableView } from "./view-store";

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

/** Month calendar shows only kartkówki (green) and sprawdziany (red). */
const GRADES_FIXTURE = {
	grades: [
		{
			id: 901,
			grade: "4",
			dateOccurred: "2026-10-13",
			dateAdded: "2026-10-13",
			semester: 1,
			subjectId: 13,
			subjectName: "Historia",
			categoryId: 1,
			addedById: 56,
			addedByName: "Piotr Nowak",
			studentId: 7,
			lessonId: null,
			isConstituent: true,
			isSemester: false,
			isFinal: false,
			isSemesterProposition: false,
			isFinalProposition: false,
			commentIds: [],
		},
		{
			id: 902,
			grade: "3",
			dateOccurred: "2026-10-14",
			dateAdded: "2026-10-14",
			semester: 1,
			subjectId: 12,
			subjectName: "Matematyka",
			categoryId: 2,
			addedById: 55,
			addedByName: "Anna Kowalska",
			studentId: 7,
			lessonId: null,
			isConstituent: true,
			isSemester: false,
			isFinal: false,
			isSemesterProposition: false,
			isFinalProposition: false,
			commentIds: [],
		},
		{
			id: 903,
			grade: "+",
			dateOccurred: "2026-10-15",
			dateAdded: "2026-10-15",
			semester: 1,
			subjectId: 14,
			subjectName: "Biologia",
			categoryId: 3,
			addedById: 57,
			addedByName: "Ewa Zielińska",
			studentId: 7,
			lessonId: null,
			isConstituent: false,
			isSemester: false,
			isFinal: false,
			isSemesterProposition: false,
			isFinalProposition: false,
			commentIds: [],
		},
	],
	categories: [
		{
			id: 1,
			name: "Sprawdzian",
			short: "S",
			standard: true,
			colorId: null,
			isSemestral: false,
			isFinal: false,
			isSemestralProposition: false,
			isFinalProposition: false,
			blockAnyGrades: false,
		},
		{
			id: 2,
			name: "Kartkówka",
			short: "K",
			standard: true,
			colorId: null,
			isSemestral: false,
			isFinal: false,
			isSemestralProposition: false,
			isFinalProposition: false,
			blockAnyGrades: false,
		},
		{
			id: 3,
			name: "Odpowiedź ustna",
			short: null,
			standard: true,
			colorId: null,
			isSemestral: false,
			isFinal: false,
			isSemestralProposition: false,
			isFinalProposition: false,
			blockAnyGrades: false,
		},
	],
	comments: [
		{
			id: 501,
			gradeId: 901,
			addedById: 56,
			text: "Powodzenia na kolejnych sprawdzianach!",
		},
	],
	subjects: [],
};

function renderTimetable() {
	// The TopBar shows the timetable nav cluster only on /timetable.
	window.history.pushState({}, "", "/timetable");
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={client}>
			<RouterProvider>
				{/* The week/month arrows live in the shell TopBar on /timetable. */}
				<TopBar account={null} logout={() => {}} onSwitchAccount={() => {}} onRefresh={() => {}} />
				<TimetableScreen />
			</RouterProvider>
		</QueryClientProvider>,
	);
}

/** The redesign shows ONE day at a time — tests select the day tab first. */
async function openDay(tabName: string) {
	fireEvent.click(screen.getByRole("tab", { name: tabName }));
}

describe("TimetableScreen", () => {
	beforeEach(() => {
		// The screen renders the current week; pin the clock to the middle of
		// the fixture week (2026-10-12…18) so the test is calendar-independent.
		vi.setSystemTime(new Date("2026-10-14T10:00:00"));
		// The range nav is module-level (shared with the TopBar) — reset scroll.
		resetTimetableNav();
		apiFetchMock.mockReset();
		apiFetchMock.mockImplementation(async (path: string) => {
			if (path.startsWith("/api/timetable")) return TIMETABLE_FIXTURE;
			if (path.startsWith("/api/calendar/free-days")) return FREE_DAYS_FIXTURE;
			if (path.startsWith("/api/grades")) return GRADES_FIXTURE;
			throw new Error(`unexpected path ${path}`);
		});
	});

	it("renders the selected day's lessons; day tabs switch days", async () => {
		const { container } = renderTimetable();
		await waitFor(() =>
			expect(screen.getByRole("tab", { name: "Poniedziałek 12.10" })).toBeTruthy(),
		);
		await openDay("Poniedziałek 12.10");
		await waitFor(() => expect(screen.getByText("Matematyka")).toBeTruthy());
		expect(container.textContent).toContain("Anna Kowalska");

		await openDay("Wtorek 13.10");
		await waitFor(() => expect(screen.getByText("Historia")).toBeTruthy());
		// One day at a time: Monday's lesson is no longer in the document.
		expect(screen.queryByText("Matematyka")).toBeNull();
	});

	it("distinguishes canceled lessons and substitutions visually, not only by color", async () => {
		renderTimetable();
		await openDay("Wtorek 13.10");
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
		await openDay("Poniedziałek 12.10");
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

	it("keeps the week bar and day tabs mounted while the next week loads", async () => {
		renderTimetable();
		await openDay("Poniedziałek 12.10");
		await waitFor(() => expect(screen.getByText("Matematyka")).toBeTruthy());

		// The next week never arrives — the bar must stay, the content swaps to
		// the loader instead of unmounting the whole screen.
		let release: (() => void) | undefined;
		apiFetchMock.mockImplementation(
			(path: string) =>
				new Promise((resolve) => {
					if (path.startsWith("/api/timetable")) {
						release = () => resolve(TIMETABLE_FIXTURE);
					} else {
						resolve(FREE_DAYS_FIXTURE);
					}
				}),
		);
		fireEvent.click(screen.getByLabelText("Następny tydzień"));

		// Bar and tabs survive the switch…
		expect(screen.getByLabelText("Następny tydzień")).toBeTruthy();
		expect(screen.getByRole("tab", { name: "Poniedziałek 19.10" })).toBeTruthy();
		expect(screen.getByText("19.10 – 25.10")).toBeTruthy();
		// …the stale content is gone and a loader (aria-busy) shows instead.
		expect(screen.queryByText("Matematyka")).toBeNull();
		expect(document.querySelector("[aria-busy='true']")).toBeTruthy();

		// Data eventually lands and renders without ever unmounting the bar.
		release?.();
		await waitFor(() => expect(screen.getByText("19.10 – 25.10")).toBeTruthy());
		expect(screen.getByLabelText("Następny tydzień")).toBeTruthy();
	});

	it("desktop: month grid shows kartkówki and sprawdziany; the store switches to the day view", async () => {
		// Desktop viewport (md+): matchMedia stub from test-setup returns false;
		// this test needs a desktop pointer.
		vi.stubGlobal("matchMedia", (query: string) => ({
			matches: query === "(min-width: 768px)",
			media: query,
			onchange: null,
			addEventListener: () => {},
			removeEventListener: () => {},
			addListener: () => {},
			removeListener: () => {},
		}));
		try {
			renderTimetable();
			expect(await screen.findByTestId("timetable-month")).toBeTruthy();
			expect(screen.getByText("Październik 2026")).toBeTruthy();

			// Cells hold exam events from the grades cache, not lessons.
			const tuesdayCell = screen
				.getByText("Sprawdzian · Historia")
				.closest("[data-date='2026-10-13']");
			expect(tuesdayCell).toBeTruthy();
			const wednesdayCell = screen
				.getByText("Kartkówka · Matematyka")
				.closest("[data-date='2026-10-14']");
			expect(wednesdayCell).toBeTruthy();
			// Other grade categories stay out of the calendar.
			expect(screen.queryByText(/Odpowiedź ustna/)).toBeNull();

			// Tapping an exam opens the detail overlay with the grade's info.
			fireEvent.click(screen.getByText("Sprawdzian · Historia"));
			const examDialog = await waitFor(() => screen.getByRole("dialog", { name: "Historia" }));
			expect(examDialog).toBeTruthy();
			expect(screen.getByText("Sprawdzian", { selector: "span" })).toBeTruthy();
			expect(screen.getByText("Piotr Nowak")).toBeTruthy();
			expect(screen.getByText("4")).toBeTruthy();
			// The teacher's comment on the grade is visible in the overlay.
			expect(screen.getByText("Komentarze")).toBeTruthy();
			expect(screen.getByText("Powodzenia na kolejnych sprawdzianach!")).toBeTruthy();
			// Close, then leave the overlay behind for the view switch below.
			fireEvent.click(screen.getByText("Zamknij"));
			await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

			// The TopBar toggle drives the shared store; switching views works
			// without leaving the screen (the toggle itself lives in the shell).
			setTimetableView("day");
			await waitFor(() => expect(screen.getByTestId("timetable-day")).toBeTruthy());
			expect(screen.queryByTestId("timetable-month")).toBeNull();
		} finally {
			// Restore the test-setup default (mobile) for subsequent tests.
			vi.stubGlobal("matchMedia", (query: string) => ({
				matches: false,
				media: query,
				onchange: null,
				addEventListener: () => {},
				removeEventListener: () => {},
				addListener: () => {},
				removeListener: () => {},
			}));
			setTimetableView("month");
		}
	});

	it("shows a textual week range and navigation buttons", async () => {
		renderTimetable();
		await openDay("Poniedziałek 12.10");
		await waitFor(() => expect(screen.getByText("Matematyka")).toBeTruthy());
		expect(screen.getByLabelText("Poprzedni tydzień")).toBeTruthy();
		expect(screen.getByLabelText("Następny tydzień")).toBeTruthy();
		expect(screen.getByText("12.10 – 18.10")).toBeTruthy();
	});
});

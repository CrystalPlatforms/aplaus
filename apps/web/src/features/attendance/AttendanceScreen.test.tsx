/**
 * AttendanceScreen renders the record list and semester statistics from
 * fixtures: headline numbers, per-type breakdown and per-record dots.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/api")>();
	return { ...actual, apiFetch: apiFetchMock };
});

import { AttendanceScreen } from "./AttendanceScreen";

const FIXTURE = {
	attendances: [
		{
			id: 501,
			lessonId: 77,
			date: "2026-10-12",
			addDate: "2026-10-12 16:00:00",
			lessonNo: 1,
			semester: 1,
			typeId: 1,
			addedById: 55,
		},
		{
			id: 502,
			lessonId: 78,
			date: "2026-10-12",
			addDate: "2026-10-12 16:00:00",
			lessonNo: 2,
			semester: 1,
			typeId: 2,
			addedById: 55,
		},
		{
			id: 503,
			lessonId: 79,
			date: "2026-10-13",
			addDate: "2026-10-13 16:00:00",
			lessonNo: 3,
			semester: 2,
			typeId: 4,
			addedById: 55,
		},
	],
	types: [
		{
			id: 1,
			name: "Obecność",
			short: "ob",
			standard: true,
			colorHex: "#3b82f6",
			isPresenceKind: true,
			order: 1,
			identifier: "presence",
		},
		{
			id: 2,
			name: "Nieobecność",
			short: "nb",
			standard: true,
			colorHex: "#ef4444",
			isPresenceKind: false,
			order: 2,
			identifier: "absence",
		},
		{
			id: 4,
			name: "Spóźnienie",
			short: "sp",
			standard: true,
			colorHex: "#f59e0b",
			isPresenceKind: false,
			order: 4,
			identifier: "lateness",
		},
	],
};

function renderAttendance() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={client}>
			<AttendanceScreen />
		</QueryClientProvider>,
	);
}

describe("AttendanceScreen", () => {
	beforeEach(() => {
		apiFetchMock.mockReset();
		apiFetchMock.mockResolvedValue(FIXTURE);
	});

	it("renders headline statistics per active semester", async () => {
		renderAttendance();
		// Loading shows only the splash; the stats card appears with the data.
		const presenceLabel = await waitFor(() => screen.getByText("Obecności").nextElementSibling, {
			timeout: 2000,
		});
		// Semester 1 is the first: one presence and one excused absence.
		expect(presenceLabel?.textContent).toBe("1");
		expect(screen.getByText("Usprawiedliwione")).toBeTruthy();
		expect(screen.getByText("Nieusprawiedliwione")).toBeTruthy();
		expect(screen.getByText("Spóźnienia")).toBeTruthy();
	});

	it("renders the record list with type names and dates", async () => {
		renderAttendance();
		// The type name appears in the per-type breakdown and in the records list.
		await waitFor(() => expect(screen.getAllByText("Obecność").length).toBeGreaterThan(0));
		expect(screen.getAllByText("Nieobecność").length).toBeGreaterThan(0);
	});

	it("renders the semester switcher with both semesters", async () => {
		renderAttendance();
		await waitFor(() => expect(screen.getByText("Semestr 1")).toBeTruthy());
		expect(screen.getByText("Semestr 2")).toBeTruthy();
	});
});

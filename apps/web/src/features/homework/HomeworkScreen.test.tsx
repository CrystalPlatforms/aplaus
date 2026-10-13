/**
 * HomeworkScreen renders schedule entries and assignments from fixtures.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/api")>();
	return { ...actual, apiFetch: apiFetchMock };
});

import { HomeworkScreen } from "./HomeworkScreen";

const FIXTURE = {
	homeWorks: [
		{
			id: 900,
			content: "Zadania 1-10, strona 42",
			date: "2026-10-14",
			addDate: "2026-10-12 18:00:00",
			lessonNo: "4",
			timeFrom: "11:00",
			timeTo: "11:45",
			categoryId: 3,
			categoryName: "Zadanie domowe",
			createdById: 55,
			createdByName: "Anna Kowalska",
			subjectId: 12,
			subjectName: "Matematyka",
		},
	],
	assignments: [
		{
			id: 910,
			topic: "Wypracowanie",
			text: "Opis jesieni, 2 strony",
			date: "2026-10-12",
			dueDate: "2026-10-19",
			teacherId: 55,
			teacherName: "Anna Kowalska",
			studentIds: [900],
			mustSendAttachFile: false,
			sendFilePossible: false,
			addedFiles: false,
		},
	],
};

function renderHomework() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={client}>
			<HomeworkScreen />
		</QueryClientProvider>,
	);
}

describe("HomeworkScreen", () => {
	beforeEach(() => {
		apiFetchMock.mockReset();
		apiFetchMock.mockResolvedValue(FIXTURE);
	});

	it("renders schedule entries with subject, date and content", async () => {
		renderHomework();
		await waitFor(() => expect(screen.getByText("Matematyka")).toBeTruthy());
		expect(screen.getByText("Zadania 1-10, strona 42")).toBeTruthy();
		expect(screen.getByText("Zadania w terminarzu")).toBeTruthy();
	});

	it("opens the full content in a sheet when an entry is tapped", async () => {
		const { container } = renderHomework();
		await waitFor(() => expect(screen.getByText("Zadania 1-10, strona 42")).toBeTruthy());
		// The list shows a line-clamped preview, not the full text node.
		expect(container.querySelector(".line-clamp-2")).toBeTruthy();
		fireEvent.click(screen.getByText("Matematyka"));
		const dialog = await waitFor(() => screen.getByRole("dialog"));
		expect(dialog.textContent).toContain("Zadania 1-10, strona 42");
		expect(screen.getByText("Treść")).toBeTruthy();
	});

	it("renders assignments with topic and due dates", async () => {
		renderHomework();
		await waitFor(() => expect(screen.getByText("Wypracowanie")).toBeTruthy());
		expect(screen.getByText("Prace domowe")).toBeTruthy();
		expect(screen.getByText("Opis jesieni, 2 strony")).toBeTruthy();
		// Due date visible (first 10 chars of DueDate).
		expect(screen.getByText(/2026-10-19/)).toBeTruthy();
	});
});

/**
 * Ogłoszenia: lista pokazuje streszczenie (line-clamp-3), tapnięcie otwiera
 * arkusz z pełną treścią; etykiety statusów: przeszłe "Zakończone", przyszłe
 * "Nadchodzące", aktualne — bez etykiety.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/api")>();
	return { ...actual, apiFetch: apiFetchMock };
});

const navigateMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/router", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/router")>();
	return { ...actual, useRoute: () => ({ path: "/more/notices", navigate: navigateMock }) };
});

import { NoticeDetailScreen } from "./NoticeDetailScreen";
import { NoticesScreen } from "./NoticesScreen";

const NOTICES = [
	{
		id: "1",
		subject: "Wywiadówka",
		content: "Pełna treść ogłoszenia o wywiadówce.".repeat(20),
		startDate: "2026-10-01",
		endDate: "2026-10-31",
		creationDate: "",
		wasRead: false,
		addedById: null,
		addedByName: "Anna Kowalska",
	},
	{
		id: "2",
		subject: "Archiwalne ogłoszenie",
		content: "To ogłoszenie już nie obowiązuje.",
		startDate: "2025-09-01",
		endDate: "2025-09-30",
		creationDate: "",
		wasRead: true,
		addedById: null,
		addedByName: "Jan Nowak",
	},
];

function renderNotices() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={client}>
			<NoticesScreen />
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	apiFetchMock.mockReset();
	apiFetchMock.mockResolvedValue(NOTICES);
});

describe("NoticesScreen", () => {
	it("clamps the list content and navigates to the full notice view", async () => {
		const { container } = renderNotices();
		await waitFor(() => expect(screen.getByText("Wywiadówka")).toBeTruthy());
		expect(container.querySelector(".line-clamp-3")).toBeTruthy();
		fireEvent.click(screen.getByText("Wywiadówka"));
		expect(navigateMock).toHaveBeenCalledWith("/more/notices/notice/1");
	});

	it("the full notice view renders the whole content for the id", async () => {
		render(
			<QueryClientProvider
				client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
			>
				<NoticeDetailScreen id="1" />
			</QueryClientProvider>,
		);
		await waitFor(() => expect(screen.getByText("Wywiadówka")).toBeTruthy());
		expect(screen.getByText(/Pełna treść ogłoszenia o wywiadówce/)).toBeTruthy();
		expect(screen.getByText(/Anna Kowalska/)).toBeTruthy();
	});

	it("labels past notices as Zakończone and leaves active ones unlabeled", async () => {
		renderNotices();
		await waitFor(() => expect(screen.getByText("Wywiadówka")).toBeTruthy());
		expect(screen.getByText("Zakończone")).toBeTruthy();
		expect(screen.queryByText("Aktualne")).toBeNull();
	});
});

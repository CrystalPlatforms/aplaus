/**
 * Zebrania: wiersz skrócony, tapnięcie otwiera arkusz ze szczegółami
 * (nauczyciel, termin, sala, temat).
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
	return { ...actual, useRoute: () => ({ path: "/more/conferences", navigate: navigateMock }) };
});

import { ConferenceDetailScreen } from "./ConferenceDetailScreen";
import { ConferencesScreen } from "./ConferencesScreen";

const CONFERENCE = {
	id: 88,
	date: "2026-10-15",
	name: "Zebranie ogólne",
	classId: 3,
	teacherId: 55,
	teacherName: "Anna Kowalska",
	topic: "Temat zebrania: plan na rok szkolny, ewaluacja, sprawy bieżące. ".repeat(4),
	room: "204",
	time: "17:00",
};

function renderConferences() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={client}>
			<ConferencesScreen />
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	apiFetchMock.mockReset();
	apiFetchMock.mockResolvedValue([CONFERENCE]);
});

describe("ConferencesScreen", () => {
	it("clamps the topic in the list and navigates to the full view", async () => {
		const { container } = renderConferences();
		await waitFor(() => expect(screen.getByText("Zebranie ogólne")).toBeTruthy());
		expect(container.querySelector(".line-clamp-2")).toBeTruthy();
		fireEvent.click(screen.getByText("Zebranie ogólne"));
		expect(navigateMock).toHaveBeenCalledWith("/more/conferences/88");
	});

	it("the full view renders teacher, term, room and the whole topic", async () => {
		render(
			<QueryClientProvider
				client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
			>
				<ConferenceDetailScreen id="88" />
			</QueryClientProvider>,
		);
		await waitFor(() => expect(screen.getByText("Zebranie ogólne")).toBeTruthy());
		expect(screen.getByText(/ewaluacja, sprawy bieżące/)).toBeTruthy();
		expect(screen.getByText("204")).toBeTruthy();
		expect(screen.getByText("Anna Kowalska")).toBeTruthy();
		expect(screen.getByText(/2026-10-15, 17:00/)).toBeTruthy();
	});
});

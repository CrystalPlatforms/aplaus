/**
 * MessagesScreen: folders from fixtures, unread highlighted, pagination from
 * the `total` field.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/api")>();
	return { ...actual, apiFetch: apiFetchMock };
});

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => void storage.set(key, value),
	removeItem: (key: string) => void storage.delete(key),
	clear: () => void storage.clear(),
});

import { setToken } from "@/lib/api";
import { MessagesScreen } from "./MessagesScreen";

const INBOX_PAGE = {
	messages: [
		{
			messageId: "1001",
			senderName: "Anna Kowalska",
			topic: "Wywiadówka",
			content: "Zapraszam",
			sendDate: "2026-10-11 18:00:00",
			readDate: null,
			hasAttachments: true,
		},
		{
			messageId: "1002",
			senderName: "Jan Nowak",
			topic: "Uwaga",
			content: "Informacja",
			sendDate: "2026-10-10 10:00:00",
			readDate: "2026-10-11 09:00:00",
			hasAttachments: false,
		},
	],
	total: 41,
};

function renderMessages() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={client}>
			<MessagesScreen />
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	storage.clear();
	setToken("device-token-test");
	apiFetchMock.mockReset();
	apiFetchMock.mockImplementation(async (path: string) => {
		if (path.startsWith("/api/messages/inbox?")) return INBOX_PAGE;
		if (path.startsWith("/api/messages/outbox?")) return { messages: [], total: 0 };
		throw new Error(`unexpected api call: ${path}`);
	});
});

describe("MessagesScreen", () => {
	it("renders the inbox from fixtures, unread highlighted", async () => {
		renderMessages();
		await waitFor(() => expect(screen.getByText("Wywiadówka")).toBeTruthy());
		const unreadTopic = screen.getByText("Wywiadówka").closest("span") as HTMLElement | null;
		expect(unreadTopic?.className).toContain("font-bold");
		expect(screen.getByText("Uwaga")).toBeTruthy();
		expect(screen.getByText("Anna Kowalska")).toBeTruthy();
		// Pagination derives from `total` (41 items / 20 per page).
		expect(screen.getByText("Strona 1 z 3")).toBeTruthy();
	});

	it("switches to the outbox folder", async () => {
		renderMessages();
		await waitFor(() => expect(screen.getByText("Wywiadówka")).toBeTruthy());
		fireEvent.click(screen.getByText("Wysłane"));
		await waitFor(() => expect(screen.getByText("Brak wiadomości.")).toBeTruthy());
	});

	it("requests page 2 when older messages are requested", async () => {
		renderMessages();
		await waitFor(() => expect(screen.getByText("Wywiadówka")).toBeTruthy());
		fireEvent.click(screen.getByText("Starsze"));
		await waitFor(() =>
			expect(
				apiFetchMock.mock.calls.some(([path]) =>
					String(path).includes("/api/messages/inbox?page=2&limit=20"),
				),
			).toBe(true),
		);
	});
});

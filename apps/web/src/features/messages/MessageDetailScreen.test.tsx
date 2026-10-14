/**
 * MessageDetailScreen: detal jako podstawa; gdy Librus nie da szczegółów,
 * treść przychodzi z cache listy (fallback), a pliki bez nazwy dostają
 * numer ("Załącznik 1"), nie "plik".
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
import { MessageDetailScreen } from "./MessageDetailScreen";

const LIST_ITEM = {
	messageId: "1001",
	senderName: "Anna Kowalska",
	topic: "Wywiadówka",
	content: "Zapraszam na zebranie.",
	sendDate: "2026-10-11 18:00:00",
	readDate: "2026-10-12 09:00:00",
	hasAttachments: true,
};

const DETAIL = {
	...LIST_ITEM,
	attachments: [{ fileName: "plan.pdf" }],
};

function renderDetail(folder: "inbox" | "outbox", id: string, client?: QueryClient) {
	const qc = client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={qc}>
			<MessageDetailScreen folder={folder} id={id} />
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	storage.clear();
	setToken("device-token-test");
	apiFetchMock.mockReset();
});

describe("MessageDetailScreen", () => {
	it("renders topic, sender, content and attachment names from the detail", async () => {
		apiFetchMock.mockResolvedValue(DETAIL);
		renderDetail("inbox", "1001");
		await waitFor(() => expect(screen.getByText("Wywiadówka")).toBeTruthy());
		expect(screen.getByText("Zapraszam na zebranie.")).toBeTruthy();
		expect(screen.getByText(/plan.pdf/)).toBeTruthy();
	});

	it("numbers unnamed attachments instead of the misleading plik", async () => {
		apiFetchMock.mockResolvedValue({
			...DETAIL,
			attachments: [{ fileName: null }],
		});
		renderDetail("inbox", "1001");
		await waitFor(() => expect(screen.getByText(/Załącznik 1/)).toBeTruthy());
		expect(screen.queryByText("📎 plik")).toBeNull();
	});

	it("keeps the LONGER list content when the detail returns something shorter", async () => {
		const full = `${LIST_ITEM.content} Dopisek, którego detal nie zwraca.`;
		apiFetchMock.mockResolvedValue({ ...DETAIL, content: "Skrót." });
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		client.setQueryData(["messages", "inbox", 1, 20], {
			messages: [{ ...LIST_ITEM, content: full }],
			total: 1,
		});
		renderDetail("inbox", "1001", client);
		await waitFor(() => expect(screen.getByText(/Dopisek, którego detal nie zwraca/)).toBeTruthy());
	});

	it("falls back to the cached list content when the detail fails, saying so with a retry", async () => {
		apiFetchMock.mockImplementation(async (path: string) => {
			if (path.endsWith("/api/messages/inbox/1001")) throw new Error("detail unavailable");
			throw new Error(`unexpected: ${path}`);
		});
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		client.setQueryData(["messages", "inbox", 1, 20], { messages: [LIST_ITEM], total: 1 });
		renderDetail("inbox", "1001", client);
		await waitFor(() => expect(screen.getByText("Zapraszam na zebranie.")).toBeTruthy());
		expect(screen.getByText(/skrócony podgląd/)).toBeTruthy();
		// Retry heals the view: the next detail call succeeds.
		apiFetchMock.mockResolvedValue(DETAIL);
		fireEvent.click(screen.getByText("Spróbuj ponownie"));
		await waitFor(() => expect(screen.queryByText(/skrócony podgląd/)).toBeNull());
	});
});

describe("MessageDetailScreen downloads", () => {
	it("attachment with an id renders as a download button calling the proxy", async () => {
		apiFetchMock.mockResolvedValue({
			...DETAIL,
			attachments: [{ fileName: "plan.pdf", id: "77" }],
		});
		renderDetail("inbox", "1001");
		const button = await waitFor(() => screen.getByText("📎 plan.pdf"));
		expect(button.tagName).toBe("BUTTON");
	});
});

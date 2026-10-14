import type { MessageDetail, MessageListPage, UnreadCounts } from "@repo/librus-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, getToken } from "@/lib/api";

/** Root of every messages cache entry — one invalidation refreshes all. */
const MESSAGES_KEY = ["messages"];

export function useInboxMessages(page: number, limit = 20) {
	return useQuery({
		queryKey: ["messages", "inbox", page, limit],
		queryFn: () => apiFetch<MessageListPage>(`/api/messages/inbox?page=${page}&limit=${limit}`),
		enabled: !!getToken(),
	});
}

export function useOutboxMessages(page: number, limit = 20) {
	return useQuery({
		queryKey: ["messages", "outbox", page, limit],
		queryFn: () => apiFetch<MessageListPage>(`/api/messages/outbox?page=${page}&limit=${limit}`),
		enabled: !!getToken(),
	});
}

export function useUnreadCount() {
	return useQuery({
		queryKey: ["messages", "unread"],
		queryFn: () => apiFetch<UnreadCounts>("/api/messages/inbox/unread-count"),
		enabled: !!getToken(),
	});
}

export function useMessageDetail(folder: "inbox" | "outbox", id: string) {
	return useQuery({
		queryKey: ["messages", folder, "detail", id],
		queryFn: () => apiFetch<MessageDetail | null>(`/api/messages/${folder}/${id}`),
		enabled: !!getToken() && id !== "",
	});
}

/** Refreshes every messages query (lists, unread counter, detail). */
export function useInvalidateMessages() {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries({ queryKey: MESSAGES_KEY });
}

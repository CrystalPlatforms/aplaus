import type {
	ClientScanResult,
	CustomReceiverGroup,
	DraftListPage,
	DraftRecord,
	MessageDetail,
	MessageListPage,
	MessageReceiver,
	MessageSignature,
	MessageTag,
	ProbeResult,
	ReceiverEntry,
	ReceiverGroupWriteResult,
	ReceiverType,
	SentMessage,
	TagWriteResult,
	UnreadCounts,
} from "@repo/librus-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

/** GET /api/messages/receivers/types — receiver type dictionary for the composer. */
export function useReceiverTypes() {
	return useQuery({
		queryKey: ["messages", "receiver-types"],
		queryFn: () => apiFetch<ReceiverType[]>("/api/messages/receivers/types"),
		enabled: !!getToken(),
	});
}

/** GET /api/messages/drafts — one page of drafts. */
export function useDrafts(page: number, limit = 20) {
	return useQuery({
		queryKey: ["messages", "drafts", page, limit],
		queryFn: () => apiFetch<DraftListPage>(`/api/messages/drafts?page=${page}&limit=${limit}`),
		enabled: !!getToken(),
	});
}

/** GET /api/messages/drafts/:id — the draft body for editing; null when gone. */
export function useDraft(id: string) {
	return useQuery({
		queryKey: ["messages", "draft", id],
		queryFn: () => apiFetch<DraftRecord | null>(`/api/messages/drafts/${id}`),
		enabled: !!getToken() && id !== "",
	});
}

/** Body shared by the draft mutations: receivers + topic + content + storage. */
export interface DraftFormBody {
	receivers: MessageReceiver[];
	topic: string;
	content: string;
	storageId: string | null;
}

/** POST /api/messages/drafts — create (with optional reply/forward context). */
export function useCreateDraft() {
	const invalidate = useInvalidateMessages();
	return useMutation({
		mutationFn: (
			body: DraftFormBody & { repliedToMessageId?: string; forwardedMessageId?: string },
		) =>
			apiFetch<DraftRecord>("/api/messages/drafts", { method: "POST", body: JSON.stringify(body) }),
		onSuccess: () => invalidate(),
	});
}

/** PUT /api/messages/drafts/:variant/:id — save an edited draft. */
export function useUpdateDraft() {
	const invalidate = useInvalidateMessages();
	return useMutation({
		mutationFn: (args: { variant: string; id: string; body: DraftFormBody }) =>
			apiFetch<DraftRecord | null>(`/api/messages/drafts/${args.variant}/${args.id}`, {
				method: "PUT",
				body: JSON.stringify(args.body),
			}),
		onSuccess: () => invalidate(),
	});
}

/** DELETE /api/messages/drafts/:id. */
export function useDeleteDraft() {
	const invalidate = useInvalidateMessages();
	return useMutation({
		mutationFn: (id: string) => apiFetch<null>(`/api/messages/drafts/${id}`, { method: "DELETE" }),
		onSuccess: () => invalidate(),
	});
}

/**
 * POST /api/messages/send — the user's explicit send. No automatic retry of
 * the send itself: a failed send surfaces its error and the user decides
 * whether to tap again (the proxy retries only a dead session, which by
 * definition delivered nothing).
 */
export function useSendMessage() {
	const invalidate = useInvalidateMessages();
	return useMutation({
		mutationFn: (
			body: DraftFormBody & {
				category?: string;
				repliedToMessageId?: string;
				forwardedMessageId?: string;
			},
		) =>
			apiFetch<SentMessage>("/api/messages/send", { method: "POST", body: JSON.stringify(body) }),
		onSuccess: () => invalidate(),
	});
}

/** GET /api/messages/signatures — 404 z Librusa = pusta lista podpisów (proxy normalizuje). */
export function useSignatures() {
	return useQuery({
		queryKey: ["messages", "signatures"],
		queryFn: () => apiFetch<MessageSignature[]>("/api/messages/signatures"),
		enabled: !!getToken(),
	});
}

/** Body of the signature create/modify form. */
export interface SignatureFormBody {
	name: string;
	content: string;
	defaultForNewThreads: boolean;
	defaultForReplies: boolean;
}

/** POST /api/messages/signatures. */
export function useCreateSignature() {
	const invalidate = useInvalidateMessages();
	return useMutation({
		mutationFn: (body: SignatureFormBody) =>
			apiFetch<MessageSignature | null>("/api/messages/signatures", {
				method: "POST",
				body: JSON.stringify(body),
			}),
		onSuccess: () => invalidate(),
	});
}

/** PUT /api/messages/signatures/:id. */
/** DELETE /api/messages/signatures/:id. */
export function useDeleteSignature() {
	const invalidate = useInvalidateMessages();
	return useMutation({
		mutationFn: (id: string) =>
			apiFetch<null>(`/api/messages/signatures/${id}`, { method: "DELETE" }),
		onSuccess: () => invalidate(),
	});
}

/** POST /api/messages/tags. */
export function useCreateTag() {
	const invalidate = useInvalidateMessages();
	return useMutation({
		mutationFn: (args: { name: string; colorRgb: string }) =>
			apiFetch<TagWriteResult>("/api/messages/tags", {
				method: "POST",
				body: JSON.stringify(args),
			}),
		onSuccess: () => invalidate(),
	});
}

/** PUT /api/messages/tags/:id. */
/** DELETE /api/messages/tags/:id. */
export function useDeleteTag() {
	const invalidate = useInvalidateMessages();
	return useMutation({
		mutationFn: (id: string) => apiFetch<null>(`/api/messages/tags/${id}`, { method: "DELETE" }),
		onSuccess: () => invalidate(),
	});
}

/** GET /api/messages/receivers?type= — osoby danego typu odbiorcy (picker). */
export function useReceivers(typeId: string) {
	return useQuery({
		queryKey: ["messages", "receivers", typeId],
		queryFn: () =>
			apiFetch<ReceiverEntry[]>(`/api/messages/receivers?type=${encodeURIComponent(typeId)}`),
		enabled: !!getToken() && typeId !== "",
	});
}

/** GET /api/messages/tags — słownik etykiet wiadomości. */
export function useTags() {
	return useQuery({
		queryKey: ["messages", "tags"],
		queryFn: () => apiFetch<MessageTag[]>("/api/messages/tags"),
		enabled: !!getToken(),
	});
}

/** GET /api/messages/receivers/custom-groups. */
export function useCustomGroups() {
	return useQuery({
		queryKey: ["messages", "custom-groups"],
		queryFn: () => apiFetch<CustomReceiverGroup[]>("/api/messages/receivers/custom-groups"),
		enabled: !!getToken(),
	});
}

/** POST /api/messages/receivers/custom-groups. */
export function useCreateGroup() {
	const invalidate = useInvalidateMessages();
	return useMutation({
		mutationFn: (name: string) =>
			apiFetch<ReceiverGroupWriteResult>("/api/messages/receivers/custom-groups", {
				method: "POST",
				body: JSON.stringify({ name }),
			}),
		onSuccess: () => invalidate(),
	});
}

/** PUT /api/messages/receivers/custom-groups/:id. */
/** DELETE /api/messages/receivers/custom-groups/:id. */
export function useDeleteGroup() {
	const invalidate = useInvalidateMessages();
	return useMutation({
		mutationFn: (id: string) =>
			apiFetch<null>(`/api/messages/receivers/custom-groups/${id}`, { method: "DELETE" }),
		onSuccess: () => invalidate(),
	});
}

/** GET /api/messages/trash — jedna strona kosza. */
export function useTrashMessages(page: number, limit = 20) {
	return useQuery({
		queryKey: ["messages", "trash", page, limit],
		queryFn: () => apiFetch<MessageListPage>(`/api/messages/trash?page=${page}&limit=${limit}`),
		enabled: !!getToken(),
	});
}

/** POST /api/messages/trash — przeniesienie wiadomości do kosza. */
export function useMoveToTrash() {
	const invalidate = useInvalidateMessages();
	return useMutation({
		mutationFn: (messageId: string) =>
			apiFetch<null>("/api/messages/trash", {
				method: "POST",
				body: JSON.stringify({ messageId }),
			}),
		onSuccess: () => invalidate(),
	});
}

/** PUT /api/messages/trash/:id/restore. */
export function useRestoreFromTrash() {
	const invalidate = useInvalidateMessages();
	return useMutation({
		mutationFn: (id: string) =>
			apiFetch<null>(`/api/messages/trash/${id}/restore`, { method: "PUT", body: "{}" }),
		onSuccess: () => invalidate(),
	});
}

/** DELETE /api/messages/trash/:id — trwałe usunięcie (UI potwierdza wcześniej). */
export function useDeletePermanently() {
	const invalidate = useInvalidateMessages();
	return useMutation({
		mutationFn: (id: string) => apiFetch<null>(`/api/messages/trash/${id}`, { method: "DELETE" }),
		onSuccess: () => invalidate(),
	});
}

/** GET /api/messages/receivers/probe?type= — Tester diagnostyczny (uruchamiany przyciskiem). */
export function useMessagesProbe() {
	return useMutation({
		mutationFn: (typeId: string) =>
			apiFetch<ProbeResult[]>(`/api/messages/receivers/probe?type=${encodeURIComponent(typeId)}`),
	});
}

/** GET /api/messages/client-scan — skaner kodu klienta Librusa (jeden przycisk). */
export function useClientScan() {
	return useMutation({
		mutationFn: () => apiFetch<ClientScanResult>("/api/messages/client-scan"),
	});
}

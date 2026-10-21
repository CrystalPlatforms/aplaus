/**
 * Treść wiadomości. Detal (`/api/messages/inbox/:id`) jest podstawą — to on
 * oznacza wiadomość jako przeczytaną w Librusie. Treść bierzemy z DŁUŻSZEGO
 * z dwóch źródeł (detal vs cache listy): żywe konta pokazały, że któryś z
 * końców potrafi zwrócić treść skróconą albo pod inną nazwą pola — wtedy
 * drugie źródło ma pełny tekst i to ono wygrywa.
 */

import type { MessageDetail, MessageListItem } from "@repo/librus-client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ButtonSpinner } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ViewLoader } from "@/components/ViewLoader";
import { apiDownload } from "@/lib/api";
import { useRoute } from "@/lib/router";
import { useInvalidateMessages, useMessageDetail, useMoveToTrash } from "./queries";

/** Action row under the message: reply, forward, move to trash (Faza 10). */
function MessageActions({ folder, id }: { folder: "inbox" | "outbox"; id: string }) {
	const { navigate } = useRoute();
	const moveToTrash = useMoveToTrash();
	const [error, setError] = useState<string | null>(null);

	async function onTrash() {
		setError(null);
		try {
			await moveToTrash.mutateAsync(id);
			navigate("/messages");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Nie udało się przenieść do kosza.");
		}
	}

	return (
		<div className="flex flex-col gap-2">
			{error && <p className="text-xs text-destructive">{error}</p>}
			<div className="flex flex-wrap gap-2">
				<Button
					variant="outline"
					size="sm"
					onClick={() => navigate(`/messages/${folder}/${id}/reply`)}
				>
					Odpowiedz
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={() => navigate(`/messages/${folder}/${id}/forward`)}
				>
					Przekaż
				</Button>
				<Button
					variant="outline"
					size="sm"
					className="text-destructive"
					onClick={() => void onTrash()}
					disabled={moveToTrash.isPending}
				>
					{moveToTrash.isPending ? (
						<>
							<ButtonSpinner />
							Przenoszenie…
						</>
					) : (
						"Do kosza"
					)}
				</Button>
			</div>
		</div>
	);
}

/** Finds the message in any cached folder page of this folder. */
function listItemOf(
	queryClient: ReturnType<typeof useQueryClient>,
	folder: "inbox" | "outbox",
	id: string,
): MessageListItem | null {
	const queries = queryClient.getQueryCache().findAll({ queryKey: ["messages", folder] });
	for (const query of queries) {
		const page = query.state.data as { messages?: MessageListItem[] } | undefined;
		if (!page?.messages) continue;
		const hit = page.messages.find((m) => m.messageId === id);
		if (hit) return hit;
	}
	return null;
}

export function MessageDetailScreen({ folder, id }: { folder: "inbox" | "outbox"; id: string }) {
	const { data, isError, refetch } = useMessageDetail(folder, id);
	const queryClient = useQueryClient();
	const invalidateMessages = useInvalidateMessages();
	const invalidated = useRef(false);

	useEffect(() => {
		if (folder === "inbox" && data?.readDate === null && !invalidated.current) {
			invalidated.current = true;
			invalidateMessages();
		}
	}, [folder, data, invalidateMessages]);

	const fallback = listItemOf(queryClient, folder, id);

	if (isError || data === null || data === undefined) {
		if (fallback) {
			// The detail call failed but the folder page cached the message —
			// Librus cuts that preview (~100 bytes), so say so and let the user
			// retry instead of silently showing a mid-word-cut body.
			return (
				<>
					<p className="rounded-xl border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
						Nie udało się pobrać pełnej treści — poniżej skrócony podgląd.
					</p>
					<Button size="sm" className="self-start text-xs" onClick={() => void refetch()}>
						Spróbuj ponownie
					</Button>
					<MessageActions folder={folder} id={id} />
					<MessageCard message={fallback} messageId={id} />
				</>
			);
		}
		if (isError) {
			return (
				<div className="flex flex-col items-center gap-3 py-16">
					<p className="text-sm text-destructive">Nie udało się pobrać wiadomości.</p>
					<Button size="sm" className="text-xs" onClick={() => void refetch()}>
						Spróbuj ponownie
					</Button>
				</div>
			);
		}
		if (data === null) {
			return (
				<p className="py-16 text-center text-sm text-muted-foreground">
					Wiadomość nie została znaleziona.
				</p>
			);
		}
		return <ViewLoader />;
	}
	// Longer of the two bodies wins (the detail endpoint truncates on live
	// accounts; the list may truncate instead — the fuller one is the message).
	const detailContent = data.content ?? "";
	const listContent = fallback?.content ?? "";
	const content =
		detailContent.length >= listContent.length ? detailContent : (fallback?.content ?? "");
	return (
		<div className="flex flex-col gap-4">
			<MessageActions folder={folder} id={id} />
			<MessageCard message={data} content={content} messageId={id} />
		</div>
	);
}

function MessageCard({
	message,
	content,
	messageId,
}: {
	message: MessageDetail | MessageListItem;
	content?: string;
	messageId: string;
}) {
	const attachments = "attachments" in message ? message.attachments : null;
	const body = content ?? message.content;
	return (
		<div className="flex flex-col gap-4">
			<p className="text-xs text-muted-foreground">
				Otwarcie wiadomości oznacza ją jako przeczytaną w Librusie.
			</p>
			<Card className="flex-col gap-2 p-4">
				<h2 className="text-lg font-semibold">{message.topic || "(bez tematu)"}</h2>
				<p className="text-xs text-muted-foreground">
					{message.senderName ?? "-"} · {message.sendDate?.slice(0, 16).replace("T", " ") ?? ""}
				</p>
				<p className="text-sm whitespace-pre-wrap">{body}</p>
				{attachments !== null && attachments.length > 0 && (
					<section>
						<h3 className="mb-1 text-xs font-semibold text-muted-foreground">Załączniki</h3>
						<ul className="flex flex-col gap-1">
							{attachments.map((a, index) => {
								const name = a.fileName ?? `Załącznik ${index + 1}`;
								if (!a.id) {
									return (
										<li key={a.id ?? `${name}-${index}`} className="text-sm">
											📎 {name}
										</li>
									);
								}
								return (
									<li key={a.id ?? `${name}-${index}`}>
										<button
											type="button"
											onClick={() => {
												void apiDownload(`/api/messages/attachments/${a.id}/${messageId}`, name);
											}}
											className="text-sm text-primary underline"
										>
											📎 {name}
										</button>
									</li>
								);
							})}
						</ul>
					</section>
				)}
				{message.hasAttachments && attachments !== null && attachments.length === 0 && (
					<p className="text-xs text-muted-foreground">
						Wiadomość ma załącznik — pobieranie plików dojdzie z pełnym obiegiem wiadomości.
					</p>
				)}
			</Card>
		</div>
	);
}

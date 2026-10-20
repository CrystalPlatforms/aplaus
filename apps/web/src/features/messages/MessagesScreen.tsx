import { useState } from "react";
import { ButtonSpinner } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ViewLoader } from "@/components/ViewLoader";
import { useRoute } from "@/lib/router";
import {
	useDeletePermanently,
	useInboxMessages,
	useOutboxMessages,
	useRestoreFromTrash,
	useTrashMessages,
} from "./queries";

const PAGE_LIMIT = 20;
const FOLDERS = ["inbox", "outbox", "trash"] as const;
const FOLDER_LABELS: Record<(typeof FOLDERS)[number], string> = {
	inbox: "Odebrane",
	outbox: "Wysłane",
	trash: "Kosz",
};

/** Folder list: Odebrane / Wysłane / Kosz with "Starsze" "Kosz" actions. */
export function MessagesScreen() {
	const { navigate } = useRoute();
	const [folder, setFolder] = useState<"inbox" | "outbox" | "trash">("inbox");
	const [page, setPage] = useState(1);
	const [confirmId, setConfirmId] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);

	// Rules of hooks: call all folder hooks, pick by folder.
	const inbox = useInboxMessages(page, PAGE_LIMIT);
	const outbox = useOutboxMessages(page, PAGE_LIMIT);
	const trash = useTrashMessages(page, PAGE_LIMIT);
	const restoreFromTrash = useRestoreFromTrash();
	const deletePermanently = useDeletePermanently();

	const { data, isLoading, isError } =
		folder === "inbox" ? inbox : folder === "outbox" ? outbox : trash;

	if (isError) {
		return (
			<p className="py-16 text-center text-sm text-destructive">Nie udało się pobrać wiadomości.</p>
		);
	}
	if (isLoading) return <ViewLoader />;

	const messages = data?.messages ?? [];
	const total = data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

	async function onRestore(id: string) {
		setActionError(null);
		try {
			await restoreFromTrash.mutateAsync(id);
		} catch (e) {
			setActionError(e instanceof Error ? e.message : "Nie udało się przywrócić wiadomości.");
		}
	}

	async function onDeletePermanently(id: string) {
		setActionError(null);
		try {
			await deletePermanently.mutateAsync(id);
			setConfirmId(null);
		} catch (e) {
			setActionError(e instanceof Error ? e.message : "Nie udało się trwale usunąć wiadomości.");
		}
	}

	return (
		<div className="flex flex-col gap-4">
			{actionError && (
				<p
					role="alert"
					className="rounded-xl bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive"
				>
					{actionError}
				</p>
			)}
			<div className="flex gap-2">
				<Button className="flex-1" onClick={() => navigate("/messages/compose")}>
					Nowa wiadomość
				</Button>
				<Button variant="outline" onClick={() => navigate("/messages/drafts")}>
					Szkice
				</Button>
			</div>
			<div className="flex rounded-lg bg-muted p-1">
				{FOLDERS.map((f) => (
					<button
						key={f}
						type="button"
						onClick={() => {
							setFolder(f);
							setPage(1);
						}}
						className={`flex-1 py-2 text-sm font-medium rounded-md ${
							folder === f ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
						}`}
					>
						{FOLDER_LABELS[f]}
					</button>
				))}
			</div>

			<Card key={folder} className="animate-folder-in gap-0 py-0 overflow-hidden">
				{messages.length === 0 ? (
					<p className="px-4 py-6 text-sm text-muted-foreground">Brak wiadomości.</p>
				) : (
					<ul>
						{messages.map((m) => {
							const unread = folder === "inbox" && m.readDate === null;
							return (
								<li key={m.messageId}>
									<button
										type="button"
										onClick={() => navigate(`/messages/${folder}/${m.messageId}`)}
										className="w-full px-4 py-2.5 text-left flex items-center justify-between gap-2"
									>
										<span className="min-w-0">
											<span className="block text-sm font-medium truncate">
												{m.senderName ?? "-"}
											</span>
											<span className={`block text-sm truncate ${unread ? "font-bold" : ""}`}>
												{unread && (
													<span
														role="img"
														aria-label="Nieprzeczytana"
														className="w-2 h-2 rounded-full bg-primary inline-block mr-1.5"
													/>
												)}
												{m.topic}
												{m.hasAttachments && (
													<span role="img" aria-label="Załącznik" className="ml-1">
														📎
													</span>
												)}
											</span>
											<span className="block text-xs text-muted-foreground">
												{m.sendDate?.slice(0, 16).replace("T", " ") ?? ""}
											</span>
										</span>
										<span className="text-muted-foreground shrink-0">&gt;</span>
									</button>
									{folder === "trash" && (
										<div className="flex gap-2 px-4 pb-2.5 -mt-1">
											<Button
												variant="ghost"
												size="sm"
												className="h-7 text-xs text-primary"
												onClick={() => void onRestore(m.messageId)}
												disabled={restoreFromTrash.isPending}
											>
												{restoreFromTrash.isPending &&
												restoreFromTrash.variables === m.messageId ? (
													<>
														<ButtonSpinner />
														Przywracanie…
													</>
												) : (
													"Przywróć"
												)}
											</Button>
											{confirmId === m.messageId ? (
												<>
													<span className="text-xs text-muted-foreground">
														Trwale usunąć? Bezpowrotne.
													</span>
													<Button
														variant="ghost"
														size="sm"
														className="h-7 text-xs text-destructive"
														onClick={() => void onDeletePermanently(m.messageId)}
														disabled={deletePermanently.isPending}
													>
														{deletePermanently.isPending &&
														deletePermanently.variables === m.messageId ? (
															<>
																<ButtonSpinner />
																Usuwanie…
															</>
														) : (
															"Tak, usuń trwale"
														)}
													</Button>
													<Button
														variant="ghost"
														size="sm"
														className="h-7 text-xs text-muted-foreground"
														onClick={() => setConfirmId(null)}
													>
														Anuluj
													</Button>
												</>
											) : (
												<Button
													variant="ghost"
													size="sm"
													className="h-7 text-xs text-destructive"
													onClick={() => setConfirmId(m.messageId)}
												>
													Usuń trwale
												</Button>
											)}
										</div>
									)}
								</li>
							);
						})}
					</ul>
				)}
			</Card>

			<div className="flex items-center justify-between">
				<Button
					variant="ghost"
					size="sm"
					className="h-8 px-3 text-sm text-primary disabled:text-muted-foreground"
					onClick={() => setPage((p) => p + 1)}
					disabled={page * PAGE_LIMIT >= total}
				>
					Starsze
				</Button>
				<span className="text-sm text-muted-foreground">
					Strona {page} z {totalPages}
				</span>
				<Button
					variant="ghost"
					size="sm"
					className="h-8 px-3 text-sm text-primary disabled:text-muted-foreground"
					onClick={() => setPage((p) => p - 1)}
					disabled={page <= 1}
				>
					Nowsze
				</Button>
			</div>
		</div>
	);
}

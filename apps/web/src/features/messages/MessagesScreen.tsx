import { useState } from "react";
import { ButtonSpinner } from "@/components/Loader";
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
			<p className="py-16 text-center text-sm text-red-500">Nie udało się pobrać wiadomości.</p>
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
					className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-3 py-2 text-xs text-red-700 dark:text-red-300"
				>
					{actionError}
				</p>
			)}
			<div className="flex gap-2">
				<button
					type="button"
					onClick={() => navigate("/messages/compose")}
					className="flex-1 rounded-xl bg-green-700 px-3 py-2.5 text-sm font-medium text-white"
				>
					Nowa wiadomość
				</button>
				<button
					type="button"
					onClick={() => navigate("/messages/drafts")}
					className="rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 py-2.5 text-sm font-medium"
				>
					Szkice
				</button>
			</div>
			<div className="flex rounded-xl bg-neutral-200/70 dark:bg-neutral-900 p-1">
				{FOLDERS.map((f) => (
					<button
						key={f}
						type="button"
						onClick={() => {
							setFolder(f);
							setPage(1);
						}}
						className={`flex-1 py-2 text-sm font-medium rounded-lg ${
							folder === f ? "bg-white dark:bg-neutral-800 shadow" : "text-neutral-500"
						}`}
					>
						{FOLDER_LABELS[f]}
					</button>
				))}
			</div>

			<section className="rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800">
				{messages.length === 0 ? (
					<p className="px-4 py-6 text-sm text-neutral-400">Brak wiadomości.</p>
				) : (
					<ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
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
														className="w-2 h-2 rounded-full bg-blue-500 inline-block mr-1.5"
													/>
												)}
												{m.topic}
												{m.hasAttachments && (
													<span role="img" aria-label="Załącznik" className="ml-1">
														📎
													</span>
												)}
											</span>
											<span className="block text-xs text-neutral-500">
												{m.sendDate?.slice(0, 16).replace("T", " ") ?? ""}
											</span>
										</span>
										<span className="text-neutral-400 shrink-0">&gt;</span>
									</button>
									{folder === "trash" && (
										<div className="flex gap-2 px-4 pb-2.5 -mt-1">
											<button
												type="button"
												onClick={() => void onRestore(m.messageId)}
												disabled={restoreFromTrash.isPending}
												className="text-xs font-medium text-blue-600 dark:text-blue-400"
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
											</button>
											{confirmId === m.messageId ? (
												<>
													<span className="text-xs text-neutral-500">
														Trwale usunąć? Bezpowrotne.
													</span>
													<button
														type="button"
														onClick={() => void onDeletePermanently(m.messageId)}
														disabled={deletePermanently.isPending}
														className="text-xs font-medium text-red-600 dark:text-red-400"
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
													</button>
													<button
														type="button"
														onClick={() => setConfirmId(null)}
														className="text-xs font-medium text-neutral-500"
													>
														Anuluj
													</button>
												</>
											) : (
												<button
													type="button"
													onClick={() => setConfirmId(m.messageId)}
													className="text-xs font-medium text-red-600 dark:text-red-400"
												>
													Usuń trwale
												</button>
											)}
										</div>
									)}
								</li>
							);
						})}
					</ul>
				)}
			</section>

			<div className="flex items-center justify-between">
				<button
					type="button"
					onClick={() => setPage((p) => p + 1)}
					disabled={page * PAGE_LIMIT >= total}
					className="text-sm font-medium text-blue-600 dark:text-blue-400 disabled:text-neutral-400 px-3 py-2"
				>
					Starsze
				</button>
				<span className="text-sm text-neutral-500">
					Strona {page} z {totalPages}
				</span>
				<button
					type="button"
					onClick={() => setPage((p) => p - 1)}
					disabled={page <= 1}
					className="text-sm font-medium text-blue-600 dark:text-blue-400 disabled:text-neutral-400 px-3 py-2"
				>
					Nowsze
				</button>
			</div>
		</div>
	);
}

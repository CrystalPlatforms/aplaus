import { useState } from "react";
import { ViewLoader } from "@/components/ViewLoader";
import { useRoute } from "@/lib/router";
import { useInboxMessages, useOutboxMessages } from "./queries";

const PAGE_LIMIT = 20;
const FOLDERS = ["inbox", "outbox"] as const;

/** Folder list: Odebrane / Wysłane with "Starsze" pagination. */
export function MessagesScreen() {
	const { navigate } = useRoute();
	const [folder, setFolder] = useState<"inbox" | "outbox">("inbox");
	const [page, setPage] = useState(1);

	// Rules of hooks: call both, pick by folder.
	const inbox = useInboxMessages(page, PAGE_LIMIT);
	const outbox = useOutboxMessages(page, PAGE_LIMIT);
	const { data, isLoading, isError } = folder === "inbox" ? inbox : outbox;

	if (isError) {
		return (
			<p className="py-16 text-center text-sm text-red-500">Nie udało się pobrać wiadomości.</p>
		);
	}
	if (isLoading) return <ViewLoader />;

	const messages = data?.messages ?? [];
	const total = data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

	return (
		<div className="flex flex-col gap-4">
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
						{f === "inbox" ? "Odebrane" : "Wysłane"}
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

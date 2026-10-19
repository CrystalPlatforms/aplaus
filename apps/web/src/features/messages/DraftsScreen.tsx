/**
 * Lista szkiców (Faza 9): otwarcie → edycja w kompozytorze, usuwanie.
 */
import { useState } from "react";
import { ButtonSpinner } from "@/components/Loader";
import { ViewLoader } from "@/components/ViewLoader";
import { useRoute } from "@/lib/router";
import { useDeleteDraft, useDrafts } from "./queries";

const PAGE_LIMIT = 20;

export function DraftsScreen() {
	const { navigate } = useRoute();
	const [page, setPage] = useState(1);
	const drafts = useDrafts(page, PAGE_LIMIT);
	const deleteDraft = useDeleteDraft();
	const [error, setError] = useState<string | null>(null);

	if (drafts.isError) {
		return <p className="py-16 text-center text-sm text-red-500">Nie udało się pobrać szkiców.</p>;
	}
	if (drafts.isLoading) return <ViewLoader />;

	const list = drafts.data?.drafts ?? [];
	const total = drafts.data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

	async function onDelete(id: string) {
		setError(null);
		try {
			await deleteDraft.mutateAsync(id);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Nie udało się usunąć szkicu.");
		}
	}

	return (
		<div className="flex flex-col gap-4">
			{error && (
				<p
					role="alert"
					className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-3 py-2 text-xs text-red-700 dark:text-red-300"
				>
					{error}
				</p>
			)}
			<section className="rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800">
				{list.length === 0 ? (
					<p className="px-4 py-6 text-sm text-neutral-500 dark:text-neutral-400">Brak szkiców.</p>
				) : (
					<ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
						{list.map((d) => (
							<li key={d.identifier} className="flex items-center gap-2 px-4 py-2.5">
								<button
									type="button"
									onClick={() => navigate(`/messages/compose/${d.identifier}`)}
									className="min-w-0 flex-1 text-left"
								>
									<span className="block text-sm font-medium truncate">
										{d.topic || "(bez tematu)"}
									</span>
									<span className="block text-xs text-neutral-500 dark:text-neutral-400">
										{d.dateAdded?.slice(0, 16).replace("T", " ") ?? ""}
									</span>
								</button>
								<button
									type="button"
									aria-label={`Usuń szkic ${d.topic || d.identifier}`}
									onClick={() => void onDelete(d.identifier)}
									disabled={deleteDraft.isPending}
									className="shrink-0 text-sm text-red-600 dark:text-red-400 px-2 py-1"
								>
									{deleteDraft.isPending && deleteDraft.variables === d.identifier ? (
										<>
											<ButtonSpinner />
											Usuwanie…
										</>
									) : (
										"Usuń"
									)}
								</button>
							</li>
						))}
					</ul>
				)}
			</section>
			<div className="flex items-center justify-between">
				<button
					type="button"
					onClick={() => setPage((p) => p + 1)}
					disabled={page * PAGE_LIMIT >= total}
					className="text-sm font-medium text-primary disabled:text-neutral-400 px-3 py-2"
				>
					Starsze
				</button>
				<span className="text-sm text-neutral-500 dark:text-neutral-400">
					Strona {page} z {totalPages}
				</span>
				<button
					type="button"
					onClick={() => setPage((p) => p - 1)}
					disabled={page <= 1}
					className="text-sm font-medium text-primary disabled:text-neutral-400 px-3 py-2"
				>
					Nowsze
				</button>
			</div>
		</div>
	);
}

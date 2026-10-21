/**
 * Lista szkiców (Faza 9): otwarcie → edycja w kompozytorze, usuwanie.
 */
import { useState } from "react";
import { ButtonSpinner } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
		return (
			<p className="py-16 text-center text-sm text-destructive">Nie udało się pobrać szkiców.</p>
		);
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
					className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
				>
					{error}
				</p>
			)}
			<Card className="gap-0 overflow-hidden py-0">
				{list.length === 0 ? (
					<p className="px-4 py-6 text-sm text-muted-foreground">Brak szkiców.</p>
				) : (
					<ul className="divide-y divide-border">
						{list.map((d) => (
							<li key={d.identifier} className="flex items-center gap-2 px-4 py-2.5">
								<button
									type="button"
									onClick={() => navigate(`/messages/compose/${d.identifier}`)}
									className="min-w-0 flex-1 text-left"
								>
									<span className="block truncate text-sm font-medium">
										{d.topic || "(bez tematu)"}
									</span>
									<span className="block text-xs text-muted-foreground">
										{d.dateAdded?.slice(0, 16).replace("T", " ") ?? ""}
									</span>
								</button>
								<Button
									variant="ghost"
									size="sm"
									aria-label={`Usuń szkic ${d.topic || d.identifier}`}
									onClick={() => void onDelete(d.identifier)}
									disabled={deleteDraft.isPending}
									className="h-7 shrink-0 text-xs text-destructive"
								>
									{deleteDraft.isPending && deleteDraft.variables === d.identifier ? (
										<>
											<ButtonSpinner />
											Usuwanie…
										</>
									) : (
										"Usuń"
									)}
								</Button>
							</li>
						))}
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

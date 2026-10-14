/**
 * Uwagi (notes): content, author and add date; missing fields show as "-".
 */
import { ViewLoader } from "@/components/ViewLoader";
import { useNotes } from "./queries";

export function NotesScreen() {
	const { data, isLoading, isError } = useNotes();

	if (isError) {
		return <p className="py-16 text-center text-sm text-red-500">Nie udało się pobrać uwag.</p>;
	}
	if (isLoading) return <ViewLoader />;

	const notes = data ?? [];
	if (notes.length === 0) {
		return <p className="py-6 text-sm text-neutral-400">Brak uwag.</p>;
	}

	return (
		<ul className="flex flex-col gap-3">
			{notes.map((note) => (
				<li
					key={note.id}
					className="rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800 p-4"
				>
					<p className="text-sm whitespace-pre-line">{note.content ?? "-"}</p>
					<p className="mt-1 text-xs text-neutral-500">
						{note.addedByName ?? "-"} · {note.addedDate?.slice(0, 10) ?? "-"}
					</p>
				</li>
			))}
		</ul>
	);
}

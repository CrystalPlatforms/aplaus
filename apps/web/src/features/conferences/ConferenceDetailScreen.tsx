/**
 * Pełny widok jednego zebrania (/more/conferences/:id) — dane z cache listy
 * zebrań, bez dodatkowego żądania.
 */
import { ViewLoader } from "@/components/ViewLoader";
import { useConferences } from "./queries";

export function ConferenceDetailScreen({ id }: { id: string }) {
	const { data, isLoading, isError } = useConferences();

	if (isError) {
		return <p className="py-16 text-center text-sm text-red-500">Nie udało się pobrać zebrań.</p>;
	}
	if (isLoading) return <ViewLoader />;

	const numericId = Number(id);
	const conference = (data ?? []).find((c) => c.id === numericId) ?? null;
	if (conference === null) {
		return (
			<p className="py-16 text-center text-sm text-neutral-500 dark:text-neutral-400">
				Nie ma takiego zebrania.
			</p>
		);
	}

	return (
		<article className="rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800 p-4 flex flex-col gap-2">
			<h2 className="text-lg font-bold">{conference.name}</h2>
			<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
				<dt className="text-neutral-500 dark:text-neutral-400">Nauczyciel</dt>
				<dd>{conference.teacherName ?? "-"}</dd>
				<dt className="text-neutral-500 dark:text-neutral-400">Termin</dt>
				<dd>
					{conference.date.slice(0, 10)}
					{conference.time ? `, ${conference.time}` : ""}
				</dd>
				<dt className="text-neutral-500 dark:text-neutral-400">Sala</dt>
				<dd>{conference.room ?? "-"}</dd>
			</dl>
			{conference.topic && (
				<div className="mt-2">
					<p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Temat</p>
					<p className="text-sm whitespace-pre-line">{conference.topic}</p>
				</div>
			)}
		</article>
	);
}

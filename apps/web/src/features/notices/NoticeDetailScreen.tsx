/**
 * Pełny widok jednego ogłoszenia (/more/notices/notice/:id). Dane bierze z
 * cache listy ogłoszeń (ten sam query key), więc bez dodatkowego żądania.
 */
import { ViewLoader } from "@/components/ViewLoader";
import { useNotices } from "./queries";

export function NoticeDetailScreen({ id }: { id: string }) {
	const { data, isLoading, isError } = useNotices();

	if (isError) {
		return <p className="py-16 text-center text-sm text-red-500">Nie udało się pobrać ogłoszeń.</p>;
	}
	if (isLoading) return <ViewLoader />;

	const notice = (data ?? []).find((n) => n.id === id) ?? null;
	if (notice === null) {
		return (
			<p className="py-16 text-center text-sm text-neutral-500 dark:text-neutral-400">
				Nie ma takiego ogłoszenia.
			</p>
		);
	}

	return (
		<article className="rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800 p-4 flex flex-col gap-2">
			<h2 className="text-lg font-bold">{notice.subject}</h2>
			<p className="text-xs text-neutral-500 dark:text-neutral-400">
				od {notice.startDate} do {notice.endDate} · dodał: {notice.addedByName ?? "-"}
			</p>
			<div className="mt-2 text-sm whitespace-pre-line">{notice.content}</div>
		</article>
	);
}

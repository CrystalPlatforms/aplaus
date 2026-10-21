/**
 * Pełny widok jednego ogłoszenia (/more/notices/notice/:id). Dane bierze z
 * cache listy ogłoszeń (ten sam query key), więc bez dodatkowego żądania.
 */

import { Card } from "@/components/ui/card";
import { ViewLoader } from "@/components/ViewLoader";
import { useNotices } from "./queries";

export function NoticeDetailScreen({ id }: { id: string }) {
	const { data, isLoading, isError } = useNotices();

	if (isError) {
		return (
			<p className="py-16 text-center text-sm text-destructive">Nie udało się pobrać ogłoszeń.</p>
		);
	}
	if (isLoading) return <ViewLoader />;

	const notice = (data ?? []).find((n) => n.id === id) ?? null;
	if (notice === null) {
		return (
			<p className="py-16 text-center text-sm text-muted-foreground">Nie ma takiego ogłoszenia.</p>
		);
	}

	return (
		<Card className="gap-2 p-4">
			<h2 className="text-lg font-bold">{notice.subject}</h2>
			<p className="text-xs text-muted-foreground">
				od {notice.startDate} do {notice.endDate} · dodał: {notice.addedByName ?? "-"}
			</p>
			<div className="mt-2 text-sm whitespace-pre-line">{notice.content}</div>
		</Card>
	);
}

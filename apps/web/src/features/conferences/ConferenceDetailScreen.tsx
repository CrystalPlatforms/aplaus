/**
 * Pełny widok jednego zebrania (/more/conferences/:id) — dane z cache listy
 * zebrań, bez dodatkowego żądania.
 */

import { Card } from "@/components/ui/card";
import { ViewLoader } from "@/components/ViewLoader";
import { useConferences } from "./queries";

export function ConferenceDetailScreen({ id }: { id: string }) {
	const { data, isLoading, isError } = useConferences();

	if (isError) {
		return (
			<p className="py-16 text-center text-sm text-destructive">Nie udało się pobrać zebrań.</p>
		);
	}
	if (isLoading) return <ViewLoader />;

	const numericId = Number(id);
	const conference = (data ?? []).find((c) => c.id === numericId) ?? null;
	if (conference === null) {
		return (
			<p className="py-16 text-center text-sm text-muted-foreground">Nie ma takiego zebrania.</p>
		);
	}

	return (
		<Card className="gap-2 p-4">
			<h2 className="text-lg font-bold">{conference.name}</h2>
			<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
				<dt className="text-muted-foreground">Nauczyciel</dt>
				<dd>{conference.teacherName ?? "-"}</dd>
				<dt className="text-muted-foreground">Termin</dt>
				<dd>
					{conference.date.slice(0, 10)}
					{conference.time ? `, ${conference.time}` : ""}
				</dd>
				<dt className="text-muted-foreground">Sala</dt>
				<dd>{conference.room ?? "-"}</dd>
			</dl>
			{conference.topic && (
				<div className="mt-2">
					<p className="mb-1 text-xs font-semibold text-muted-foreground">Temat</p>
					<p className="text-sm whitespace-pre-line">{conference.topic}</p>
				</div>
			)}
		</Card>
	);
}

/**
 * Zebrania z rodzicami: wiersz skrót + pełny widok pod /more/conferences/:id.
 */

import { ViewLoader } from "@/components/ViewLoader";
import { useRoute } from "@/lib/router";
import { useConferences } from "./queries";

export function ConferencesScreen() {
	const { data, isLoading, isError } = useConferences();
	const { navigate } = useRoute();

	if (isError) {
		return (
			<p className="py-16 text-center text-sm text-destructive">Nie udało się pobrać zebrań.</p>
		);
	}
	if (isLoading) return <ViewLoader />;

	const conferences = data ?? [];
	if (conferences.length === 0) {
		return <p className="py-6 text-sm text-muted-foreground">Brak zebrań.</p>;
	}

	return (
		<div className="flex flex-col gap-3">
			{conferences.map((conference) => (
				<button
					key={conference.id}
					type="button"
					onClick={() => navigate(`/more/conferences/${conference.id}`)}
					className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm"
				>
					<p className="text-sm font-medium">{conference.name}</p>
					<p className="text-xs text-muted-foreground">
						{[
							conference.teacherName ?? "-",
							conference.date.slice(0, 10),
							conference.time ?? "",
							conference.room ?? "",
						]
							.filter((part) => part !== "")
							.join(" · ")}
					</p>
					{conference.topic && (
						<p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{conference.topic}</p>
					)}
				</button>
			))}
		</div>
	);
}

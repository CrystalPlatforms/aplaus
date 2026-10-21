/**
 * Usprawiedliwienia — tylko dla rodzica. Query jest gated przez `enabled`,
 * więc konto ucznia nigdy nie wysyła żądania (serwer odpowiedziałby 403).
 */
import type { Justification } from "@repo/librus-client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ViewLoader } from "@/components/ViewLoader";
import { useAuth } from "@/lib/auth";
import { useJustifications } from "./queries";

export function JustificationsScreen() {
	const { account } = useAuth();
	const isParent = account?.groupId === 5;
	const { data, isLoading, isError } = useJustifications(isParent);

	if (!isParent) return null;
	if (isError) {
		return (
			<p className="py-16 text-center text-sm text-destructive">
				Nie udało się pobrać usprawiedliwień.
			</p>
		);
	}
	if (isLoading) return <ViewLoader />;

	const justifications = data ?? [];
	if (justifications.length === 0) {
		return <p className="py-6 text-sm text-muted-foreground">Brak usprawiedliwień.</p>;
	}

	return (
		<ul className="flex flex-col gap-3">
			{justifications.map((justification) => (
				<JustificationItem key={justification.id} justification={justification} />
			))}
		</ul>
	);
}

function JustificationItem({ justification }: { justification: Justification }) {
	return (
		<li>
			<Card className="gap-0 p-4">
				<div className="flex items-center justify-between gap-2">
					<Badge variant="secondary">{justification.justificationStatus ?? "-"}</Badge>
					<span className="text-xs text-muted-foreground">
						{justification.postDate?.slice(0, 10) ?? "-"}
					</span>
				</div>
				{justification.messageFromParent && (
					<p className="mt-2 text-sm whitespace-pre-line">{justification.messageFromParent}</p>
				)}
				<p className="mt-1 text-xs text-muted-foreground">
					od {justification.dateFrom ?? "-"} do {justification.dateTo ?? "-"}
				</p>
				{justification.lessons.length > 0 && (
					<p className="mt-1 text-xs text-muted-foreground">
						{justification.lessons
							.map((lesson) => `lekcja ${lesson.number ?? "?"} (${lesson.date ?? "?"})`)
							.join(", ")}
					</p>
				)}
				{justification.notifiedTeachers.length > 0 && (
					<p className="mt-1 text-xs text-muted-foreground">
						Powiadomieni nauczyciele: {justification.notifiedTeachers.join(", ")}
					</p>
				)}
				{justification.justifiedAbsences !== null && (
					<p className="mt-1 text-xs text-muted-foreground">
						Usprawiedliwione nieobecności: {justification.justifiedAbsences}
					</p>
				)}
				{justification.hasAttachment && (
					<p className="mt-1 text-xs text-muted-foreground">Załącznik</p>
				)}
			</Card>
		</li>
	);
}

/**
 * Usprawiedliwienia — tylko dla rodzica. Query jest gated przez `enabled`,
 * więc konto ucznia nigdy nie wysyła żądania (serwer odpowiedziałby 403).
 */
import type { Justification } from "@repo/librus-client";
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
			<p className="py-16 text-center text-sm text-red-500">
				Nie udało się pobrać usprawiedliwień.
			</p>
		);
	}
	if (isLoading) return <ViewLoader />;

	const justifications = data ?? [];
	if (justifications.length === 0) {
		return (
			<p className="py-6 text-sm text-neutral-500 dark:text-neutral-400">Brak usprawiedliwień.</p>
		);
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
		<li className="rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800 p-4">
			<div className="flex items-center justify-between gap-2">
				<span className="text-xs rounded-full px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
					{justification.justificationStatus ?? "-"}
				</span>
				<span className="text-xs text-neutral-500 dark:text-neutral-400">
					{justification.postDate?.slice(0, 10) ?? "-"}
				</span>
			</div>
			{justification.messageFromParent && (
				<p className="mt-2 text-sm whitespace-pre-line">{justification.messageFromParent}</p>
			)}
			<p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
				od {justification.dateFrom ?? "-"} do {justification.dateTo ?? "-"}
			</p>
			{justification.lessons.length > 0 && (
				<p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
					{justification.lessons
						.map((lesson) => `lekcja ${lesson.number ?? "?"} (${lesson.date ?? "?"})`)
						.join(", ")}
				</p>
			)}
			{justification.notifiedTeachers.length > 0 && (
				<p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
					Powiadomieni nauczyciele: {justification.notifiedTeachers.join(", ")}
				</p>
			)}
			{justification.justifiedAbsences !== null && (
				<p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
					Usprawiedliwione nieobecności: {justification.justifiedAbsences}
				</p>
			)}
			{justification.hasAttachment && (
				<p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Załącznik</p>
			)}
		</li>
	);
}

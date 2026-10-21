import type { HomeWork, HomeWorkAssignment } from "@repo/librus-client";
import { useMemo, useState } from "react";
import { DetailOverlay } from "@/components/DetailOverlay";
import { Card } from "@/components/ui/card";
import { ViewLoader } from "@/components/ViewLoader";
import { useHomework } from "./queries";

/**
 * Homework lists: schedule entries and assignments show a short preview;
 * tapping an entry opens the full content in the detail overlay.
 */
export function HomeworkScreen() {
	const { data, isLoading, isError } = useHomework();
	const [detail, setDetail] = useState<Detail | null>(null);

	const homeWorks = useMemo(
		() => [...(data?.homeWorks ?? [])].sort((a, b) => a.date.localeCompare(b.date)),
		[data],
	);
	const assignments = useMemo(
		() => [...(data?.assignments ?? [])].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
		[data],
	);

	if (isError) {
		return (
			<p className="py-16 text-center text-sm text-destructive">Nie udało się pobrać zadań.</p>
		);
	}
	if (isLoading) return <ViewLoader />;

	return (
		<div className="flex flex-col gap-4">
			<Card data-testid="homework-schedule" className="gap-0 overflow-hidden py-0">
				<h2 className="px-4 pt-3 pb-1 text-sm font-semibold">Zadania w terminarzu</h2>
				{!isLoading && homeWorks.length === 0 && (
					<p className="px-4 py-6 text-sm text-muted-foreground">Brak zadań.</p>
				)}
				<ul className="divide-y divide-border">
					{homeWorks.map((w) => (
						<li key={w.id}>
							<button
								type="button"
								onClick={() => setDetail({ kind: "homework", homework: w })}
								className="w-full px-4 py-2.5 text-left"
							>
								<p className="text-sm font-medium">{w.subjectName ?? "Inne"}</p>
								<p className="text-xs text-muted-foreground">
									{w.date.slice(0, 10)} {w.createdByName ? `· ${w.createdByName}` : ""}
								</p>
								{w.content && (
									<p className="mt-1 line-clamp-2 text-sm text-foreground">{w.content}</p>
								)}
							</button>
						</li>
					))}
				</ul>
			</Card>
			<Card data-testid="homework-assignments" className="gap-0 overflow-hidden py-0">
				<h2 className="px-4 pt-3 pb-1 text-sm font-semibold">Prace domowe</h2>
				{!isLoading && assignments.length === 0 && (
					<p className="px-4 py-6 text-sm text-muted-foreground">Brak prac domowych.</p>
				)}
				<ul className="divide-y divide-border">
					{assignments.map((a) => (
						<li key={a.id}>
							<button
								type="button"
								onClick={() => setDetail({ kind: "assignment", assignment: a })}
								className="w-full px-4 py-2.5 text-left"
							>
								<p className="text-sm font-medium">{a.topic || "Praca domowa"}</p>
								<p className="text-xs text-muted-foreground">
									{a.dueDate.slice(0, 10)} {a.teacherName ? `· ${a.teacherName}` : ""}
								</p>
								{a.text && <p className="mt-1 line-clamp-2 text-sm text-foreground">{a.text}</p>}
							</button>
						</li>
					))}
				</ul>
			</Card>
			{detail && <HomeworkSheet detail={detail} onClose={() => setDetail(null)} />}
		</div>
	);
}

type Detail =
	| { kind: "homework"; homework: HomeWork }
	| { kind: "assignment"; assignment: HomeWorkAssignment };

function HomeworkSheet({ detail, onClose }: { detail: Detail; onClose: () => void }) {
	const isHomework = detail.kind === "homework";
	const homework = isHomework ? detail.homework : null;
	const assignment = !isHomework ? detail.assignment : null;
	const title = homework
		? (homework.subjectName ?? "Zadanie domowe")
		: assignment?.topic || "Praca domowa";
	return (
		<DetailOverlay open onOpenChange={(o) => !o && onClose()} title={title}>
			<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
				<dt className="text-muted-foreground">{homework ? "Na lekcji" : "Termin"}</dt>
				<dd>{(homework ? homework.date : assignment?.dueDate)?.slice(0, 10) || "—"}</dd>
				<dt className="text-muted-foreground">Nauczyciel</dt>
				<dd>{(homework?.createdByName ?? assignment?.teacherName) || "—"}</dd>
				{homework?.categoryName && (
					<>
						<dt className="text-muted-foreground">Kategoria</dt>
						<dd>{homework.categoryName}</dd>
					</>
				)}
			</dl>
			{(homework?.content || assignment?.text) && (
				<div className="mt-4">
					<p className="mb-1 text-xs text-muted-foreground">Treść</p>
					<p className="text-sm whitespace-pre-line">{homework?.content ?? assignment?.text}</p>
				</div>
			)}
			{assignment?.mustSendAttachFile && (
				<p className="mt-4 text-xs text-muted-foreground">
					Praca wymaga załączenia pliku (oddawanie prac nie jest dostępne w aplikacji).
				</p>
			)}
		</DetailOverlay>
	);
}

import type { ClassFreeDay } from "@repo/librus-client";
import { useMemo, useState } from "react";
import { DetailOverlay } from "@/components/DetailOverlay";
import { Loader } from "@/components/Loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type GradesView, useGrades } from "@/features/grades/queries";
import { type ExamKind, examKindOf, monthGrid, WEEKDAYS_SHORT } from "./vm";

/** One exam event in a month cell: kartkówka (green) or sprawdzian (red). */
interface ExamEvent {
	kind: ExamKind;
	subjectName: string | null;
	subjectId: number | null;
	/** Exam date, the awarded grade and the grading teacher (grades API). */
	date: string;
	grade: string;
	teacher: string | null;
	/** The grade's id — comments link to it. */
	gradeId: number;
}

/** Grade events of the two exam categories, keyed by date. */
function examEventsOf(data: GradesView | undefined): Map<string, ExamEvent[]> {
	const categoryNames = new Map((data?.categories ?? []).map((c) => [c.id, c.name]));
	const map = new Map<string, ExamEvent[]>();
	for (const grade of data?.grades ?? []) {
		const kind = examKindOf(categoryNames.get(grade.categoryId ?? -1) ?? null);
		if (kind === null) continue;
		const date = grade.dateOccurred.slice(0, 10);
		const list = map.get(date) ?? [];
		list.push({
			kind,
			subjectName: grade.subjectName,
			subjectId: grade.subjectId,
			date,
			grade: grade.grade,
			teacher: grade.addedByName,
			gradeId: grade.id,
		});
		map.set(date, list);
	}
	return map;
}

/**
 * Month view (desktop, the Synergia-style one): a Monday-Friday grid of day
 * rectangles. Cells hold the month's kartkówki (green) and sprawdziany
 * (red) — from the grades cache, not the timetable — plus free days.
 */
export function MonthView({
	month,
	freeDays,
	onOpenSubject,
}: {
	month: string;
	freeDays: ClassFreeDay[];
	onOpenSubject: (subjectId: number) => void;
}) {
	const { data, isLoading, isError } = useGrades();
	const [exam, setExam] = useState<ExamEvent | null>(null);
	const events = useMemo(() => examEventsOf(data), [data]);
	const grid = monthGrid(month);
	const freeDayNames = new Map(freeDays.map((d) => [d.date, d.name ?? "Dzień wolny"]));
	const today = new Date().toISOString().slice(0, 10);

	if (isLoading) {
		return (
			<div className="flex justify-center py-12" aria-busy="true">
				<Loader />
			</div>
		);
	}

	if (isError) {
		return (
			<p className="py-16 text-center text-sm text-destructive">Nie udało się pobrać planu.</p>
		);
	}

	return (
		<>
			<div
				data-testid="timetable-month"
				className="overflow-hidden rounded-xl border border-border bg-card"
			>
				<div className="grid grid-cols-5 border-b border-border bg-muted/50 text-center text-xs font-semibold text-muted-foreground">
					{WEEKDAYS_SHORT.slice(0, 5).map((d) => (
						<div key={d} className="py-2">
							{d}
						</div>
					))}
				</div>
				<div className="grid grid-cols-5 gap-px bg-border">
					{grid.map((cell) => (
						<MonthCell
							key={cell.date}
							date={cell.date}
							inMonth={cell.inMonth}
							isToday={cell.date === today}
							freeDay={freeDayNames.get(cell.date) ?? null}
							exams={events.get(cell.date) ?? []}
							onExam={setExam}
						/>
					))}
				</div>
			</div>

			{exam && (
				<ExamSheet
					exam={exam}
					comments={(data?.comments ?? []).filter((c) => c.gradeId === exam.gradeId)}
					onClose={() => setExam(null)}
					onOpenSubject={onOpenSubject}
				/>
			)}
		</>
	);
}

/** Detail overlay of one exam: subject, category, date, teacher, grade. */
function ExamSheet({
	exam,
	comments,
	onClose,
	onOpenSubject,
}: {
	exam: ExamEvent;
	comments: { id: number; text: string | null }[];
	onClose: () => void;
	onOpenSubject: (subjectId: number) => void;
}) {
	const kindLabel = exam.kind === "test" ? "Sprawdzian" : "Kartkówka";
	return (
		<DetailOverlay
			open
			onOpenChange={(o) => !o && onClose()}
			title={exam.subjectName ?? "Lekcja"}
			action={
				exam.subjectId !== null ? (
					<Button
						variant="link"
						size="sm"
						className="h-auto p-0 text-sm"
						onClick={() => onOpenSubject(exam.subjectId ?? 0)}
					>
						Oceny
					</Button>
				) : undefined
			}
		>
			<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
				<dt className="text-muted-foreground">Kategoria</dt>
				<dd>
					<Badge variant="secondary">{kindLabel}</Badge>
				</dd>
				<dt className="text-muted-foreground">Przedmiot</dt>
				<dd>{exam.subjectName ?? "—"}</dd>
				<dt className="text-muted-foreground">Data</dt>
				<dd>{exam.date}</dd>
				<dt className="text-muted-foreground">Nauczyciel</dt>
				<dd>{exam.teacher ?? "—"}</dd>
				<dt className="text-muted-foreground">Ocena</dt>
				<dd className="font-semibold">{exam.grade === "" ? "—" : exam.grade}</dd>
			</dl>
			{comments.length > 0 && (
				<div className="mt-4">
					<p className="mb-1 text-xs text-muted-foreground">Komentarze</p>
					{comments.map((comment) => (
						<p key={comment.id} className="py-1 text-sm">
							{comment.text ?? "—"}
						</p>
					))}
				</div>
			)}
		</DetailOverlay>
	);
}

function MonthCell({
	date,
	inMonth,
	isToday,
	freeDay,
	exams,
	onExam,
}: {
	date: string;
	inMonth: boolean;
	isToday: boolean;
	freeDay: string | null;
	exams: ExamEvent[];
	onExam: (exam: ExamEvent) => void;
}) {
	return (
		<div
			data-date={date}
			className={`min-h-24 bg-card p-1.5 md:min-h-28 ${inMonth ? "" : "bg-muted/40 opacity-60"} ${
				isToday ? "ring-2 ring-primary ring-inset" : ""
			}`}
		>
			<p className={`mb-1 text-xs font-semibold ${isToday ? "text-primary" : ""}`}>
				{Number(date.slice(8, 10))}
			</p>
			{freeDay && (
				<p className="mb-1 text-[0.625rem] leading-tight text-muted-foreground">{freeDay}</p>
			)}
			<ul className="flex flex-col gap-1">
				{exams.map((exam, i) => (
					<li key={`${exam.subjectId ?? "x"}-${i}`}>
						<button
							type="button"
							title={`${exam.kind === "test" ? "Sprawdzian" : "Kartkówka"} · ${exam.subjectName ?? "Lekcja"}`}
							aria-label={`${exam.kind === "test" ? "Sprawdzian" : "Kartkówka"}: ${exam.subjectName ?? "Lekcja"}`}
							onClick={() => onExam(exam)}
							className={`w-full truncate rounded px-1 py-0.5 text-left text-[0.625rem] leading-tight ${
								exam.kind === "test"
									? "bg-destructive/15 text-destructive"
									: "bg-primary/15 text-primary"
							}`}
						>
							{exam.kind === "test" ? "Sprawdzian" : "Kartkówka"} · {exam.subjectName ?? "Lekcja"}
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}

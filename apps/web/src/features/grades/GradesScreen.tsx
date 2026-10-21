import type { Grade } from "@repo/librus-client";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { ViewLoader } from "@/components/ViewLoader";
import { GradeDetailSheet } from "./GradeDetailSheet";
import { useGrades } from "./queries";
import { computeOverallStats, computeSemesterStats } from "./stats";

type Detail = Grade;

export function GradesScreen() {
	const { data, isLoading, isError } = useGrades();
	const [semester, setSemester] = useState<number | null>(null);
	const [detail, setDetail] = useState<Detail | null>(null);
	const _junk = null;

	const grades = data?.grades ?? [];
	const semesters = [...new Set(grades.map((g) => g.semester))].sort();
	const activeSemester = semester ?? semesters[0] ?? null;
	const visible = grades.filter((g) => g.semester === activeSemester);
	const overall = useMemo(() => computeOverallStats(grades), [grades]);
	const perSemester = useMemo(() => computeSemesterStats(grades), [grades]);

	const grouped = useMemo(() => {
		const map = new Map<string, Grade[]>();
		for (const grade of visible) {
			const key = grade.subjectName ?? "Inne";
			const list = map.get(key) ?? [];
			list.push(grade);
			map.set(key, list);
		}
		return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "pl"));
	}, [visible]);

	const commentsOf = (gradeId: number) =>
		(data?.comments ?? []).filter((c) => c.gradeId === gradeId);
	const categoryOf = (id: number | null) => (data?.categories ?? []).find((c) => c.id === id);

	if (isLoading) return <ViewLoader />;
	if (isError)
		return <p className="py-16 text-center text-sm text-destructive">Nie udało się pobrać ocen.</p>;

	return (
		<div className="flex flex-col gap-4">
			{semesters.length > 1 && (
				<div className="flex rounded-lg bg-muted p-1">
					{semesters.map((s) => (
						<button
							key={s}
							type="button"
							onClick={() => setSemester(s)}
							className={`flex-1 rounded-md py-2 text-sm font-medium ${
								activeSemester === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
							}`}
						>
							Semestr {s}
						</button>
					))}
				</div>
			)}
			<StatsCard
				overall={overall}
				semester={activeSemester ? perSemester[String(activeSemester)] : undefined}
			/>
			{grouped.length === 0 && (
				<p className="py-12 text-center text-sm text-muted-foreground">
					Brak ocen w tym semestrze.
				</p>
			)}
			{grouped.map(([subject, list]) => (
				<Card key={subject} className="gap-0 overflow-hidden py-0">
					<h2 className="px-4 pt-3 pb-1 text-sm font-semibold">{subject}</h2>
					<ul className="divide-y divide-border">
						{list.map((grade) => (
							<li key={grade.id}>
								<button
									type="button"
									className="flex w-full items-center justify-between px-4 py-2.5 text-left"
									onClick={() => setDetail(grade)}
								>
									<span className="min-w-0">
										<span className="block text-sm font-medium">
											{categoryOf(grade.categoryId)?.name ?? "Ocena"}
										</span>
										<span className="block text-xs text-muted-foreground">
											{grade.dateOccurred} {grade.addedByName ? `· ${grade.addedByName}` : ""}
										</span>
									</span>
									<span className="ml-3 flex size-10 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
										{grade.grade}
									</span>
								</button>
							</li>
						))}
					</ul>
				</Card>
			))}
			{detail && (
				<GradeDetailSheet
					grade={detail}
					category={categoryOf(detail.categoryId)}
					comments={commentsOf(detail.id)}
					onClose={() => setDetail(null)}
				/>
			)}
		</div>
	);
}

function StatsCard({
	overall,
	semester,
}: {
	overall: { average: number | null; count: number };
	semester?: { average: number | null; count: number };
}) {
	return (
		<Card className="flex-row gap-6 p-4">
			<div>
				<p className="text-xs text-muted-foreground">Średnia ogólna</p>
				<p className="text-2xl font-bold">
					{overall.average === null ? "-" : overall.average.toFixed(2)}
				</p>
			</div>
			<div>
				<p className="text-xs text-muted-foreground">W tym semestrze</p>
				<p className="text-2xl font-bold">
					{semester?.average == null ? "-" : semester.average.toFixed(2)}
				</p>
			</div>
			<div>
				<p className="text-xs text-muted-foreground">Ocen liczących się</p>
				<p className="text-2xl font-bold">{overall.count}</p>
			</div>
		</Card>
	);
}

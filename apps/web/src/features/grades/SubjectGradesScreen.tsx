import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { ViewLoader } from "@/components/ViewLoader";
import { GradeDetailSheet } from "./GradeDetailSheet";
import { useGrades } from "./queries";
import { computeOverallStats, computeSemesterStats } from "./stats";

/**
 * One subject's grades as a full page (reached from the lesson detail or a
 * grade drawer): header stats + list; tapping a grade opens the detail sheet.
 */
export function SubjectGradesScreen({ subjectId }: { subjectId: string }) {
	const { data, isLoading, isError } = useGrades();
	const [detail, setDetail] = useState<GradeDetail | null>(null);
	const grades = useMemo(
		() => (data?.grades ?? []).filter((g) => String(g.subjectId) === subjectId),
		[data, subjectId],
	);
	const overall = useMemo(() => computeOverallStats(grades), [grades]);
	const perSemester = useMemo(() => computeSemesterStats(grades), [grades]);

	if (isLoading) return <ViewLoader />;
	if (isError) {
		return <p className="py-16 text-center text-sm text-destructive">Nie udało się pobrać ocen.</p>;
	}

	const semesters = [...new Set(grades.map((g) => g.semester))].sort();
	const subjectName =
		grades[0]?.subjectName ??
		(data?.subjects ?? []).find((s) => String(s.id) === subjectId)?.name ??
		"—";
	const categories = data?.categories ?? [];
	const categoryOf = (id: number | null) => categories.find((c) => c.id === id);

	return (
		<div className="flex flex-col gap-4">
			<Card className="gap-0 p-4">
				<h1 className="text-lg font-bold">{subjectName}</h1>
				<div className="mt-3 flex gap-6">
					<div>
						<p className="text-xs text-muted-foreground">Średnia ogólna</p>
						<p className="text-2xl font-bold">
							{overall.average === null ? "-" : overall.average.toFixed(2)}
						</p>
					</div>
					{semesters.map((s) => (
						<div key={s}>
							<p className="text-xs text-muted-foreground">Semestr {s}</p>
							<p className="text-2xl font-bold">
								{perSemester[String(s)]?.average == null
									? "-"
									: (perSemester[String(s)]?.average ?? 0).toFixed(2)}
							</p>
						</div>
					))}
				</div>
			</Card>

			{grades.length === 0 && (
				<p className="py-12 text-center text-sm text-muted-foreground">
					Brak ocen z tego przedmiotu.
				</p>
			)}
			{grades.length > 0 && (
				<Card className="gap-0 overflow-hidden py-0">
					<ul className="divide-y divide-border">
						{grades.map((g) => (
							<li key={g.id}>
								<button
									type="button"
									onClick={() => setDetail(g)}
									className="flex w-full items-center justify-between px-4 py-2.5 text-left"
								>
									<span className="min-w-0">
										<span className="block text-sm font-medium">
											{categoryOf(g.categoryId)?.name ?? "Ocena"}
										</span>
										<span className="block text-xs text-muted-foreground">
											{g.dateOccurred} {g.addedByName ? `· ${g.addedByName}` : ""}
										</span>
									</span>
									<span className="ml-3 flex size-10 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
										{g.grade}
									</span>
								</button>
							</li>
						))}
					</ul>
				</Card>
			)}
			{detail && (
				<GradeDetailSheet
					grade={detail}
					category={categoryOf(detail.categoryId)}
					comments={(data?.comments ?? []).filter((c) => c.gradeId === detail.id)}
					onClose={() => setDetail(null)}
				/>
			)}
		</div>
	);
}

type GradeDetail = Parameters<typeof GradeDetailSheet>[0]["grade"];

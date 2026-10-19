import { useMemo, useState } from "react";
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
		return <p className="py-16 text-center text-sm text-red-500">Nie udało się pobrać ocen.</p>;
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
			<div className="rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800 p-4">
				<h1 className="text-lg font-bold">{subjectName}</h1>
				<div className="mt-3 flex gap-6">
					<div>
						<p className="text-xs text-neutral-500 dark:text-neutral-400">Średnia ogólna</p>
						<p className="text-2xl font-bold">
							{overall.average === null ? "-" : overall.average.toFixed(2)}
						</p>
					</div>
					{semesters.map((s) => (
						<div key={s}>
							<p className="text-xs text-neutral-500 dark:text-neutral-400">Semestr {s}</p>
							<p className="text-2xl font-bold">
								{perSemester[String(s)]?.average == null
									? "-"
									: (perSemester[String(s)]?.average ?? 0).toFixed(2)}
							</p>
						</div>
					))}
				</div>
			</div>

			{grades.length === 0 && (
				<p className="py-12 text-center text-sm text-neutral-500 dark:text-neutral-400">
					Brak ocen z tego przedmiotu.
				</p>
			)}
			{grades.length > 0 && (
				<section className="rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800">
					<ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
						{grades.map((g) => (
							<li key={g.id}>
								<button
									type="button"
									onClick={() => setDetail(g)}
									className="w-full px-4 py-2.5 flex items-center justify-between text-left"
								>
									<span className="min-w-0">
										<span className="block text-sm font-medium">
											{categoryOf(g.categoryId)?.name ?? "Ocena"}
										</span>
										<span className="block text-xs text-neutral-500 dark:text-neutral-400">
											{g.dateOccurred} {g.addedByName ? `· ${g.addedByName}` : ""}
										</span>
									</span>
									<span className="ml-3 shrink-0 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-semibold">
										{g.grade}
									</span>
								</button>
							</li>
						))}
					</ul>
				</section>
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

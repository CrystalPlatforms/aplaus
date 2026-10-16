import type { Grade } from "@repo/librus-client";
import { useMemo, useState } from "react";
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
		return <p className="py-16 text-center text-sm text-red-500">Nie udało się pobrać ocen.</p>;

	return (
		<div className="flex flex-col gap-4">
			{semesters.length > 1 && (
				<div className="flex rounded-xl bg-neutral-200/70 dark:bg-neutral-900 p-1">
					{semesters.map((s) => (
						<button
							key={s}
							type="button"
							onClick={() => setSemester(s)}
							className={`flex-1 py-2 text-sm font-medium rounded-lg ${activeSemester === s ? "bg-white dark:bg-neutral-800 shadow" : "text-neutral-500 dark:text-neutral-400"}`}
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
				<p className="py-12 text-center text-sm text-neutral-500 dark:text-neutral-400">
					Brak ocen w tym semestrze.
				</p>
			)}
			{grouped.map(([subject, list]) => (
				<section
					key={subject}
					className="rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800"
				>
					<h2 className="px-4 pt-3 pb-1 text-sm font-semibold">{subject}</h2>
					<ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
						{list.map((grade) => (
							<li key={grade.id}>
								<button
									type="button"
									className="w-full px-4 py-2.5 flex items-center justify-between text-left"
									onClick={() => setDetail(grade)}
								>
									<span className="min-w-0">
										<span className="block text-sm font-medium">
											{categoryOf(grade.categoryId)?.name ?? "Ocena"}
										</span>
										<span className="block text-xs text-neutral-500 dark:text-neutral-400">
											{grade.dateOccurred} {grade.addedByName ? `· ${grade.addedByName}` : ""}
										</span>
									</span>
									<span className="ml-3 shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
										{grade.grade}
									</span>
								</button>
							</li>
						))}
					</ul>
				</section>
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
		<div className="rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800 p-4 flex gap-6">
			<div>
				<p className="text-xs text-neutral-500 dark:text-neutral-400">Średnia ogólna</p>
				<p className="text-2xl font-bold">
					{overall.average === null ? "-" : overall.average.toFixed(2)}
				</p>
			</div>
			<div>
				<p className="text-xs text-neutral-500 dark:text-neutral-400">W tym semestrze</p>
				<p className="text-2xl font-bold">
					{semester?.average == null ? "-" : semester.average.toFixed(2)}
				</p>
			</div>
			<div>
				<p className="text-xs text-neutral-500 dark:text-neutral-400">Ocen liczących się</p>
				<p className="text-2xl font-bold">{overall.count}</p>
			</div>
		</div>
	);
}

import type { Grade } from "@repo/librus-client";
import { useMemo, useState } from "react";
import { useGrades } from "./queries";
import { computeOverallStats, computeSemesterStats } from "./stats";

type Detail = { grade: Grade; subject: string; teacher: string };

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

	if (isLoading)
		return <p className="py-16 text-center text-sm text-neutral-400">Ładowanie ocen...</p>;
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
							className={`flex-1 py-2 text-sm font-medium rounded-lg ${activeSemester === s ? "bg-white dark:bg-neutral-800 shadow" : "text-neutral-500"}`}
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
				<p className="py-12 text-center text-sm text-neutral-400">Brak ocen w tym semestrze.</p>
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
									onClick={() => setDetail({ grade, subject, teacher: grade.addedByName ?? "" })}
								>
									<span className="min-w-0">
										<span className="block text-sm font-medium">
											{categoryOf(grade.categoryId)?.name ?? "Ocena"}
										</span>
										<span className="block text-xs text-neutral-500">
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
					detail={detail}
					category={categoryOf(detail.grade.categoryId)}
					comments={commentsOf(detail.grade.id)}
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
				<p className="text-xs text-neutral-500">Średnia ogólna</p>
				<p className="text-2xl font-bold">
					{overall.average === null ? "-" : overall.average.toFixed(2)}
				</p>
			</div>
			<div>
				<p className="text-xs text-neutral-500">W tym semestrze</p>
				<p className="text-2xl font-bold">
					{semester?.average == null ? "-" : semester.average.toFixed(2)}
				</p>
			</div>
			<div>
				<p className="text-xs text-neutral-500">Ocen liczących się</p>
				<p className="text-2xl font-bold">{overall.count}</p>
			</div>
		</div>
	);
}

function GradeDetailSheet({
	detail,
	category,
	comments,
	onClose,
}: {
	detail: { grade: Grade; subject: string; teacher: string };
	category?: {
		id: number;
		name: string;
		short: string | null;
		standard: boolean;
		colorId: number | null;
		isSemestral: boolean;
		isFinal: boolean;
		isSemestralProposition: boolean;
		isFinalProposition: boolean;
		blockAnyGrades: boolean;
	};
	comments: { id: number; gradeId: number | null; addedById: number | null; text: string | null }[];
	onClose: () => void;
}) {
	const g = detail.grade;
	return (
		<button
			type="button"
			aria-label="Zamknij szczegóły oceny"
			className="fixed inset-0 z-20 flex items-end justify-center bg-black/30 cursor-default"
			onClick={onClose}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={`Szczegóły oceny: ${detail.subject}`}
				className="w-full max-w-xl rounded-t-3xl bg-white dark:bg-neutral-900 p-6 pb-10 max-h-[80dvh] overflow-y-auto"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-lg font-bold">{detail.subject}</h3>
					<button
						type="button"
						onClick={onClose}
						className="text-sm text-blue-600 dark:text-blue-400"
					>
						Zamknij
					</button>
				</div>
				<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
					<dt className="text-neutral-500">Ocena</dt>
					<dd className="font-semibold">{g.grade}</dd>
					<dt className="text-neutral-500">Kategoria</dt>
					<dd>{category?.name ?? "—"}</dd>
					<dt className="text-neutral-500">Nauczyciel</dt>
					<dd>{detail.teacher || "—"}</dd>
					<dt className="text-neutral-500">Data</dt>
					<dd>{g.dateOccurred || "—"}</dd>
					<dt className="text-neutral-500">Dodano</dt>
					<dd>{g.dateAdded || "—"}</dd>
				</dl>
				<div className="mt-4 flex flex-wrap gap-2">
					{g.isConstituent && <Flag label="Liczy się do średniej" />}
					{g.isSemester && <Flag label="Semestralna" />}
					{g.isFinal && <Flag label="Końcowa" />}
					{g.isSemesterProposition && <Flag label="Propozycja semestralna" />}
					{g.isFinalProposition && <Flag label="Propozycja końcowa" />}
				</div>
				{comments.length > 0 && (
					<div className="mt-4">
						<p className="text-xs text-neutral-500 mb-1">Komentarze</p>
						{comments.map((c) => (
							<p key={c.id} className="text-sm py-1">
								{c.text ?? "—"}
							</p>
						))}
					</div>
				)}
			</div>
		</button>
	);
}

function Flag({ label }: { label: string }) {
	return (
		<span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
			{label}
		</span>
	);
}

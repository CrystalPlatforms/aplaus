import type { Grade, GradeCategory, GradeComment } from "@repo/librus-client";
import { useRoute } from "@/lib/router";

/**
 * The grade detail bottom sheet, shared by the grades list and the subject
 * grades page. The subject row navigates to all grades of that subject.
 */
export function GradeDetailSheet({
	grade,
	category,
	comments,
	onClose,
}: {
	grade: Grade;
	category?: GradeCategory;
	comments: GradeComment[];
	onClose: () => void;
}) {
	const { navigate } = useRoute();
	const g = grade;
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
				aria-label={`Szczegóły oceny: ${g.subjectName ?? "—"}`}
				className="w-full max-w-xl rounded-t-3xl bg-white dark:bg-neutral-900 p-6 pb-10 max-h-[80dvh] overflow-y-auto"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-lg font-bold">{g.subjectName ?? "—"}</h3>
					<button
						type="button"
						onClick={onClose}
						className="text-sm text-blue-600 dark:text-blue-400"
					>
						Zamknij
					</button>
				</div>
				<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
					<dt className="text-neutral-500 dark:text-neutral-400">Ocena</dt>
					<dd className="font-semibold">{g.grade}</dd>
					<dt className="text-neutral-500 dark:text-neutral-400">Przedmiot</dt>
					<dd>
						{g.subjectId !== null ? (
							<button
								type="button"
								onClick={() => navigate(`/grades/subject/${g.subjectId}`)}
								className="text-blue-600 dark:text-blue-400"
							>
								{g.subjectName ?? "—"}
							</button>
						) : (
							(g.subjectName ?? "—")
						)}
					</dd>
					<dt className="text-neutral-500 dark:text-neutral-400">Kategoria</dt>
					<dd>{category?.name ?? "—"}</dd>
					<dt className="text-neutral-500 dark:text-neutral-400">Nauczyciel</dt>
					<dd>{g.addedByName || "—"}</dd>
					<dt className="text-neutral-500 dark:text-neutral-400">Data</dt>
					<dd>{g.dateOccurred || "—"}</dd>
					<dt className="text-neutral-500 dark:text-neutral-400">Dodano</dt>
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
						<p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Komentarze</p>
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

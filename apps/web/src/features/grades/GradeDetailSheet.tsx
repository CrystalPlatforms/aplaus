import type { Grade, GradeCategory, GradeComment } from "@repo/librus-client";
import { DetailOverlay } from "@/components/DetailOverlay";
import { Badge } from "@/components/ui/badge";
import { useRoute } from "@/lib/router";

/**
 * Grade details in the responsive DetailOverlay, shared by the grades list
 * and the subject grades page. The subject row navigates to all grades of
 * that subject.
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
		<DetailOverlay open onOpenChange={(o) => !o && onClose()} title={g.subjectName ?? "—"}>
			<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
				<dt className="text-muted-foreground">Ocena</dt>
				<dd className="font-semibold">{g.grade}</dd>
				<dt className="text-muted-foreground">Przedmiot</dt>
				<dd>
					{g.subjectId !== null ? (
						<button
							type="button"
							onClick={() => navigate(`/grades/subject/${g.subjectId}`)}
							className="text-primary hover:underline"
						>
							{g.subjectName ?? "—"}
						</button>
					) : (
						(g.subjectName ?? "—")
					)}
				</dd>
				<dt className="text-muted-foreground">Kategoria</dt>
				<dd>{category?.name ?? "—"}</dd>
				<dt className="text-muted-foreground">Nauczyciel</dt>
				<dd>{g.addedByName || "—"}</dd>
				<dt className="text-muted-foreground">Data</dt>
				<dd>{g.dateOccurred || "—"}</dd>
				<dt className="text-muted-foreground">Dodano</dt>
				<dd>{g.dateAdded || "—"}</dd>
			</dl>
			<div className="mt-4 flex flex-wrap gap-2">
				{g.isConstituent && <Badge variant="secondary">Liczy się do średniej</Badge>}
				{g.isSemester && <Badge variant="secondary">Semestralna</Badge>}
				{g.isFinal && <Badge variant="secondary">Końcowa</Badge>}
				{g.isSemesterProposition && <Badge variant="secondary">Propozycja semestralna</Badge>}
				{g.isFinalProposition && <Badge variant="secondary">Propozycja końcowa</Badge>}
			</div>
			{comments.length > 0 && (
				<div className="mt-4">
					<p className="text-muted-foreground mb-1 text-xs">Komentarze</p>
					{comments.map((c) => (
						<p key={c.id} className="py-1 text-sm">
							{c.text ?? "—"}
						</p>
					))}
				</div>
			)}
		</DetailOverlay>
	);
}

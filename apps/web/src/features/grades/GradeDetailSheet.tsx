import type { Grade, GradeCategory, GradeComment } from "@repo/librus-client";
import { DetailOverlay } from "@/components/DetailOverlay";
import { Badge } from "@/components/ui/badge";
import { useRoute } from "@/lib/router";

/**
 * On phones (max-md) the sheet expands to a true fullscreen modal — the giant
 * grade hero gets the whole screen. The trailing `!` outranks the shared
 * sheet's unprefixed and sm:/md: sizes regardless of Tailwind's variant
 * order; from md up the centered DetailOverlay stays as-is.
 */
const fullscreenOnPhone =
	"max-md:inset-0! max-md:h-[100dvh]! max-md:w-screen! max-md:max-w-none! " +
	"max-md:translate-x-0! max-md:translate-y-0! max-md:rounded-none!";

/**
 * Grade details in the responsive DetailOverlay, shared by the grades list
 * and the subject grades page. The subject row navigates to all grades of
 * that subject. The grade itself leads as a huge hero: 7rem = 8× the 14px
 * (text-sm) it had inline in the dl.
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
		<DetailOverlay
			open
			onOpenChange={(o) => !o && onClose()}
			title={g.subjectName ?? "—"}
			className={fullscreenOnPhone}
		>
			<div className="flex flex-col items-center gap-2 py-6 text-center">
				<p className="text-[7rem] leading-none font-black">{g.grade}</p>
				<p className="text-muted-foreground text-sm">{category?.name ?? "Ocena"}</p>
			</div>
			<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
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

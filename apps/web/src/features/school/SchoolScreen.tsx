/**
 * Szkoła i klasa: contact data, class info and the lesson list from
 * /api/school/overview — three cards, each degrading independently.
 */
import type { ClassInfo, Lesson, School } from "@repo/librus-client";
import { Card } from "@/components/ui/card";
import { ViewLoader } from "@/components/ViewLoader";
import { useSchoolOverview } from "./queries";

export function SchoolScreen() {
	const { data, isLoading, isError } = useSchoolOverview();

	if (isError) {
		return (
			<p className="py-16 text-center text-sm text-destructive">
				Nie udało się pobrać informacji o szkole.
			</p>
		);
	}
	if (isLoading) return <ViewLoader />;

	return (
		<div className="flex flex-col gap-4">
			<SchoolCard school={data?.school ?? null} />
			<ClassCard classes={data?.classes ?? null} />
			<LessonsCard lessons={data?.lessons ?? []} />
		</div>
	);
}

function SchoolCard({ school }: { school: School | null }) {
	const address = [school?.town, school?.street, school?.buildingNumber]
		.filter((part) => part !== null && part !== "")
		.join(", ");
	return (
		<Card className="gap-0 p-4">
			<h2 className="mb-2 text-sm font-semibold">Szkoła</h2>
			{school === null ? (
				<p className="text-sm text-muted-foreground">Brak danych o szkole</p>
			) : (
				<div className="flex flex-col gap-1">
					<p className="text-sm font-medium">{school.name}</p>
					{address !== "" && <p className="text-sm">{address}</p>}
					{school.headTeacherName && <p className="text-sm">Dyrektor: {school.headTeacherName}</p>}
					{school.email && (
						<p className="text-sm">
							E-mail:{" "}
							<a className="text-primary" href={`mailto:${school.email}`}>
								{school.email}
							</a>
						</p>
					)}
					{school.phoneNumber && <p className="text-sm">Telefon: {school.phoneNumber}</p>}
					{school.schoolYear !== null && (
						<p className="text-sm">Rok szkolny: {school.schoolYear}</p>
					)}
					{school.lessonsFrom && school.lessonsTo && (
						<p className="text-sm">
							Godziny lekcyjne: {school.lessonsFrom}–{school.lessonsTo}
						</p>
					)}
				</div>
			)}
		</Card>
	);
}

function ClassCard({ classes }: { classes: ClassInfo | null }) {
	const className = classes ? `${classes.number ?? ""}${classes.symbol ?? ""}` : "";
	return (
		<Card className="gap-0 p-4">
			<h2 className="mb-2 text-sm font-semibold">Klasa</h2>
			<div className="flex flex-col gap-1 text-sm">
				<p>
					<span className="text-muted-foreground">Klasa: </span>
					{className || "-"}
				</p>
				<p>
					<span className="text-muted-foreground">Wychowawca: </span>
					{classes?.tutorName ?? "-"}
				</p>
				{classes?.endFirstSemester && (
					<p className="text-muted-foreground">
						Koniec I semestru: {classes.endFirstSemester.slice(0, 10)}
					</p>
				)}
				{classes?.endSchoolYear && (
					<p className="text-muted-foreground">Koniec roku: {classes.endSchoolYear.slice(0, 10)}</p>
				)}
			</div>
		</Card>
	);
}

function LessonsCard({ lessons }: { lessons: Lesson[] }) {
	return (
		<Card className="gap-0 p-4">
			<h2 className="mb-2 text-sm font-semibold">Przedmioty i lekcje</h2>
			{lessons.length === 0 ? (
				<p className="text-sm text-muted-foreground">Brak lekcji.</p>
			) : (
				<ul className="flex flex-col gap-1">
					{lessons.map((lesson) => (
						<li key={lesson.id} className="flex justify-between gap-3 text-sm">
							<span className="truncate">{lesson.subjectName ?? "-"}</span>
							<span className="shrink-0 text-muted-foreground">{lesson.teacherName ?? "-"}</span>
						</li>
					))}
				</ul>
			)}
		</Card>
	);
}

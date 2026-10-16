/**
 * Szkoła i klasa: contact data, class info and the lesson list from
 * /api/school/overview — three cards, each degrading independently.
 */
import type { ClassInfo, Lesson, School } from "@repo/librus-client";
import { ViewLoader } from "@/components/ViewLoader";
import { useSchoolOverview } from "./queries";

export function SchoolScreen() {
	const { data, isLoading, isError } = useSchoolOverview();

	if (isError) {
		return (
			<p className="py-16 text-center text-sm text-red-500">
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
		<section className="rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800 p-4">
			<h2 className="text-sm font-semibold mb-2">Szkoła</h2>
			{school === null ? (
				<p className="text-sm text-neutral-500 dark:text-neutral-400">Brak danych o szkole</p>
			) : (
				<div className="flex flex-col gap-1">
					<p className="text-sm font-medium">{school.name}</p>
					{address !== "" && <p className="text-sm">{address}</p>}
					{school.headTeacherName && <p className="text-sm">Dyrektor: {school.headTeacherName}</p>}
					{school.email && (
						<p className="text-sm">
							E-mail:{" "}
							<a className="text-blue-600 dark:text-blue-400" href={`mailto:${school.email}`}>
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
		</section>
	);
}

function ClassCard({ classes }: { classes: ClassInfo | null }) {
	const className = classes ? `${classes.number ?? ""}${classes.symbol ?? ""}` : "";
	return (
		<section className="rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800 p-4">
			<h2 className="text-sm font-semibold mb-2">Klasa</h2>
			<div className="flex flex-col gap-1 text-sm">
				<p>
					<span className="text-neutral-500 dark:text-neutral-400">Klasa: </span>
					{className || "-"}
				</p>
				<p>
					<span className="text-neutral-500 dark:text-neutral-400">Wychowawca: </span>
					{classes?.tutorName ?? "-"}
				</p>
				{classes?.endFirstSemester && (
					<p className="text-neutral-500 dark:text-neutral-400">
						Koniec I semestru: {classes.endFirstSemester.slice(0, 10)}
					</p>
				)}
				{classes?.endSchoolYear && (
					<p className="text-neutral-500 dark:text-neutral-400">
						Koniec roku: {classes.endSchoolYear.slice(0, 10)}
					</p>
				)}
			</div>
		</section>
	);
}

function LessonsCard({ lessons }: { lessons: Lesson[] }) {
	return (
		<section className="rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800 p-4">
			<h2 className="text-sm font-semibold mb-2">Przedmioty i lekcje</h2>
			{lessons.length === 0 ? (
				<p className="text-sm text-neutral-500 dark:text-neutral-400">Brak lekcji.</p>
			) : (
				<ul className="flex flex-col gap-1">
					{lessons.map((lesson) => (
						<li key={lesson.id} className="text-sm flex justify-between gap-3">
							<span className="truncate">{lesson.subjectName ?? "-"}</span>
							<span className="shrink-0 text-neutral-500 dark:text-neutral-400">
								{lesson.teacherName ?? "-"}
							</span>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

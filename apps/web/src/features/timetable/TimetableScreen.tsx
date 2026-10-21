import type { TimetableLesson } from "@repo/librus-client";
import { useState } from "react";
import { DetailOverlay } from "@/components/DetailOverlay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRoute } from "@/lib/router";
import { useMediaQuery } from "@/lib/use-media-query";
import { DayView } from "./DayView";
import { MonthView } from "./MonthView";
import { useTimetableNav } from "./nav-store";
import { useClassFreeDays, useTimetable } from "./queries";
import { useTimetableView } from "./view-store";

export function TimetableScreen() {
	const isDesktop = useMediaQuery("(min-width: 768px)");
	// The toggle and the week/month arrows live in the shell TopBar; mobile is
	// always the day view.
	const view = useTimetableView();
	const activeView = isDesktop ? view : "day";
	const { weekStart, month } = useTimetableNav();
	const [selectedDay, setSelectedDay] = useState(() => new Date().toISOString().slice(0, 10));
	const [detail, setDetail] = useState<TimetableLesson | null>(null);
	const { navigate } = useRoute();
	// Rules of hooks: both view queries stay mounted; each view picks its own.
	const timetable = useTimetable(weekStart);
	const { data: freeDaysData } = useClassFreeDays();
	const freeDays = freeDaysData?.freeDays ?? [];

	if (activeView === "day" && timetable.isError) {
		return (
			<p className="py-16 text-center text-sm text-destructive">Nie udało się pobrać planu.</p>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{activeView === "day" ? (
				<DayView
					weekStart={weekStart}
					selectedDay={selectedDay}
					onSelectDay={setSelectedDay}
					timetable={timetable}
					freeDays={freeDays}
					onLesson={setDetail}
				/>
			) : (
				<MonthView
					month={month}
					freeDays={freeDays}
					onOpenSubject={(subjectId) => navigate(`/grades/subject/${subjectId}`)}
				/>
			)}

			{detail && (
				<LessonSheet
					lesson={detail}
					onClose={() => setDetail(null)}
					onSubjectGrades={() => {
						const id = detail.subjectId;
						if (id !== null) navigate(`/grades/subject/${id}`);
					}}
				/>
			)}
		</div>
	);
}

function LessonSheet({
	lesson,
	onClose,
	onSubjectGrades,
}: {
	lesson: TimetableLesson;
	onClose: () => void;
	onSubjectGrades: () => void;
}) {
	return (
		<DetailOverlay
			open
			onOpenChange={(o) => !o && onClose()}
			title={lesson.subjectName ?? "Lekcja"}
			action={
				lesson.subjectId !== null ? (
					<Button variant="link" size="sm" className="h-auto p-0 text-sm" onClick={onSubjectGrades}>
						Oceny
					</Button>
				) : undefined
			}
		>
			<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
				<dt className="text-muted-foreground">Przedmiot</dt>
				<dd>
					{lesson.subjectId !== null ? (
						<button type="button" onClick={onSubjectGrades} className="text-primary">
							{lesson.subjectName ?? "—"}
						</button>
					) : (
						(lesson.subjectName ?? "—")
					)}
				</dd>
				<dt className="text-muted-foreground">Godziny</dt>
				<dd>
					{lesson.hourFrom}–{lesson.hourTo}
				</dd>
				<dt className="text-muted-foreground">Nauczyciel</dt>
				<dd>
					{lesson.isSubstitutionClass && lesson.orgTeacherName ? (
						<>
							<span className="text-muted-foreground line-through">{lesson.orgTeacherName}</span>
							<span className="mx-1">→</span>
							{lesson.teacherName ?? "—"}
						</>
					) : (
						(lesson.teacherName ?? "—")
					)}
				</dd>
				<dt className="text-muted-foreground">Sala</dt>
				<dd>{lesson.classroomSymbol ?? "—"}</dd>
				<dt className="text-muted-foreground">Numer lekcji</dt>
				<dd>{lesson.lessonNo ?? "—"}</dd>
				<dt className="text-muted-foreground">Data</dt>
				<dd>{lesson.dateFrom.slice(0, 10)}</dd>
			</dl>
			{(lesson.isCanceled || lesson.isSubstitutionClass || lesson.substitutionNote) && (
				<div className="mt-4 flex flex-wrap gap-2">
					{lesson.isCanceled && <Badge variant="secondary">Odwołana</Badge>}
					{lesson.isSubstitutionClass && <Badge variant="secondary">Zastępstwo</Badge>}
					{lesson.substitutionNote && <Badge variant="secondary">{lesson.substitutionNote}</Badge>}
				</div>
			)}
		</DetailOverlay>
	);
}

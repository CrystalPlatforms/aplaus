import { shiftWeekStart, type TimetableLesson } from "@repo/librus-client";
import { useState } from "react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { DetailOverlay } from "@/components/DetailOverlay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ViewLoader } from "@/components/ViewLoader";
import { useRoute } from "@/lib/router";
import { useClassFreeDays, useTimetable } from "./queries";
import { currentWeekStart, weekDays, weekRangeLabel } from "./vm";

export function TimetableScreen() {
	const [weekStart, setWeekStart] = useState(() => currentWeekStart());
	const { data, isLoading, isError } = useTimetable(weekStart);
	const { data: freeDaysData } = useClassFreeDays();
	const days = weekDays(weekStart);
	const [detail, setDetail] = useState<TimetableLesson | null>(null);
	const { navigate } = useRoute();

	if (isError) {
		return (
			<p className="py-16 text-center text-sm text-destructive">Nie udało się pobrać planu.</p>
		);
	}
	if (isLoading) return <ViewLoader />;

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between rounded-xl bg-card px-3 py-2">
				<Button
					variant="outline"
					size="icon"
					onClick={() => {
						const next = shiftWeekStart(weekStart, -1);
						if (next) setWeekStart(next);
					}}
					aria-label="Poprzedni tydzień"
				>
					<LuChevronLeft aria-hidden="true" />
				</Button>
				<p className="text-sm font-semibold">{weekRangeLabel(weekStart)}</p>
				<Button
					variant="outline"
					size="icon"
					onClick={() => {
						const next = shiftWeekStart(weekStart, 1);
						if (next) setWeekStart(next);
					}}
					aria-label="Następny tydzień"
				>
					<LuChevronRight aria-hidden="true" />
				</Button>
			</div>
			{freeDaysData && freeDaysData.freeDays.length > 0 && (
				<FreeDaysCard freeDays={freeDaysData.freeDays} />
			)}
			{!isLoading &&
				days.map((day) => {
					const timetableDay = data?.days.find((d) => d.date === day.date);
					return (
						<DayCard
							key={day.date}
							date={day.date}
							label={day.label}
							slots={timetableDay?.slots ?? []}
							onLesson={setDetail}
						/>
					);
				})}
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

function FreeDaysCard({
	freeDays,
}: {
	freeDays: { id: unknown; date: string; name: string | null }[];
}) {
	return (
		<Card className="gap-2 p-4" data-testid="free-days-card">
			<h2 className="text-sm font-semibold mb-2">Dni wolne</h2>
			<ul className="flex flex-col gap-1">
				{freeDays.map((day, i) => (
					<li key={`${day.date}-${i}`} className="text-sm flex justify-between">
						<span>{day.date}</span>
						<span className="text-muted-foreground">{day.name ?? "Dzień wolny"}</span>
					</li>
				))}
			</ul>
		</Card>
	);
}

function DayCard({
	date,
	label,
	slots,
	onLesson,
}: {
	date: string;
	label: string;
	slots: TimetableLesson[][];
	onLesson: (lesson: TimetableLesson) => void;
}) {
	const lessons = slots.flat();
	const hasContent = lessons.length > 0;
	return (
		<Card className="gap-0 py-0" data-testid="timetable-day" data-date={date}>
			<div className="px-4 pt-3 pb-1 flex items-center justify-between">
				<h2 className="text-sm font-semibold">{label}</h2>
				<span className="text-xs text-muted-foreground">
					{date.slice(8, 10)}.{date.slice(5, 7)}
				</span>
			</div>
			{!hasContent && <p className="px-4 py-3 text-xs text-muted-foreground">Brak lekcji</p>}
			<ul>
				{lessons.map((lesson, i) => (
					<LessonRow key={`${lesson.id ?? i}-${i}`} lesson={lesson} onOpen={onLesson} />
				))}
			</ul>
		</Card>
	);
}

function LessonRow({
	lesson,
	onOpen,
}: {
	lesson: TimetableLesson;
	onOpen: (l: TimetableLesson) => void;
}) {
	return (
		<li
			className={lesson.isCanceled ? "bg-muted/60" : ""}
			data-flag={
				lesson.isCanceled ? "canceled" : lesson.isSubstitutionClass ? "substitution" : "normal"
			}
		>
			<button type="button" onClick={() => onOpen(lesson)} className="w-full px-4 py-2.5 text-left">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<p className="text-sm font-medium">{lesson.subjectName ?? "Lekcja"}</p>
						<p className="text-xs text-muted-foreground">
							{lesson.hourFrom}–{lesson.hourTo}
							{lesson.classroomSymbol ? ` · sala ${lesson.classroomSymbol}` : ""}
						</p>
						{/* Substitution: original teacher struck through, new one after the arrow. */}
						{lesson.isSubstitutionClass && (
							<p className="mt-1 text-xs font-medium text-primary">Zastępstwo</p>
						)}
						{lesson.isSubstitutionClass && (lesson.orgTeacherName || lesson.teacherName) && (
							<p className="mt-1 text-xs">
								{lesson.orgTeacherName && (
									<span className="line-through text-muted-foreground">
										{lesson.orgTeacherName}
									</span>
								)}
								{lesson.orgTeacherName && lesson.teacherName && <span className="mx-1">→</span>}
								{lesson.teacherName && (
									<span className="font-medium text-primary">{lesson.teacherName}</span>
								)}
							</p>
						)}
						{!lesson.isSubstitutionClass && lesson.teacherName && (
							<p className="text-xs text-muted-foreground">{lesson.teacherName}</p>
						)}
						{lesson.isCanceled && (
							<p className="mt-1 text-xs font-medium text-destructive">Odwołana</p>
						)}
						{lesson.substitutionNote && (
							<p className="mt-1 text-xs text-muted-foreground">{lesson.substitutionNote}</p>
						)}
					</div>
					{lesson.lessonNo && (
						<span className="ml-3 shrink-0 w-7 h-7 rounded-full bg-muted text-xs flex items-center justify-center font-semibold">
							{lesson.lessonNo}
						</span>
					)}
				</div>
			</button>
		</li>
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
							<span className="line-through text-muted-foreground">{lesson.orgTeacherName}</span>
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

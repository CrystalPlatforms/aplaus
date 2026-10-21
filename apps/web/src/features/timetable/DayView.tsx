import type { ClassFreeDay, TimetableLesson } from "@repo/librus-client";
import { Loader } from "@/components/Loader";
import { Card } from "@/components/ui/card";
import { subjectColor, WEEKDAYS_SHORT, weekDays } from "./vm";

type DaySlot = { date: string; label: string };

/**
 * Day view (mobile/PWA and the desktop "Dzień" variant): the week bar and
 * day tabs stay mounted while weeks load — only the content area swaps to
 * the loader. One day at a time, Librus-mobile style.
 */
export function DayView({
	weekStart,
	selectedDay,
	onSelectDay,
	timetable,
	freeDays,
	onLesson,
}: {
	weekStart: string;
	selectedDay: string;
	onSelectDay: (date: string) => void;
	timetable: {
		data?: { days: { date: string; slots: TimetableLesson[][] }[] };
		isPending: boolean;
	};
	freeDays: ClassFreeDay[];
	onLesson: (lesson: TimetableLesson) => void;
}) {
	const days = weekDays(weekStart);
	// Weekend days are not selectable — schools have no Saturday/Sunday lessons.
	const weekdays = days.slice(0, 5);
	// Selected day must be a selectable weekday of the displayed week; default
	// to today (when it's a school day), else Monday.
	const today = new Date().toISOString().slice(0, 10);
	const effectiveDay = weekdays.some((d) => d.date === selectedDay)
		? selectedDay
		: (weekdays.find((d) => d.date === today)?.date ?? weekdays[0]?.date ?? "");
	const active = days.find((d) => d.date === effectiveDay);
	const timetableDay = timetable.data?.days.find((d) => d.date === effectiveDay);

	return (
		<>
			{/* Pinned below the shell TopBar: switching days survives scrolling. */}
			<div className="sticky top-14 z-[5] -mx-1 bg-background px-1 py-1">
				<div
					role="tablist"
					aria-label="Dni tygodnia"
					className="flex gap-1 rounded-lg bg-muted p-1"
				>
					{weekdays.map((day, i) => (
						// biome-ignore lint/a11y/useSemanticElements: segmented day tab — a button with aria-selected keeps the CRS segmented look
						<button
							key={day.date}
							type="button"
							role="tab"
							aria-label={`${day.label} ${day.date.slice(8, 10)}.${day.date.slice(5, 7)}`}
							aria-selected={day.date === effectiveDay}
							onClick={() => onSelectDay(day.date)}
							className={`flex-1 rounded-md px-1 py-2 text-xs font-medium transition-colors ${
								day.date === effectiveDay
									? "bg-card text-foreground shadow-sm"
									: "text-muted-foreground"
							}`}
						>
							<span className="block">{WEEKDAYS_SHORT[i] ?? ""}</span>
							<span className="block text-[0.625rem] font-normal opacity-80">
								{day.date.slice(8, 10)}.{day.date.slice(5, 7)}
							</span>
						</button>
					))}
				</div>
			</div>

			{timetable.isPending ? (
				<div className="flex justify-center py-12" aria-busy="true">
					<Loader />
				</div>
			) : (
				<Card className="gap-0 py-0" data-testid="timetable-day" data-date={effectiveDay}>
					{active && (
						<div className="flex items-center justify-between px-4 pt-3 pb-1">
							<h2 className="text-sm font-semibold">{active.label}</h2>
							<span className="text-xs text-muted-foreground">
								{active.date.slice(8, 10)}.{active.date.slice(5, 7)}
							</span>
						</div>
					)}
					<DayBody slots={timetableDay?.slots ?? []} onLesson={onLesson} />
				</Card>
			)}

			{freeDays.length > 0 && <FreeDaysCard freeDays={freeDays} />}
		</>
	);
}

function DayBody({
	slots,
	onLesson,
}: {
	slots: TimetableLesson[][];
	onLesson: (lesson: TimetableLesson) => void;
}) {
	const lessons = slots.flat();
	if (lessons.length === 0) {
		return <p className="px-4 py-3 text-xs text-muted-foreground">Brak lekcji</p>;
	}
	return (
		<ul className="flex flex-col gap-1.5 px-2 py-2">
			{lessons.map((lesson, i) => (
				<LessonRow key={`${lesson.id ?? i}-${i}`} lesson={lesson} onOpen={onLesson} />
			))}
		</ul>
	);
}

function LessonRow({
	lesson,
	onOpen,
}: {
	lesson: TimetableLesson;
	onOpen: (l: TimetableLesson) => void;
}) {
	const color = subjectColor(lesson.subjectName);
	return (
		<li
			data-flag={
				lesson.isCanceled ? "canceled" : lesson.isSubstitutionClass ? "substitution" : "normal"
			}
		>
			<button
				type="button"
				onClick={() => onOpen(lesson)}
				className={`w-full rounded-lg px-3 py-2.5 text-left ${lesson.isCanceled ? "bg-muted" : ""}`}
				style={lesson.isCanceled ? undefined : { backgroundColor: color.tint }}
			>
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
									<span className="text-muted-foreground line-through">
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
						<span className="ml-3 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
							{lesson.lessonNo}
						</span>
					)}
				</div>
			</button>
		</li>
	);
}

function FreeDaysCard({
	freeDays,
}: {
	freeDays: { id: unknown; date: string; name: string | null }[];
}) {
	return (
		<Card className="gap-2 p-4" data-testid="free-days-card">
			<h2 className="mb-2 text-sm font-semibold">Dni wolne</h2>
			<ul className="flex flex-col gap-1">
				{freeDays.map((day, i) => (
					<li key={`${day.date}-${i}`} className="flex justify-between text-sm">
						<span>{day.date}</span>
						<span className="text-muted-foreground">{day.name ?? "Dzień wolny"}</span>
					</li>
				))}
			</ul>
		</Card>
	);
}

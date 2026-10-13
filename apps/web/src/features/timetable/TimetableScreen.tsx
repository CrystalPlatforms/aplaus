import { shiftWeekStart, type TimetableLesson } from "@repo/librus-client";
import { useState } from "react";
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
		return <p className="py-16 text-center text-sm text-red-500">Nie udało się pobrać planu.</p>;
	}
	if (isLoading) return <ViewLoader />;

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800 px-3 py-2">
				<button
					type="button"
					onClick={() => {
						const next = shiftWeekStart(weekStart, -1);
						if (next) setWeekStart(next);
					}}
					aria-label="Poprzedni tydzień"
					className="w-9 h-9 rounded-full border border-neutral-200 dark:border-neutral-700 text-lg leading-none"
				>
					‹
				</button>
				<p className="text-sm font-semibold">{weekRangeLabel(weekStart)}</p>
				<button
					type="button"
					onClick={() => {
						const next = shiftWeekStart(weekStart, 1);
						if (next) setWeekStart(next);
					}}
					aria-label="Następny tydzień"
					className="w-9 h-9 rounded-full border border-neutral-200 dark:border-neutral-700 text-lg leading-none"
				>
					›
				</button>
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
		<div
			className="rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800 p-4"
			data-testid="free-days-card"
		>
			<h2 className="text-sm font-semibold mb-2">Dni wolne</h2>
			<ul className="flex flex-col gap-1">
				{freeDays.map((day, i) => (
					<li key={`${day.date}-${i}`} className="text-sm flex justify-between">
						<span>{day.date}</span>
						<span className="text-neutral-500">{day.name ?? "Dzień wolny"}</span>
					</li>
				))}
			</ul>
		</div>
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
		<section
			className="rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800"
			data-testid="timetable-day"
			data-date={date}
		>
			<div className="px-4 pt-3 pb-1 flex items-center justify-between">
				<h2 className="text-sm font-semibold">{label}</h2>
				<span className="text-xs text-neutral-500">
					{date.slice(8, 10)}.{date.slice(5, 7)}
				</span>
			</div>
			{!hasContent && <p className="px-4 py-3 text-xs text-neutral-400">Brak lekcji</p>}
			<ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
				{lessons.map((lesson, i) => (
					<LessonRow key={`${lesson.id ?? i}-${i}`} lesson={lesson} onOpen={onLesson} />
				))}
			</ul>
		</section>
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
			className={lesson.isCanceled ? "bg-neutral-100/60 dark:bg-neutral-800/40" : ""}
			data-flag={
				lesson.isCanceled ? "canceled" : lesson.isSubstitutionClass ? "substitution" : "normal"
			}
		>
			<button type="button" onClick={() => onOpen(lesson)} className="w-full px-4 py-2.5 text-left">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<p className="text-sm font-medium">{lesson.subjectName ?? "Lekcja"}</p>
						<p className="text-xs text-neutral-500">
							{lesson.hourFrom}–{lesson.hourTo}
							{lesson.classroomSymbol ? ` · sala ${lesson.classroomSymbol}` : ""}
						</p>
						{/* Substitution: original teacher struck through, new one after the arrow. */}
						{lesson.isSubstitutionClass && (
							<p className="mt-1 text-xs font-medium text-blue-600 dark:text-blue-400">
								Zastępstwo
							</p>
						)}
						{lesson.isSubstitutionClass && (lesson.orgTeacherName || lesson.teacherName) && (
							<p className="mt-1 text-xs">
								{lesson.orgTeacherName && (
									<span className="line-through text-neutral-400">{lesson.orgTeacherName}</span>
								)}
								{lesson.orgTeacherName && lesson.teacherName && <span className="mx-1">→</span>}
								{lesson.teacherName && (
									<span className="font-medium text-blue-600 dark:text-blue-400">
										{lesson.teacherName}
									</span>
								)}
							</p>
						)}
						{!lesson.isSubstitutionClass && lesson.teacherName && (
							<p className="text-xs text-neutral-500">{lesson.teacherName}</p>
						)}
						{lesson.isCanceled && (
							<p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">Odwołana</p>
						)}
						{lesson.substitutionNote && (
							<p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
								{lesson.substitutionNote}
							</p>
						)}
					</div>
					{lesson.lessonNo && (
						<span className="ml-3 shrink-0 w-7 h-7 rounded-full bg-neutral-200 dark:bg-neutral-800 text-xs flex items-center justify-center font-semibold">
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
		<button
			type="button"
			aria-label="Zamknij szczegóły lekcji"
			className="fixed inset-0 z-20 flex items-end justify-center bg-black/30 cursor-default"
			onClick={onClose}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={`Szczegóły lekcji: ${lesson.subjectName ?? "Lekcja"}`}
				className="w-full max-w-xl rounded-t-3xl bg-white dark:bg-neutral-900 p-6 pb-10 max-h-[80dvh] overflow-y-auto"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-lg font-bold">{lesson.subjectName ?? "Lekcja"}</h3>
					<div className="flex items-center gap-4">
						{lesson.subjectId !== null && (
							<button
								type="button"
								onClick={onSubjectGrades}
								className="text-sm text-blue-600 dark:text-blue-400"
							>
								Oceny
							</button>
						)}
						<button
							type="button"
							onClick={onClose}
							className="text-sm text-blue-600 dark:text-blue-400"
						>
							Zamknij
						</button>
					</div>
				</div>
				<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
					<dt className="text-neutral-500">Przedmiot</dt>
					<dd>
						{lesson.subjectId !== null ? (
							<button
								type="button"
								onClick={onSubjectGrades}
								className="text-blue-600 dark:text-blue-400"
							>
								{lesson.subjectName ?? "—"}
							</button>
						) : (
							(lesson.subjectName ?? "—")
						)}
					</dd>
					<dt className="text-neutral-500">Godziny</dt>
					<dd>
						{lesson.hourFrom}–{lesson.hourTo}
					</dd>
					<dt className="text-neutral-500">Nauczyciel</dt>
					<dd>
						{lesson.isSubstitutionClass && lesson.orgTeacherName ? (
							<>
								<span className="line-through text-neutral-400">{lesson.orgTeacherName}</span>
								<span className="mx-1">→</span>
								{lesson.teacherName ?? "—"}
							</>
						) : (
							(lesson.teacherName ?? "—")
						)}
					</dd>
					<dt className="text-neutral-500">Sala</dt>
					<dd>{lesson.classroomSymbol ?? "—"}</dd>
					<dt className="text-neutral-500">Numer lekcji</dt>
					<dd>{lesson.lessonNo ?? "—"}</dd>
					<dt className="text-neutral-500">Data</dt>
					<dd>{lesson.dateFrom.slice(0, 10)}</dd>
				</dl>
				{(lesson.isCanceled || lesson.isSubstitutionClass || lesson.substitutionNote) && (
					<div className="mt-4 flex flex-wrap gap-2">
						{lesson.isCanceled && <Flag label="Odwołana" />}
						{lesson.isSubstitutionClass && <Flag label="Zastępstwo" />}
						{lesson.substitutionNote && <Flag label={lesson.substitutionNote} />}
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

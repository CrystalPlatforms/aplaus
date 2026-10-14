/**
 * Kokpit: greeting plus four summary cards (grades, today's lessons, upcoming
 * homework, active notices). Each card loads and fails on its own — a single
 * failing query never breaks the whole screen.
 */

import type {
	Grade,
	HomeWorkAssignment,
	SchoolNotice,
	Timetable,
	TimetableLesson,
} from "@repo/librus-client";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Loader } from "@/components/Loader";
import { ViewLoader } from "@/components/ViewLoader";
import type { GradesView } from "@/features/grades/queries";
import { useGrades } from "@/features/grades/queries";
import type { HomeworkView } from "@/features/homework/queries";
import { useHomework } from "@/features/homework/queries";
import { useTimetable } from "@/features/timetable/queries";
import { useAuth } from "@/lib/auth";
import { useRoute } from "@/lib/router";
import { useNotices } from "./queries";
import {
	activeNotices,
	latestGrades,
	todayISO,
	todayLessons,
	upcomingAssignments,
	weekStartOf,
} from "./vm";

export function DashboardScreen() {
	const { account } = useAuth();
	const grades = useGrades();
	const timetable = useTimetable(weekStartOf(todayISO()));
	const homework = useHomework();
	const notices = useNotices();

	const today = todayISO();
	const allLoading =
		grades.isLoading && timetable.isLoading && homework.isLoading && notices.isLoading;
	if (allLoading) return <ViewLoader />;

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-xl font-bold">{account ? `Cześć, ${account.firstName}` : "Kokpit"}</h1>
			<GradesCard query={grades} />
			<TimetableCard query={timetable} today={today} />
			<HomeworkCard query={homework} today={today} />
			<NoticesCard query={notices} today={today} />
		</div>
	);
}

function GradesCard({ query }: { query: UseQueryResult<GradesView, Error> }) {
	return (
		<Card title="Najnowsze oceny" link={{ label: "Zobacz wszystkie", to: "/grades" }}>
			{query.isError ? (
				<CardError label="Nie udało się pobrać ocen." />
			) : query.isLoading ? (
				<Loader />
			) : (
				<GradeRows grades={latestGrades(query.data?.grades ?? [], 5)} />
			)}
		</Card>
	);
}

function TimetableCard({
	query,
	today,
}: {
	query: UseQueryResult<Timetable, Error>;
	today: string;
}) {
	return (
		<Card title="Dzisiejszy plan" link={{ label: "Zobacz wszystkie", to: "/timetable" }}>
			{query.isError ? (
				<CardError label="Nie udało się pobrać planu lekcji." />
			) : query.isLoading ? (
				<Loader />
			) : (
				<LessonRows lessons={todayLessons(query.data ?? null, today)} />
			)}
		</Card>
	);
}

function HomeworkCard({
	query,
	today,
}: {
	query: UseQueryResult<HomeworkView, Error>;
	today: string;
}) {
	return (
		<Card
			title="Zadania na najbliższy czas"
			link={{ label: "Zobacz wszystkie", to: "/more/homework" }}
		>
			{query.isError ? (
				<CardError label="Nie udało się pobrać zadań." />
			) : query.isLoading ? (
				<Loader />
			) : (
				<AssignmentRows
					assignments={upcomingAssignments(query.data?.assignments ?? [], today, 5)}
				/>
			)}
		</Card>
	);
}

function NoticesCard({
	query,
	today,
}: {
	query: UseQueryResult<SchoolNotice[], Error>;
	today: string;
}) {
	return (
		<Card title="Ogłoszenia" link={{ label: "Zobacz wszystkie", to: "/more/notices" }}>
			{query.isError ? (
				<CardError label="Nie udało się pobrać ogłoszeń." />
			) : query.isLoading ? (
				<Loader />
			) : (
				<NoticeRows notices={activeNotices(query.data ?? [], today).slice(0, 3)} />
			)}
		</Card>
	);
}

function Card({
	title,
	link,
	children,
}: {
	title: string;
	link: { label: string; to: string };
	children: ReactNode;
}) {
	const { navigate } = useRoute();
	return (
		<section className="rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800 p-4">
			<h2 className="text-sm font-semibold mb-2">{title}</h2>
			{children}
			<button
				type="button"
				onClick={() => navigate(link.to)}
				className="mt-3 text-sm text-blue-600 dark:text-blue-400"
			>
				{link.label}
			</button>
		</section>
	);
}

function CardError({ label }: { label: string }) {
	return <p className="text-sm text-red-500">{label}</p>;
}

function GradeRows({ grades }: { grades: Grade[] }) {
	if (grades.length === 0) return <p className="text-sm text-neutral-400">Brak ocen.</p>;
	return (
		<ul className="flex flex-col gap-1.5">
			{grades.map((g) => (
				<li key={g.id} className="text-sm flex justify-between gap-3">
					<span className="truncate">{g.subjectName ?? "-"}</span>
					<span className="shrink-0 text-neutral-500">
						{g.grade} · {g.dateAdded.slice(0, 10)}
					</span>
				</li>
			))}
		</ul>
	);
}

function LessonRows({ lessons }: { lessons: TimetableLesson[] }) {
	if (lessons.length === 0) return <p className="text-sm text-neutral-400">Brak lekcji na dziś.</p>;
	return (
		<ul className="flex flex-col gap-1.5">
			{lessons.map((l) => (
				<li
					key={l.lessonNo ?? `${l.hourFrom}-${l.subjectName ?? ""}`}
					className="text-sm flex justify-between gap-3"
				>
					<span className="truncate">{l.subjectName ?? "-"}</span>
					<span className="shrink-0 text-neutral-500">
						{l.hourFrom}–{l.hourTo}
					</span>
				</li>
			))}
		</ul>
	);
}

function AssignmentRows({ assignments }: { assignments: HomeWorkAssignment[] }) {
	if (assignments.length === 0) return <p className="text-sm text-neutral-400">Brak zadań.</p>;
	return (
		<ul className="flex flex-col gap-1.5">
			{assignments.map((a) => (
				<li key={a.id} className="text-sm flex justify-between gap-3">
					<span className="truncate">{a.topic || "Praca domowa"}</span>
					<span className="shrink-0 text-neutral-500">{a.dueDate.slice(0, 10)}</span>
				</li>
			))}
		</ul>
	);
}

function NoticeRows({ notices }: { notices: SchoolNotice[] }) {
	if (notices.length === 0) return <p className="text-sm text-neutral-400">Brak ogłoszeń.</p>;
	return (
		<ul className="flex flex-col gap-1.5">
			{notices.map((n) => (
				<li key={n.id} className="text-sm flex justify-between gap-3">
					<span className="truncate">{n.subject}</span>
					<span className="shrink-0 text-neutral-500">
						{n.startDate.slice(0, 10)}–{n.endDate.slice(0, 10)}
					</span>
				</li>
			))}
		</ul>
	);
}

/**
 * Kokpit: greeting plus four summary cards (grades, today's lessons, upcoming
 * homework, active notices) on the shared Card component, two columns from md
 * up and a single column below. Each card loads and fails on its own — a
 * single failing query never breaks the whole screen.
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
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
			{/* Two columns from md up, one below — the grid owns the layout, the
			    cards only fill their cell. */}
			{/* min-w-0 on the grid items: a grid/flex item refuses to shrink below
				    its content by default — without it a wide row inflates the whole
				    tile past the mobile frame. */}
			<div className="grid gap-3 md:grid-cols-2 md:gap-4">
				<GradesCard query={grades} />
				<TimetableCard query={timetable} today={today} />
				<HomeworkCard query={homework} today={today} />
				<NoticesCard query={notices} today={today} />
			</div>
		</div>
	);
}

function GradesCard({ query }: { query: UseQueryResult<GradesView, Error> }) {
	return (
		<SummaryCard title="Najnowsze oceny" link={{ label: "Zobacz wszystkie", to: "/grades" }}>
			{query.isError ? (
				<CardError label="Nie udało się pobrać ocen." />
			) : query.isLoading ? (
				<Loader />
			) : (
				<GradeRows grades={latestGrades(query.data?.grades ?? [], 5)} />
			)}
		</SummaryCard>
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
		<SummaryCard title="Dzisiejszy plan" link={{ label: "Zobacz wszystkie", to: "/timetable" }}>
			{query.isError ? (
				<CardError label="Nie udało się pobrać planu lekcji." />
			) : query.isLoading ? (
				<Loader />
			) : (
				<LessonRows lessons={todayLessons(query.data ?? null, today)} />
			)}
		</SummaryCard>
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
		<SummaryCard
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
		</SummaryCard>
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
		<SummaryCard title="Ogłoszenia" link={{ label: "Zobacz wszystkie", to: "/more/notices" }}>
			{query.isError ? (
				<CardError label="Nie udało się pobrać ogłoszeń." />
			) : query.isLoading ? (
				<Loader />
			) : (
				<NoticeRows notices={activeNotices(query.data ?? [], today).slice(0, 3)} />
			)}
		</SummaryCard>
	);
}

/** One kokpit card: title, content, "see all" link — on the shared Card. */
function SummaryCard({
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
		<Card className="min-w-0 gap-2 p-3 md:gap-3 md:p-4">
			<CardTitle className="text-sm">{title}</CardTitle>
			<CardContent className="min-w-0 px-0">{children}</CardContent>
			<Button
				variant="link"
				className="h-auto self-start p-0 text-sm"
				onClick={() => navigate(link.to)}
			>
				{link.label}
			</Button>
		</Card>
	);
}

function CardError({ label }: { label: string }) {
	return <p className="text-sm text-destructive">{label}</p>;
}

function GradeRows({ grades }: { grades: Grade[] }) {
	if (grades.length === 0) return <p className="text-sm text-muted-foreground">Brak ocen.</p>;
	return (
		<ul className="flex flex-col gap-1.5">
			{grades.map((g) => (
				<li key={g.id} className="text-sm flex justify-between gap-3">
					<span className="min-w-0 truncate">{g.subjectName ?? "-"}</span>
					<span className="shrink-0 text-muted-foreground">
						{g.grade} · {g.dateAdded.slice(0, 10)}
					</span>
				</li>
			))}
		</ul>
	);
}

function LessonRows({ lessons }: { lessons: TimetableLesson[] }) {
	if (lessons.length === 0)
		return <p className="text-sm text-muted-foreground">Brak lekcji na dziś.</p>;
	return (
		<ul className="flex flex-col gap-1.5">
			{lessons.map((l) => (
				<li
					key={l.lessonNo ?? `${l.hourFrom}-${l.subjectName ?? ""}`}
					className="text-sm flex justify-between gap-3"
				>
					<span className="min-w-0 truncate">{l.subjectName ?? "-"}</span>
					<span className="shrink-0 text-muted-foreground">
						{l.hourFrom}–{l.hourTo}
					</span>
				</li>
			))}
		</ul>
	);
}

function AssignmentRows({ assignments }: { assignments: HomeWorkAssignment[] }) {
	if (assignments.length === 0) return <p className="text-sm text-muted-foreground">Brak zadań.</p>;
	return (
		<ul className="flex flex-col gap-1.5">
			{assignments.map((a) => (
				<li key={a.id} className="text-sm flex justify-between gap-3">
					<span className="min-w-0 truncate">{a.topic || "Praca domowa"}</span>
					<span className="shrink-0 text-muted-foreground">{a.dueDate.slice(0, 10)}</span>
				</li>
			))}
		</ul>
	);
}

function NoticeRows({ notices }: { notices: SchoolNotice[] }) {
	if (notices.length === 0) return <p className="text-sm text-muted-foreground">Brak ogłoszeń.</p>;
	return (
		<ul className="flex flex-col gap-1.5">
			{notices.map((n) => (
				<li key={n.id} className="text-sm flex justify-between gap-3">
					<span className="min-w-0 truncate">{n.subject}</span>
					<span className="shrink-0 text-muted-foreground">
						{n.startDate.slice(0, 10)}–{n.endDate.slice(0, 10)}
					</span>
				</li>
			))}
		</ul>
	);
}

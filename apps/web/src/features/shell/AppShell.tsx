/**
 * Shell: tabs (Start = kokpit, Oceny, Plan, Wiadomości, Więcej), banner,
 * account switcher and the sub-routes under /more and /messages.
 */
import { useEffect, useState } from "react";
import { AttendanceScreen } from "@/features/attendance/AttendanceScreen";
import { ConferenceDetailScreen } from "@/features/conferences/ConferenceDetailScreen";
import { ConferencesScreen } from "@/features/conferences/ConferencesScreen";
import { DashboardScreen } from "@/features/dashboard/DashboardScreen";
import { GradesScreen } from "@/features/grades/GradesScreen";
import { SubjectGradesScreen } from "@/features/grades/SubjectGradesScreen";
import { HomeworkScreen } from "@/features/homework/HomeworkScreen";
import { JustificationsScreen } from "@/features/justifications/JustificationsScreen";
import { MessageDetailScreen } from "@/features/messages/MessageDetailScreen";
import { MessagesScreen } from "@/features/messages/MessagesScreen";
import { useUnreadCount } from "@/features/messages/queries";
import { NotesScreen } from "@/features/notes/NotesScreen";
import { NoticeDetailScreen } from "@/features/notices/NoticeDetailScreen";
import { NoticesScreen } from "@/features/notices/NoticesScreen";
import { SchoolScreen } from "@/features/school/SchoolScreen";
import { TimetableScreen } from "@/features/timetable/TimetableScreen";
import { useAuth } from "@/lib/auth";
import { useRoute } from "@/lib/router";
import { AccountSwitcher } from "./AccountSwitcher";
import { LoginBanner } from "./LoginBanner";

const TABS = [
	{ id: "start", label: "Start", path: "/start" },
	{ id: "grades", label: "Oceny", path: "/grades" },
	{ id: "plan", label: "Plan", path: "/timetable" },
	{ id: "messages", label: "Wiadomości", path: "/messages" },
	{ id: "more", label: "Więcej", path: "/more" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** Maps a path to its tab; defaults to grades for paths like /grades/subject. */
function activeTabOf(path: string): TabId {
	if (path.startsWith("/start")) return "start";
	if (path.startsWith("/timetable")) return "plan";
	if (path.startsWith("/messages")) return "messages";
	if (path.startsWith("/more")) return "more";
	return "grades";
}

export function AppShell() {
	const { account, logout } = useAuth();
	const { path, navigate } = useRoute();
	const [switcherOpen, setSwitcherOpen] = useState(false);

	useEffect(() => {
		if (path === "/") navigate("/start");
	}, [path, navigate]);

	const activeTab = activeTabOf(path);

	const isSubject = path.startsWith("/grades/subject/");
	const isMessageDetail = /^\/messages\/(inbox|outbox)\/[^/]+$/.test(path);
	const unread = useUnreadCount();
	const badge = account ? (unread.data?.inbox ?? 0) : 0;

	return (
		<div className="min-h-dvh bg-neutral-50 dark:bg-black text-neutral-900 dark:text-neutral-100">
			<header className="sticky top-0 z-10 backdrop-blur bg-white/70 dark:bg-black/70 border-b border-neutral-200 dark:border-neutral-800">
				<div className="px-4 py-2.5 flex items-center justify-between h-14">
					{account ? (
						<button
							type="button"
							onClick={() => setSwitcherOpen(true)}
							aria-label="Przełącz konto"
							className="min-w-0 text-left flex items-center gap-1"
						>
							<LoginBanner
								firstName={account.firstName}
								lastName={account.lastName}
								roleLabel={account.role}
							/>
							<svg
								aria-hidden="true"
								viewBox="0 0 12 12"
								className="w-3.5 h-3.5 shrink-0 text-neutral-400"
							>
								<path
									d="M2 4l4 4 4-4"
									stroke="currentColor"
									strokeWidth="1.5"
									fill="none"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						</button>
					) : null}
					<button
						type="button"
						onClick={logout}
						className="text-sm text-blue-600 dark:text-blue-400 shrink-0 ml-3"
					>
						Wyloguj
					</button>
				</div>
			</header>
			<main className="pb-24 px-4 pt-4 max-w-xl mx-auto">
				{isSubject ? (
					<SubjectGradesRoute />
				) : isMessageDetail ? (
					<MessageDetailRoute />
				) : (
					<>
						{activeTab === "start" && <DashboardScreen />}
						{activeTab === "grades" && <GradesScreen />}
						{activeTab === "plan" && <TimetableScreen />}
						{activeTab === "messages" && <MessagesScreen />}
						{activeTab === "more" && <MoreRoutes />}
					</>
				)}
			</main>
			<nav className="fixed bottom-0 inset-x-0 z-10 border-t border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-black/90 backdrop-blur pb-[env(safe-area-inset-bottom)]">
				<div className="flex">
					{TABS.map((t) => (
						<button
							key={t.id}
							type="button"
							onClick={() => navigate(t.path)}
							className={`flex-1 py-3 text-xs font-medium relative ${
								activeTab === t.id ? "text-blue-600 dark:text-blue-400" : "text-neutral-500"
							}`}
						>
							{t.label}
							{t.id === "messages" && badge > 0 ? (
								<span
									role="img"
									aria-label={`${badge} nieprzeczytanych`}
									className="absolute top-1.5 right-1/2 translate-x-4 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 font-semibold"
								>
									{badge > 99 ? "99+" : badge}
								</span>
							) : null}
						</button>
					))}
				</div>
			</nav>
			<AccountSwitcher open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
		</div>
	);
}

/** Routes under /more: menu and the school-domain subviews. */
function MoreRoutes() {
	const { path } = useRoute();
	if (path.startsWith("/more/homework")) {
		return (
			<div>
				<StickyBack to="/more" label="Więcej" />
				<HomeworkScreen />
			</div>
		);
	}
	if (path.startsWith("/more/attendance")) {
		return (
			<div>
				<StickyBack to="/more" label="Więcej" />
				<AttendanceScreen />
			</div>
		);
	}
	if (path.startsWith("/more/notices/notice/")) {
		const id = path.split("/").pop() ?? "";
		return (
			<div>
				<StickyBack to="/more/notices" label="Ogłoszenia" />
				<NoticeDetailScreen id={id} />
			</div>
		);
	}
	if (path.startsWith("/more/notices")) {
		return (
			<div>
				<StickyBack to="/more" label="Więcej" />
				<NoticesScreen />
			</div>
		);
	}
	if (path.startsWith("/more/notes")) {
		return (
			<div>
				<StickyBack to="/more" label="Więcej" />
				<NotesScreen />
			</div>
		);
	}
	if (path.startsWith("/more/conferences/")) {
		const id = path.split("/").pop() ?? "";
		return (
			<div>
				<StickyBack to="/more/conferences" label="Zebrania" />
				<ConferenceDetailScreen id={id} />
			</div>
		);
	}
	if (path.startsWith("/more/conferences")) {
		return (
			<div>
				<StickyBack to="/more" label="Więcej" />
				<ConferencesScreen />
			</div>
		);
	}
	if (path.startsWith("/more/school")) {
		return (
			<div>
				<StickyBack to="/more" label="Więcej" />
				<SchoolScreen />
			</div>
		);
	}
	if (path.startsWith("/more/justifications")) {
		return (
			<div>
				<StickyBack to="/more" label="Więcej" />
				<JustificationsScreen />
			</div>
		);
	}
	return <MoreMenu />;
}
function MoreMenu() {
	const { navigate } = useRoute();
	const { account } = useAuth();
	const isParent = account?.groupId === 5;
	return (
		<div className="rounded-2xl bg-white dark:bg-neutral-900 shadow-sm border border-neutral-200/60 dark:border-neutral-800 divide-y divide-neutral-100 dark:divide-neutral-800">
			<button
				type="button"
				onClick={() => navigate("/more/homework")}
				className="w-full px-4 py-4 text-left text-sm font-medium"
			>
				Zadania domowe
			</button>
			<button
				type="button"
				onClick={() => navigate("/more/attendance")}
				className="w-full px-4 py-4 text-left text-sm font-medium"
			>
				Frekwencja
			</button>
			<button
				type="button"
				onClick={() => navigate("/more/notices")}
				className="w-full px-4 py-4 text-left text-sm font-medium"
			>
				Ogłoszenia
			</button>
			<button
				type="button"
				onClick={() => navigate("/more/notes")}
				className="w-full px-4 py-4 text-left text-sm font-medium"
			>
				Uwagi
			</button>
			<button
				type="button"
				onClick={() => navigate("/more/conferences")}
				className="w-full px-4 py-4 text-left text-sm font-medium"
			>
				Zebrania z rodzicami
			</button>
			<button
				type="button"
				onClick={() => navigate("/more/school")}
				className="w-full px-4 py-4 text-left text-sm font-medium"
			>
				Szkoła i klasa
			</button>
			{isParent ? (
				<button
					type="button"
					onClick={() => navigate("/more/justifications")}
					className="w-full px-4 py-4 text-left text-sm font-medium"
				>
					Usprawiedliwienia
				</button>
			) : null}
		</div>
	);
}

/** Message detail route (/messages/inbox/:id, /messages/outbox/:id). */
function MessageDetailRoute() {
	const { path } = useRoute();
	const parts = path.split("/");
	const folder = parts[2] === "outbox" ? "outbox" : "inbox";
	const id = parts.pop() ?? "";
	return (
		<div>
			<StickyBack to="/messages" label="Wiadomości" />
			<MessageDetailScreen folder={folder} id={id} />
		</div>
	);
}

/** Subject grades page (/grades/subject/:id) — a full view, not a drawer. */
function SubjectGradesRoute() {
	const { path } = useRoute();
	const subjectId = path.split("/").pop() ?? "";
	return (
		<div>
			<StickyBack to="/grades" label="Oceny" />
			<SubjectGradesScreen subjectId={subjectId} />
		</div>
	);
}

/** Back button pinned under the sticky header — visible while scrolling. */
function StickyBack({ to, label }: { to: string; label: string }) {
	const { navigate } = useRoute();
	return (
		<div className="sticky top-14 z-[5] -mx-4 px-4 py-2 bg-white/80 dark:bg-black/80 backdrop-blur border-b border-neutral-200/60 dark:border-neutral-800/60">
			<button
				type="button"
				onClick={() => navigate(to)}
				className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1"
			>
				<svg aria-hidden="true" viewBox="0 0 12 12" className="w-3.5 h-3.5">
					<path
						d="M8 2L4 6l4 4"
						stroke="currentColor"
						strokeWidth="1.5"
						fill="none"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
				{label}
			</button>
		</div>
	);
}

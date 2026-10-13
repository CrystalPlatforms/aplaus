import { useEffect, useState } from "react";
import { AttendanceScreen } from "@/features/attendance/AttendanceScreen";
import { GradesScreen } from "@/features/grades/GradesScreen";
import { SubjectGradesScreen } from "@/features/grades/SubjectGradesScreen";
import { HomeworkScreen } from "@/features/homework/HomeworkScreen";
import { TimetableScreen } from "@/features/timetable/TimetableScreen";
import { useAuth } from "@/lib/auth";
import { useRoute } from "@/lib/router";
import { AccountSwitcher } from "./AccountSwitcher";
import { LoginBanner } from "./LoginBanner";
import { PlaceholderScreen } from "./PlaceholderScreen";

const TABS = [
	{ id: "grades", label: "Oceny", path: "/grades" },
	{ id: "plan", label: "Plan", path: "/timetable" },
	{ id: "messages", label: "Wiadomości", path: "/messages" },
	{ id: "more", label: "Więcej", path: "/more" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AppShell() {
	const { account, logout } = useAuth();
	const { path, navigate } = useRoute();
	const [switcherOpen, setSwitcherOpen] = useState(false);

	// "/" carries no view — land on the grades tab.
	useEffect(() => {
		if (path === "/") navigate("/grades");
	}, [path, navigate]);

	const activeTab: TabId = path.startsWith("/timetable")
		? "plan"
		: path.startsWith("/messages")
			? "messages"
			: path.startsWith("/more")
				? "more"
				: "grades";

	const isSubject = path.startsWith("/grades/subject/");

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
							{/* affordance arrow — the switcher button was hard to spot */}
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
				) : (
					<>
						{activeTab === "grades" && <GradesScreen />}
						{activeTab === "plan" && <TimetableScreen />}
						{activeTab === "messages" && <PlaceholderScreen label="Wiadomości" />}
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
							className={`flex-1 py-3 text-xs font-medium ${
								activeTab === t.id ? "text-blue-600 dark:text-blue-400" : "text-neutral-500"
							}`}
						>
							{t.label}
						</button>
					))}
				</div>
			</nav>
			<AccountSwitcher open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
		</div>
	);
}

/** Routes under /more: menu, homework and attendance subviews. */
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
	return <MoreMenu />;
}

function MoreMenu() {
	const { navigate } = useRoute();
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

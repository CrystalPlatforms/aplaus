import { useState } from "react";
import { GradesScreen } from "@/features/grades/GradesScreen";
import { useAuth } from "@/lib/auth";
import { PlaceholderScreen } from "./PlaceholderScreen";

const TABS = [
	{ id: "grades", label: "Oceny" },
	{ id: "plan", label: "Plan" },
	{ id: "messages", label: "Wiadomości" },
	{ id: "more", label: "Więcej" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AppShell() {
	const { account, logout } = useAuth();
	const [tab, setTab] = useState<TabId>("grades");

	const name = account ? `${account.firstName} ${account.lastName}`.trim() : "";
	return (
		<div className="min-h-dvh bg-neutral-50 dark:bg-black text-neutral-900 dark:text-neutral-100">
			<header className="sticky top-0 z-10 backdrop-blur bg-white/70 dark:bg-black/70 border-b border-neutral-200 dark:border-neutral-800">
				<div className="px-4 py-3 flex items-center justify-between">
					<div className="min-w-0">
						<p className="text-sm font-semibold truncate">
							{name ? `Zalogowano jako ${name}` : ""}
						</p>
						{account?.role && <p className="text-xs text-neutral-500">{account.role}</p>}
					</div>
					<button
						type="button"
						onClick={logout}
						className="text-sm text-blue-600 dark:text-blue-400"
					>
						Wyloguj
					</button>
				</div>
			</header>
			<main className="pb-24 px-4 pt-4 max-w-xl mx-auto">
				{tab === "grades" && <GradesScreen />}
				{tab === "plan" && <PlaceholderScreen label="Plan lekcji" />}
				{tab === "messages" && <PlaceholderScreen label="Wiadomości" />}
				{tab === "more" && <PlaceholderScreen label="Więcej" />}
			</main>
			<nav className="fixed bottom-0 inset-x-0 z-10 border-t border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-black/90 backdrop-blur pb-[env(safe-area-inset-bottom)]">
				<div className="flex">
					{TABS.map((t) => (
						<button
							key={t.id}
							type="button"
							onClick={() => setTab(t.id)}
							className={`flex-1 py-3 text-xs font-medium ${tab === t.id ? "text-blue-600 dark:text-blue-400" : "text-neutral-500"}`}
						>
							{t.label}
						</button>
					))}
				</div>
			</nav>
		</div>
	);
}

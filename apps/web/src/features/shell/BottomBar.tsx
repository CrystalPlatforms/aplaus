/**
 * Mobile bottom bar (< md): icon + label per tab, active tab highlighted
 * with the primary token, unread badge on Wiadomości. Hidden from md up,
 * where the sidebar takes over.
 */
import { useRoute } from "@/lib/router";
import { TABS } from "./nav-items";

export function BottomBar({ activeTab, badge }: { activeTab: string; badge: number }) {
	const { navigate } = useRoute();
	return (
		<nav
			aria-label="Nawigacja główna"
			className="fixed bottom-0 inset-x-0 z-10 bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden"
		>
			<div className="flex">
				{TABS.map((t) => (
					<button
						key={t.id}
						type="button"
						onClick={() => navigate(t.path)}
						className={`flex-1 py-2 text-xs font-medium relative flex flex-col items-center gap-1 rounded-lg transition-colors ${
							activeTab === t.id
								? "text-primary"
								: "text-muted-foreground hover:bg-muted hover:text-foreground"
						}`}
					>
						<span className="relative">
							<t.Icon className="size-5" aria-hidden="true" />
							{t.id === "messages" && badge > 0 ? (
								<span
									role="img"
									aria-label={`${badge} nieprzeczytanych`}
									className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[0.625rem] leading-4 font-semibold"
								>
									{badge > 99 ? "99+" : badge}
								</span>
							) : null}
						</span>
						{t.label}
					</button>
				))}
			</div>
		</nav>
	);
}

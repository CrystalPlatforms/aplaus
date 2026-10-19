/**
 * Desktop sidebar (md+), CRS-Theme look: no separator lines, active row on
 * the full primary fill, collapsible "Więcej" group (options slide up into
 * the heading), account block pinned to the bottom. Hidden below md.
 */
import { useState } from "react";
import { LuChevronDown } from "react-icons/lu";
import { useAuth } from "@/lib/auth";
import { useRoute } from "@/lib/router";
import { cn } from "@/lib/utils";
import { LoginBanner } from "./LoginBanner";
import { activeTabOf, MORE_SECTIONS, type NavItem, PARENT_SECTIONS, TABS } from "./nav-items";

export function Sidebar({
	unread,
	onSwitchAccount,
}: {
	unread: number;
	onSwitchAccount: () => void;
}) {
	const { path } = useRoute();
	const { account, logout } = useAuth();
	const active = activeTabOf(path);
	const isParent = account?.groupId === 5;
	const [moreOpen, setMoreOpen] = useState(true);
	return (
		<aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-sidebar text-sidebar-foreground h-dvh sticky top-0">
			<div className="flex items-center px-4 h-14">
				<span className="font-display text-lg font-bold">Aplaus</span>
			</div>
			<nav
				aria-label="Nawigacja główna"
				className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-5"
			>
				<ul className="flex flex-col gap-1">
					{TABS.filter((t) => t.id !== "more").map((t) => (
						<li key={t.id}>
							<SidebarLink item={t} active={active === t.tab} unread={unread} />
						</li>
					))}
				</ul>
				<div>
					<button
						type="button"
						onClick={() => setMoreOpen((o) => !o)}
						aria-expanded={moreOpen}
						className="w-full flex items-center justify-between px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
					>
						Więcej
						<LuChevronDown
							className={cn("size-3.5 transition-transform", moreOpen && "rotate-180")}
							aria-hidden="true"
						/>
					</button>
					{/* grid-rows 1fr→0fr collapse: the options slide up into the heading. */}
					<div
						className={cn(
							"grid transition-[grid-template-rows] duration-200 ease-out",
							moreOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
						)}
					>
						<ul className="flex flex-col gap-1 overflow-hidden">
							{MORE_SECTIONS.map((s) => (
								<li key={s.id}>
									<SidebarLink item={s} active={path.startsWith(s.path)} unread={0} />
								</li>
							))}
							{isParent
								? PARENT_SECTIONS.map((s) => (
										<li key={s.id}>
											<SidebarLink item={s} active={path.startsWith(s.path)} unread={0} />
										</li>
									))
								: null}
						</ul>
					</div>
				</div>
			</nav>
			<div className="p-3 flex flex-col gap-1">
				{account ? (
					<button
						type="button"
						onClick={onSwitchAccount}
						className="min-w-0 flex items-center gap-2 rounded-lg p-2 text-left hover:bg-muted"
					>
						<InitialsAvatar firstName={account.firstName} lastName={account.lastName} />
						<LoginBanner
							firstName={account.firstName}
							lastName={account.lastName}
							roleLabel={account.role}
						/>
						{/* Name-from-content (WCAG 2.5.3): the visible text is part of
						    the accessible name, the sr-only span adds the action. */}
						<span className="sr-only">Przełącz konto</span>
					</button>
				) : null}
				<button
					type="button"
					onClick={logout}
					className="text-sm text-destructive text-left rounded-md p-2 hover:bg-muted"
				>
					Wyloguj
				</button>
			</div>
		</aside>
	);
}

function InitialsAvatar({ firstName, lastName }: { firstName: string; lastName: string }) {
	const initials = `${firstName.charAt(0) ?? ""}${lastName.charAt(0) ?? ""}`.toUpperCase() || "?";
	return (
		<span
			aria-hidden="true"
			className="size-8 shrink-0 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center"
		>
			{initials}
		</span>
	);
}

function SidebarLink({ item, active, unread }: { item: NavItem; active: boolean; unread: number }) {
	const { navigate } = useRoute();
	return (
		<button
			type="button"
			onClick={() => navigate(item.path)}
			className={cn(
				"w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
				active ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-muted",
			)}
		>
			<item.Icon className="size-4" aria-hidden="true" />
			<span className="min-w-0 flex-1 text-left truncate">{item.label}</span>
			{unread > 0 ? (
				<span
					className={cn(
						"min-w-5 h-5 px-1.5 rounded-full text-xs font-semibold flex items-center justify-center",
						active
							? "bg-primary-foreground text-primary"
							: "bg-destructive text-destructive-foreground",
					)}
				>
					{unread > 99 ? "99+" : unread}
				</span>
			) : null}
		</button>
	);
}

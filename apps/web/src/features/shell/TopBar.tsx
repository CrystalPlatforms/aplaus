/**
 * Top bar. Mobile (< md): the login banner button (Przełącz konto) and
 * Wyloguj, as today. Desktop (md+): a refresh button with a spin animation
 * while queries refetch (pull-to-refresh is touch-only, so desktop gets
 * an explicit Odśwież).
 */
import { useIsFetching } from "@tanstack/react-query";
import { LuRotateCw } from "react-icons/lu";
import type { AccountView } from "@/lib/auth";
import { LoginBanner } from "./LoginBanner";

export function TopBar({
	account,
	logout,
	onSwitchAccount,
	onRefresh,
}: {
	account: AccountView | null;
	logout: () => void;
	onSwitchAccount: () => void;
	onRefresh: () => void;
}) {
	const fetching = useIsFetching();
	return (
		<header className="sticky top-0 z-10 backdrop-blur bg-surface/70 border-b border-line">
			<div className="px-4 py-2.5 flex items-center justify-between h-14">
				{account ? (
					<button
						type="button"
						onClick={onSwitchAccount}
						className="min-w-0 text-left flex items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-muted md:hidden"
					>
						<LoginBanner
							firstName={account.firstName}
							lastName={account.lastName}
							roleLabel={account.role}
						/>
						{/* Name-from-content (WCAG 2.5.3): visible text is part of the
						    accessible name; the sr-only span adds the action. */}
						<span className="sr-only">Przełącz konto</span>
						<svg
							aria-hidden="true"
							viewBox="0 0 12 12"
							className="w-3.5 h-3.5 shrink-0 text-muted-foreground"
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
				{account ? (
					<button
						type="button"
						onClick={logout}
						className="text-sm text-primary shrink-0 rounded-lg px-2 py-1 transition-colors hover:bg-muted md:hidden"
					>
						Wyloguj
					</button>
				) : null}
				<button
					type="button"
					onClick={onRefresh}
					className="hidden md:inline-flex items-center gap-2 text-sm font-medium text-primary px-3 h-9 rounded-md hover:bg-accent"
				>
					<LuRotateCw className={fetching ? "animate-spin" : undefined} aria-hidden="true" />
					Odśwież
				</button>
			</div>
		</header>
	);
}

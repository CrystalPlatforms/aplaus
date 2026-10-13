import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { AddAccountModal } from "./AddAccountModal";

/** One account row of the switcher sheet. */
function AccountRow({
	account,
	active,
	busy,
	onSwitch,
}: {
	account: { id: string; firstName: string; lastName: string; role: string };
	active: boolean;
	busy: boolean;
	onSwitch: (id: string) => void;
}) {
	const name = `${account.firstName} ${account.lastName}`.trim() || account.id;
	return (
		<li>
			<button
				type="button"
				disabled={busy}
				onClick={() => onSwitch(account.id)}
				className="w-full py-3 flex items-center justify-between text-left disabled:opacity-50"
			>
				<span className="min-w-0">
					<span className="block text-sm font-medium">{name}</span>
					<span className="block text-xs text-neutral-500">{account.role}</span>
				</span>
				{active ? (
					<span className="text-xs font-medium text-green-600 dark:text-green-400">Aktywne</span>
				) : (
					<span className="text-xs text-neutral-400">Przełącz</span>
				)}
			</button>
		</li>
	);
}

/**
 * Account switcher sheet: lists the device's accounts, switches the active
 * one, opens the add-account form, logs out.
 */
export function AccountSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
	const { accounts, activeAccountId, switchAccount, logout } = useAuth();
	const [adding, setAdding] = useState(false);
	const [busy, setBusy] = useState(false);

	if (!open) return null;

	async function handleSwitch(id: string) {
		setBusy(true);
		try {
			await switchAccount(id);
			onClose();
		} finally {
			setBusy(false);
		}
	}

	return (
		<button
			type="button"
			aria-label="Zamknij przełącznik kont"
			className="fixed inset-0 z-20 flex items-end justify-center bg-black/30 cursor-default"
			onClick={onClose}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-label="Konta"
				className="w-full max-w-xl rounded-t-3xl bg-white dark:bg-neutral-900 p-6 pb-10 max-h-[80dvh] overflow-y-auto"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-lg font-bold">Konta</h3>
					<button
						type="button"
						onClick={onClose}
						className="text-sm text-blue-600 dark:text-blue-400"
					>
						Zamknij
					</button>
				</div>

				<ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
					{accounts.map((a) => (
						<AccountRow
							key={a.id}
							account={a}
							active={a.id === activeAccountId}
							busy={busy}
							onSwitch={handleSwitch}
						/>
					))}
				</ul>

				<div className="mt-4 flex flex-col gap-2">
					<button
						type="button"
						onClick={() => setAdding(true)}
						className="py-3 text-sm font-medium text-blue-600 dark:text-blue-400 text-left"
					>
						+ Dodaj konto
					</button>
					<button
						type="button"
						onClick={() => {
							logout();
							onClose();
						}}
						className="py-3 text-sm font-medium text-red-500 text-left"
					>
						Wyloguj się
					</button>
				</div>

				{adding && <AddAccountModal open onClose={() => setAdding(false)} />}
			</div>
		</button>
	);
}

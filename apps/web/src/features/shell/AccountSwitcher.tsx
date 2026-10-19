import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { AddAccountModal } from "./AddAccountModal";

/** One account row of the switcher dialog. */
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
				className={`w-full my-1 px-3 py-3 flex items-center justify-between text-left rounded-lg border disabled:opacity-50 ${
					active ? "border-primary/40 bg-muted" : "border-transparent hover:bg-muted"
				}`}
			>
				<span className="min-w-0">
					<span className="block text-sm font-medium">{name}</span>
					<span className="text-muted-foreground block text-xs">{account.role}</span>
				</span>
				{active ? (
					<span className="text-primary text-xs font-medium">Aktywne</span>
				) : (
					<span className="text-muted-foreground text-xs">Przełącz</span>
				)}
			</button>
		</li>
	);
}

/**
 * Account switcher as a centered dialog on every width: lists the device's
 * accounts, switches the active one, opens the add-account form, logs out.
 */
export function AccountSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
	const { accounts, activeAccountId, switchAccount, logout } = useAuth();
	const [adding, setAdding] = useState(false);
	const [busy, setBusy] = useState(false);

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
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent aria-describedby={undefined} className="max-w-md">
				<DialogHeader>
					<DialogTitle>Konta</DialogTitle>
				</DialogHeader>
				<ul className="flex flex-col">
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
				<div className="flex flex-col gap-1">
					<button
						type="button"
						onClick={() => setAdding(true)}
						className="text-primary py-2 px-2 rounded-md text-left text-sm font-medium transition-colors hover:bg-muted"
					>
						+ Dodaj konto
					</button>
					<button
						type="button"
						onClick={() => {
							logout();
							onClose();
						}}
						className="text-destructive py-2 px-2 rounded-md text-left text-sm font-medium transition-colors hover:bg-muted"
					>
						Wyloguj się
					</button>
				</div>
				{adding && <AddAccountModal open onClose={() => setAdding(false)} />}
			</DialogContent>
		</Dialog>
	);
}

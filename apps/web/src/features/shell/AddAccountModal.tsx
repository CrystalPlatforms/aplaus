import { useState } from "react";
import { Loader } from "@/components/Loader";
import { useAuth } from "@/lib/auth";

/**
 * Add-account modal: Librus login + password in a centered dialog, opened
 * from the account switcher. Reuses the device token on the server.
 */
export function AddAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
	const { addAccount } = useAuth();
	const [login, setLogin] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	if (!open) return null;

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError(null);
		try {
			await addAccount(login, password);
			setLogin("");
			setPassword("");
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Coś poszło nie tak.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<button
			type="button"
			aria-label="Zamknij dodawanie konta"
			className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-6 cursor-default"
			onClick={onClose}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-label="Dodaj konto"
				className="w-full max-w-sm rounded-3xl bg-white dark:bg-neutral-900 p-6 shadow-xl"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-lg font-bold">Dodaj konto</h3>
					<button
						type="button"
						onClick={onClose}
						className="text-sm text-blue-600 dark:text-blue-400"
					>
						Anuluj
					</button>
				</div>
				<form onSubmit={handleSubmit} className="flex flex-col gap-3">
					<input
						className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-4 py-3 text-base outline-none focus:border-blue-500"
						placeholder="Login Librusa"
						autoComplete="username"
						value={login}
						onChange={(e) => setLogin(e.target.value)}
						required
					/>
					<input
						type="password"
						className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-4 py-3 text-base outline-none focus:border-blue-500"
						placeholder="Hasło"
						autoComplete="current-password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
					/>
					<button
						type="submit"
						disabled={busy}
						className="mt-2 rounded-xl bg-blue-600 dark:bg-blue-500 text-white py-3 text-base font-semibold disabled:opacity-50"
					>
						{busy ? (
							<span className="flex items-center justify-center">
								<Loader />
							</span>
						) : (
							"Dodaj"
						)}
					</button>
					{error && (
						<p className="text-sm text-red-500" role="alert">
							{error}
						</p>
					)}
				</form>
			</div>
		</button>
	);
}

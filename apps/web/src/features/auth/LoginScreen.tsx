import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader } from "@/components/Loader";
import { apiFetch, setToken } from "@/lib/api";
import type { AccountView } from "@/lib/auth";
import { setActiveAccountId, setCredentials, setLoggedOut } from "@/lib/credentials";

export function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
	const [login, setLogin] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const queryClient = useQueryClient();

	/**
	 * The login dance takes a moment anyway, but when Librus answers instantly
	 * the button loader would only flash. One second is the smallest stay that
	 * reads as "trwa logowanie" instead of a flicker.
	 */
	const MIN_LOADER_MS = 1000;
	const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError(null);
		try {
			const [result] = await Promise.all([
				apiFetch<{ deviceToken: string; account: AccountView }>("/api/login", {
					method: "POST",
					body: JSON.stringify({ login, password }),
				}),
				sleep(MIN_LOADER_MS),
			]);
			setToken(result.deviceToken);
			setLoggedOut(false);
			setCredentials(result.account.id, { login, password });
			setActiveAccountId(result.account.id);
			// The auth gate renders from the ["me"] query — reset it so the shell
			// appears immediately instead of after a manual page refresh. The
			// accounts list refetches too (the device gained an account).
			await queryClient.resetQueries({ queryKey: ["me"] });
			await queryClient.resetQueries({ queryKey: ["accounts"] });
			onSuccess();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Coś poszło nie tak.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-white dark:bg-black">
			<div className="w-full max-w-sm">
				<h1 className="font-display text-3xl font-bold tracking-tight text-center mb-8">Aplaus</h1>
				<form id="login-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
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
						className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-4 py-3"
						placeholder="Hasło"
						autoComplete="current-password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
					/>
					<button
						type="submit"
						disabled={busy}
						className="mt-4 rounded-xl bg-blue-600 dark:bg-blue-500 text-white py-3 text-base font-semibold disabled:opacity-50"
					>
						{busy ? (
							<span className="flex items-center justify-center">
								<Loader />
							</span>
						) : (
							"Zaloguj się"
						)}
					</button>
				</form>
				{error && (
					<p className="mt-4 text-sm text-red-500 text-center" role="alert">
						{error}
					</p>
				)}
			</div>
		</div>
	);
}

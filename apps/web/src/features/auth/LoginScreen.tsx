import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
		<div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-background">
			<Card className="w-full max-w-sm py-8">
				<CardHeader className="text-center">
					{/* Logo Aplaus (ikona PWA) jako dekoracyjny znak logowania. */}
					<img src="/icon-192.png" alt="" className="mx-auto size-16 rounded-xl" />
					<h1 className="font-display text-3xl font-bold tracking-tight">Aplaus</h1>
				</CardHeader>
				<CardContent>
					<form id="login-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
						<div className="flex flex-col gap-2">
							<Label htmlFor="login">Login Librusa</Label>
							<Input
								id="login"
								placeholder="Login Librusa"
								autoComplete="username"
								className="h-12 rounded-xl"
								value={login}
								onChange={(e) => setLogin(e.target.value)}
								required
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="password">Hasło</Label>
							<Input
								id="password"
								type="password"
								placeholder="Hasło"
								autoComplete="current-password"
								className="h-12 rounded-xl"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
							/>
						</div>
						<Button
							type="submit"
							disabled={busy}
							className="mt-2 h-12 w-full rounded-xl text-base font-semibold"
						>
							{busy ? (
								<span className="flex items-center justify-center">
									<Loader />
								</span>
							) : (
								"Zaloguj się"
							)}
						</Button>
					</form>
					{error && (
						<p className="mt-4 text-sm text-destructive text-center" role="alert">
							{error}
						</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

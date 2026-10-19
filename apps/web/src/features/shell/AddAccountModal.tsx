import { useState } from "react";
import { Loader } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

/**
 * Add-account dialog: Librus login + password, opened from the account
 * switcher. Reuses the device token on the server.
 */
export function AddAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
	const { addAccount } = useAuth();
	const [login, setLogin] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

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
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent aria-describedby={undefined} className="max-w-sm">
				<DialogHeader>
					<DialogTitle>Dodaj konto</DialogTitle>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-col gap-3">
					<div className="grid gap-2">
						<Label htmlFor="add-account-login">Login Librusa</Label>
						<Input
							id="add-account-login"
							placeholder="Login Librusa"
							autoComplete="username"
							value={login}
							onChange={(e) => setLogin(e.target.value)}
							required
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="add-account-password">Hasło</Label>
						<Input
							id="add-account-password"
							type="password"
							placeholder="Hasło"
							autoComplete="current-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
						/>
					</div>
					<Button type="submit" disabled={busy}>
						{busy ? (
							<span className="flex items-center justify-center">
								<Loader />
							</span>
						) : (
							"Dodaj"
						)}
					</Button>
					{error && (
						<p className="text-destructive text-sm" role="alert">
							{error}
						</p>
					)}
				</form>
			</DialogContent>
		</Dialog>
	);
}

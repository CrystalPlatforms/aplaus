import { LoginScreen } from "@/features/auth/LoginScreen";
import { AppShell } from "@/features/shell/AppShell";
import { AuthProvider, useAuth } from "@/lib/auth";

function Gate() {
	const { account, isLoading } = useAuth();
	if (isLoading) {
		return (
			<div className="min-h-dvh flex items-center justify-center text-sm text-neutral-400">
				Ładowanie...
			</div>
		);
	}
	return account ? <AppShell /> : <LoginScreen onSuccess={() => undefined} />;
}

export default function App() {
	return (
		<AuthProvider>
			<Gate />
		</AuthProvider>
	);
}

import { SplashScreen } from "@/components/SplashScreen";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { AppShell } from "@/features/shell/AppShell";
import { AuthProvider, useAuth } from "@/lib/auth";
import { isLoggedOut } from "@/lib/credentials";
import { RouterProvider } from "@/lib/router";

function Gate() {
	const { account, isLoading } = useAuth();
	if (isLoading) {
		return <SplashScreen />;
	}
	return account && !isLoggedOut() ? <AppShell /> : <LoginScreen onSuccess={() => undefined} />;
}

export default function App() {
	return (
		<RouterProvider>
			<AuthProvider>
				<Gate />
			</AuthProvider>
		</RouterProvider>
	);
}

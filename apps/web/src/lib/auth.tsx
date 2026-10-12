import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext } from "react";
import { apiFetch, clearToken, getToken } from "./api";

/** Account meta the shell needs for the login banner. */
export interface AccountView {
	id: string;
	firstName: string;
	lastName: string;
	role: string;
}

const AuthContext = createContext<{
	account: AccountView | null;
	isLoading: boolean;
	logout: () => void;
}>({ account: null, isLoading: true, logout: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();
	const me = useQuery({
		queryKey: ["me"],
		queryFn: async () => {
			if (!getToken()) return null;
			try {
				return await apiFetch<AccountView>("/api/me");
			} catch {
				clearToken();
				return null;
			}
		},
	});

	const logout = () => {
		clearToken();
		// clear() alone leaves the mounted ["me"] observer without a refetch,
		// which is why the logout state only showed up after a manual refresh:
		// reset the identity query (it re-resolves to null without a token) and
		// drop the data caches so the next login starts clean.
		queryClient.removeQueries({ queryKey: ["grades"] });
		void queryClient.resetQueries({ queryKey: ["me"] });
	};

	return (
		<AuthContext.Provider value={{ account: me.data ?? null, isLoading: me.isLoading, logout }}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	return useContext(AuthContext);
}

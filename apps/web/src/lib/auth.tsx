import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useEffect } from "react";
import { apiFetch, getToken, setToken } from "./api";
import {
	clearActiveAccountId,
	clearAllCredentials,
	isLoggedOut,
	setActiveAccountId,
	setCredentials,
	setLoggedOut,
} from "./credentials";

/** Account meta the shell needs for the login banner and switcher. */
export interface AccountView {
	id: string;
	firstName: string;
	lastName: string;
	role: string;
}

export interface AccountsState {
	accounts: AccountView[];
	activeAccountId: string | null;
}

const AuthContext = createContext<{
	account: AccountView | null;
	accounts: AccountView[];
	activeAccountId: string | null;
	isLoading: boolean;
	switchAccount: (accountId: string) => Promise<void>;
	addAccount: (login: string, password: string) => Promise<void>;
	logout: () => void;
}>({
	account: null,
	accounts: [],
	activeAccountId: null,
	isLoading: true,
	switchAccount: () => Promise.resolve(),
	addAccount: () => Promise.resolve(),
	logout: () => {},
});

const ACCOUNTS_QUERY_KEY = ["accounts"];
const ME_KEY = ["me"];

export function AuthProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();

	const accounts = useQuery({
		queryKey: ACCOUNTS_QUERY_KEY,
		queryFn: async (): Promise<AccountsState | null> => {
			if (!getToken()) return null;
			try {
				return await apiFetch<AccountsState>("/api/accounts");
			} catch {
				return null;
			}
		},
	});

	const me = useQuery({
		queryKey: ME_KEY,
		queryFn: apiFetchMe,
	});

	useEffect(() => {
		const handler = () => {
			// The device token survives (api.ts already flagged "logged out"),
			// so re-login re-attaches to the same device and its account list.
			void queryClient.resetQueries({ queryKey: ME_KEY });
			void queryClient.resetQueries({ queryKey: ACCOUNTS_QUERY_KEY });
		};
		window.addEventListener("aplaus:session-expired", handler);
		return () => window.removeEventListener("aplaus:session-expired", handler);
	}, [queryClient]);

	const switchAccount = async (accountId: string) => {
		await apiFetch("/api/accounts/switch", {
			method: "POST",
			body: JSON.stringify({ accountId }),
		});
		setActiveAccountId(accountId);
		// Every data query reads in the active-account context: drop all caches
		// so the shell re-renders with the other account's data and banner.
		await queryClient.invalidateQueries();
	};

	const addAccount = async (login: string, password: string) => {
		const result = await apiFetch<{ deviceToken: string; account: AccountView }>("/api/login", {
			method: "POST",
			body: JSON.stringify({ login, password }),
		});
		setToken(result.deviceToken);
		setCredentials(result.account.id, { login, password });
		setActiveAccountId(result.account.id);
		await queryClient.invalidateQueries();
	};

	const logout = () => {
		// Logout is a UI state, not a device wipe: the token stays so the next
		// login re-attaches to the same device and every account on it.
		setLoggedOut(true);
		clearAllCredentials();
		clearActiveAccountId();
		// clear() alone leaves the mounted ["me"] observer without a refetch,
		// which is why the logout state only showed up after a manual refresh:
		// reset the identity query (it re-resolves to null without a token) and
		// drop the data caches so the next login starts clean.
		queryClient.removeQueries({ queryKey: ["grades"] });
		queryClient.removeQueries({ queryKey: ["timetable"] });
		queryClient.removeQueries({ queryKey: ["free-days"] });
		queryClient.removeQueries({ queryKey: ["homework"] });
		queryClient.removeQueries({ queryKey: ["attendance"] });
		void queryClient.resetQueries({ queryKey: ME_KEY });
		void queryClient.resetQueries({ queryKey: ACCOUNTS_QUERY_KEY });
	};

	return (
		<AuthContext.Provider
			value={{
				account: me.data ?? null,
				accounts: accounts.data?.accounts ?? [],
				activeAccountId: accounts.data?.activeAccountId ?? null,
				isLoading: me.isLoading,
				switchAccount,
				addAccount,
				logout,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

async function apiFetchMe(): Promise<AccountView | null> {
	if (!getToken() || isLoggedOut()) return null;
	try {
		return await apiFetch<AccountView>("/api/me");
	} catch {
		// A network error (dev server restarting, offline) must not wipe the
		// device: the token stays, the gate shows the login screen and the
		// next login re-attaches to the same account list.
		return null;
	}
}

export function useAuth() {
	return useContext(AuthContext);
}

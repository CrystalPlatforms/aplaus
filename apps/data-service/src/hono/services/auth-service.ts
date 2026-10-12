/**
 * Login orchestration: throttle check, Librus dance, KV persistence, token mint.
 * Passwords are never written to KV — only the cookie jar and account meta.
 */
import { isLibrusError, loginToLibrus } from "@repo/librus-client";
import { isLoginThrottled, registerFailedLogin, resetFailedLogins } from "@/kv/login-throttle";
import { loadAccount, saveAccount, saveDevice } from "@/kv/store";
import type { LoginRequest } from "../schemas/auth";
import type { Result } from "../types/result";
import { toAppError } from "./librus-errors";

/** Account fields the device sees (no jar, no password). */
export interface AccountView {
	id: string;
	firstName: string;
	lastName: string;
	role: string;
}

const ROLE_NAMES: Record<number, string> = {
	8: "Uczeń",
	5: "Rodzic",
};

const roleLabel = (groupId: number): string => ROLE_NAMES[groupId] ?? "Konto";

/** Injectable boundary: the Librus HTTP dance. Tests replace it wholesale. */
export interface LoginDeps {
	loginToLibrus: typeof loginToLibrus;
}

const defaultLoginDeps: LoginDeps = { loginToLibrus };

export type LoginSuccess = { deviceToken: string; account: AccountView };

export async function login(
	env: Env,
	input: LoginRequest,
	deps: LoginDeps = defaultLoginDeps,
): Promise<Result<LoginSuccess>> {
	if (await isLoginThrottled(env.KV, input.login)) {
		return {
			ok: false,
			error: {
				code: "LOGIN_THROTTLED",
				message: "Zbyt wiele nieudanych prob logowania. Odczekaj chwilę.",
				status: 429,
			},
		};
	}
	try {
		const outcome = await deps.loginToLibrus(input.login, input.password);
		await resetFailedLogins(env.KV, input.login);
		const jar = outcome.jar.toDTO();
		const accountId = `librus:${outcome.account.id}`;
		const account = {
			id: accountId,
			firstName: outcome.account.firstName,
			lastName: outcome.account.lastName,
			groupId: outcome.account.groupId,
			jar,
			createdAt: new Date().toISOString(),
		};
		await saveAccount(env.KV, account);
		const token = crypto.randomUUID();
		await saveDevice(env.KV, token, { accountIds: [accountId] });
		return {
			ok: true,
			data: {
				deviceToken: token,
				account: {
					id: accountId,
					firstName: account.firstName,
					lastName: account.lastName,
					role: roleLabel(account.groupId),
				},
			},
		};
	} catch (error) {
		if (isLibrusError(error) && error.code === "WRONG_CREDENTIALS") {
			await registerFailedLogin(env.KV, input.login);
			return {
				ok: false,
				error: { code: "WRONG_CREDENTIALS", message: error.userMessage, status: 401 },
			};
		}
		const appError = toAppError(error);
		return { ok: false, error: appError };
	}
}

/** Account view for GET /api/me (device token -> account meta). */
export async function getMe(kv: KVNamespace, accountId: string): Promise<Result<AccountView>> {
	const account = await loadAccount(kv, accountId);
	if (!account) {
		return {
			ok: false,
			error: {
				code: "SESSION_EXPIRED",
				message: "Sesja wygasła. Zaloguj się ponownie.",
				status: 401,
			},
		};
	}
	return {
		ok: true,
		data: {
			id: account.id,
			firstName: account.firstName,
			lastName: account.lastName,
			role: roleLabel(account.groupId),
		},
	};
}

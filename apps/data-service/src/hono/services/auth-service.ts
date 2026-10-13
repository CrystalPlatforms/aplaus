/**
 * Login orchestration: throttle check, Librus dance, KV persistence, token mint.
 * Passwords are never written to KV — only the cookie jar and account meta.
 *
 * Multi-account model: a device owns many accounts; `login` with an existing
 * device token adds another account; `switchAccount` moves the active context;
 * `refreshAccount` re-logs in with device-held credentials and swaps the jar.
 */
import { isLibrusError, loginToLibrus } from "@repo/librus-client";
import { isLoginThrottled, registerFailedLogin, resetFailedLogins } from "@/kv/login-throttle";
import {
	type AccountRecord,
	activeAccountIdOf,
	addAccountToDevice,
	loadAccount,
	loadDevice,
	saveAccount,
	saveDevice,
	setDeviceActiveAccount,
} from "@/kv/store";
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

const accountIdOf = (librusId: number): string => `librus:${librusId}`;

const toView = (account: AccountRecord): AccountView => ({
	id: account.id,
	firstName: account.firstName,
	lastName: account.lastName,
	role: roleLabel(account.groupId),
});

/** Injectable boundary: the Librus HTTP dance. Tests replace it wholesale. */
export interface LoginDeps {
	loginToLibrus: typeof loginToLibrus;
}

const defaultLoginDeps: LoginDeps = { loginToLibrus };

export type LoginSuccess = { deviceToken: string; account: AccountView };

export async function login(
	env: Env,
	input: LoginRequest,
	deviceToken: string | null = null,
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
		const account = accountRecordFrom(outcome);
		await saveAccount(env.KV, account);
		// An existing device gains the account; a fresh login mints a device.
		let token = deviceToken;
		if (token && (await loadDevice(env.KV, token))) {
			await addAccountToDevice(env.KV, token, account.id);
		} else {
			token = crypto.randomUUID();
			await saveDevice(env.KV, token, { accountIds: [account.id], activeAccountId: account.id });
		}
		return {
			ok: true,
			data: { deviceToken: token, account: toView(account) },
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

/**
 * Silent renewal: the device re-logs in with credentials it holds, the server
 * swaps the jar in KV. Only accounts already owned by the device may renew.
 */
export async function refreshAccount(
	env: Env,
	input: LoginRequest,
	deviceToken: string,
	deps: LoginDeps = defaultLoginDeps,
): Promise<Result<AccountView>> {
	const device = await loadDevice(env.KV, deviceToken);
	if (!device) {
		return {
			ok: false,
			error: {
				code: "SESSION_EXPIRED",
				message: "Sesja wygasła. Zaloguj się ponownie.",
				status: 401,
			},
		};
	}
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
		const account = accountRecordFrom(outcome);
		if (!device.accountIds.includes(account.id)) {
			return {
				ok: false,
				error: {
					code: "FORBIDDEN",
					message: "To konto nie należy do tego urządzenia.",
					status: 403,
				},
			};
		}
		await saveAccount(env.KV, account);
		await setDeviceActiveAccount(env.KV, deviceToken, account.id);
		return { ok: true, data: toView(account) };
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

/** All accounts of the device, with the active one marked. */
export async function listAccounts(
	kv: KVNamespace,
	deviceToken: string,
): Promise<Result<{ accounts: AccountView[]; activeAccountId: string | null }>> {
	const device = await loadDevice(kv, deviceToken);
	if (!device) {
		return {
			ok: false,
			error: {
				code: "SESSION_EXPIRED",
				message: "Sesja wygasła. Zaloguj się ponownie.",
				status: 401,
			},
		};
	}
	const accounts: AccountView[] = [];
	for (const id of device.accountIds) {
		const record = await loadAccount(kv, id);
		if (record) accounts.push(toView(record));
	}
	return { ok: true, data: { accounts, activeAccountId: activeAccountIdOf(device) } };
}

/** Moves the proxy context to another account of the same device. */
export async function switchAccount(
	kv: KVNamespace,
	deviceToken: string,
	accountId: string,
): Promise<Result<AccountView>> {
	const device = await setDeviceActiveAccount(kv, deviceToken, accountId);
	if (!device) {
		return {
			ok: false,
			error: { code: "NOT_FOUND", message: "Nie ma takiego konta na tym urządzeniu.", status: 404 },
		};
	}
	const record = await loadAccount(kv, accountId);
	if (!record) {
		return {
			ok: false,
			error: {
				code: "SESSION_EXPIRED",
				message: "Sesja wygasła. Zaloguj się ponownie.",
				status: 401,
			},
		};
	}
	return { ok: true, data: toView(record) };
}

/** Account meta for GET /api/me (device token -> account meta). */
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
	return { ok: true, data: toView(account) };
}

function accountRecordFrom(outcome: Awaited<ReturnType<typeof loginToLibrus>>): AccountRecord {
	return {
		id: accountIdOf(outcome.account.id),
		firstName: outcome.account.firstName,
		lastName: outcome.account.lastName,
		groupId: outcome.account.groupId,
		jar: outcome.jar.toDTO(),
		createdAt: new Date().toISOString(),
	};
}

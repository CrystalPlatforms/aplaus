/**
 * Typed KV access for devices and accounts. KV is the app's persistence layer.
 * Keys: `device:{token}` -> DeviceRecord, `account:{id}` -> AccountRecord.
 * The account record holds a cookie jar + meta, never a password.
 */
import type { CookieJarDTO } from "@repo/librus-client";

export interface AccountRecord {
	id: string;
	firstName: string;
	lastName: string;
	/** Librus role: 8 = student, 5 = parent. */
	groupId: number;
	/** Cookie jar (domena G) shared by every device and, later, cron. */
	jar: CookieJarDTO;
	createdAt: string;
}

export interface DeviceRecord {
	accountIds: string[];
	/** The account proxy requests resolve to; falls back to the first account. */
	activeAccountId: string | null;
}

const ACCOUNT_PREFIX = "account:";
const DEVICE_PREFIX = "device:";

const accountKey = (id: string) => `${ACCOUNT_PREFIX}${id}`;
const deviceKey = (token: string) => `${DEVICE_PREFIX}${token}`;

/** The account proxy requests use: the active one or the first added. */
export function activeAccountIdOf(device: DeviceRecord): string | null {
	return device.activeAccountId ?? device.accountIds[0] ?? null;
}

/**
 * Adds an account to the device and makes it active. Saving twice keeps the
 * list stable (a re-login of an existing account must not duplicate it).
 */
export async function addAccountToDevice(
	kv: KVNamespace,
	token: string,
	accountId: string,
): Promise<DeviceRecord> {
	const device = (await loadDevice(kv, token)) ?? { accountIds: [], activeAccountId: null };
	if (!device.accountIds.includes(accountId)) device.accountIds.push(accountId);
	device.activeAccountId = accountId;
	await saveDevice(kv, token, device);
	return device;
}

/** Switches the active account. No-op when the account is not on the device. */
export async function setDeviceActiveAccount(
	kv: KVNamespace,
	token: string,
	accountId: string,
): Promise<DeviceRecord | null> {
	const device = await loadDevice(kv, token);
	if (!device || !device.accountIds.includes(accountId)) return null;
	device.activeAccountId = accountId;
	await saveDevice(kv, token, device);
	return device;
}

/** Loads an account record or null. */
export async function loadAccount(kv: KVNamespace, id: string): Promise<AccountRecord | null> {
	const raw = await kv.get(accountKey(id));
	if (!raw) return null;
	return JSON.parse(raw) as AccountRecord;
}

/** Loads a device record or null. */
export async function loadDevice(kv: KVNamespace, token: string): Promise<DeviceRecord | null> {
	const raw = await kv.get(deviceKey(token));
	if (!raw) return null;
	return JSON.parse(raw) as DeviceRecord;
}

/** Persists an account record. */
export async function saveAccount(kv: KVNamespace, record: AccountRecord): Promise<void> {
	await kv.put(accountKey(record.id), JSON.stringify(record));
}

/** Persists a device record. */
export async function saveDevice(
	kv: KVNamespace,
	token: string,
	record: DeviceRecord,
): Promise<void> {
	await kv.put(deviceKey(token), JSON.stringify(record));
}

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
}

const ACCOUNT_PREFIX = "account:";
const DEVICE_PREFIX = "device:";

const accountKey = (id: string) => `${ACCOUNT_PREFIX}${id}`;
const deviceKey = (token: string) => `${DEVICE_PREFIX}${token}`;

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

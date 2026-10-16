/**
 * Push persistence in KV:
 * - `pushsub:{accountId}:{endpointHash}` -> PushSubscriptionRecord (per device)
 * - `prefs:{accountId}` -> PushPreferences (8 per-type switches, default on)
 * - `cronstate:{accountId}` -> CronState (last-seen fingerprints + suspension)
 */

export const PUSH_TYPES = [
	"grades",
	"messages",
	"notices",
	"attendance",
	"homework",
	"notes",
	"timetable",
	"conferences",
] as const;

export type PushType = (typeof PUSH_TYPES)[number];

export interface PushSubscriptionRecord {
	/** Push service endpoint (browser-specific, stable per browser profile). */
	endpoint: string;
	keys: { p256dh: string; auth: string };
	createdAt: string;
}

export type PushPreferences = Record<PushType, boolean>;

export interface CronState {
	/** Fingerprint per resource; empty on the very first poll (baseline). */
	lastSeen: Partial<Record<PushType, string>>;
	/** Jar expired: polling paused until a login/refresh renews it. */
	suspended: boolean;
	/** The "sesja wygasła" push was already sent — never twice per outage. */
	sessionNotified: boolean;
}

function defaultPushPreferences(): PushPreferences {
	return {
		grades: true,
		messages: true,
		notices: true,
		attendance: true,
		homework: true,
		notes: true,
		timetable: true,
		conferences: true,
	};
}

export function defaultCronState(): CronState {
	return { lastSeen: {}, suspended: false, sessionNotified: false };
}

const SUB_PREFIX = "pushsub:";
const PREFS_PREFIX = "prefs:";
const CRONSTATE_PREFIX = "cronstate:";

const subKey = (accountId: string, endpointHash: string) =>
	`${SUB_PREFIX}${accountId}:${endpointHash}`;
const prefsKey = (accountId: string) => `${PREFS_PREFIX}${accountId}`;
const cronStateKey = (accountId: string) => `${CRONSTATE_PREFIX}${accountId}`;

/**
 * Stable short hash of a subscription endpoint (djb2). Not security — just a
 * KV key: the full endpoint stays inside the record.
 */
function endpointHash(endpoint: string): string {
	let hash = 5381;
	for (let i = 0; i < endpoint.length; i++) {
		hash = ((hash << 5) + hash + endpoint.charCodeAt(i)) | 0;
	}
	return (hash >>> 0).toString(16);
}

/** Saves (or replaces) a device subscription for the account. */
export async function savePushSubscription(
	kv: KVNamespace,
	accountId: string,
	record: PushSubscriptionRecord,
): Promise<void> {
	await kv.put(subKey(accountId, endpointHash(record.endpoint)), JSON.stringify(record));
}

/** Removes one subscription by its endpoint; no-op when absent. */
export async function deletePushSubscription(
	kv: KVNamespace,
	accountId: string,
	endpoint: string,
): Promise<void> {
	await kv.delete(subKey(accountId, endpointHash(endpoint)));
}

/** Every device subscription of the account (usually 1-3: phone, tablet...). */
export async function listPushSubscriptions(
	kv: KVNamespace,
	accountId: string,
): Promise<PushSubscriptionRecord[]> {
	const list = await kv.list({ prefix: `${SUB_PREFIX}${accountId}:` });
	const records = await Promise.all(
		list.keys.map(async (key) => {
			const raw = await kv.get(key.name);
			return raw ? (JSON.parse(raw) as PushSubscriptionRecord) : null;
		}),
	);
	return records.filter((record): record is PushSubscriptionRecord => record !== null);
}

/** Per-type preferences; defaults (all on) when never configured. */
export async function loadPushPreferences(
	kv: KVNamespace,
	accountId: string,
): Promise<PushPreferences> {
	const raw = await kv.get(prefsKey(accountId));
	if (!raw) return defaultPushPreferences();
	const parsed = JSON.parse(raw) as Partial<PushPreferences>;
	return { ...defaultPushPreferences(), ...parsed };
}

export async function savePushPreferences(
	kv: KVNamespace,
	accountId: string,
	preferences: PushPreferences,
): Promise<void> {
	await kv.put(prefsKey(accountId), JSON.stringify(preferences));
}

export async function loadCronState(kv: KVNamespace, accountId: string): Promise<CronState> {
	const raw = await kv.get(cronStateKey(accountId));
	if (!raw) return defaultCronState();
	const parsed = JSON.parse(raw) as Partial<CronState>;
	return { ...defaultCronState(), ...parsed };
}

export async function saveCronState(
	kv: KVNamespace,
	accountId: string,
	state: CronState,
): Promise<void> {
	await kv.put(cronStateKey(accountId), JSON.stringify(state));
}

/**
 * Clears the suspension after a successful login/refresh. Last-seen
 * fingerprints are kept deliberately: the account is the same, so a renewed
 * jar must not trigger a notification storm over unchanged data.
 */
export async function resetCronSuspension(kv: KVNamespace, accountId: string): Promise<void> {
	const state = await loadCronState(kv, accountId);
	if (!state.suspended && !state.sessionNotified) return;
	await saveCronState(kv, accountId, { ...state, suspended: false, sessionNotified: false });
}

/**
 * Push poller (cron, co ~5 min): dla każdego konta z żywym słoikiem pobiera
 * METADANE 8 zasobów (listy/liczniki — nigdy treść wiadomości), robi diff
 * ze stanem last-seen w KV i wysyła web push z deep-linkiem do właściwego
 * widoku. Wygasły słoik → dokładnie jeden push „sesja wygasła", konto
 * wstrzymane do odnowienia (reset przy login/refresh).
 */
import {
	type Attendance,
	CookieJar,
	type Grade,
	type HomeWork,
	isLibrusError,
	type Note,
	type ParentTeacherConference,
	readAttendances,
	readGrades,
	readHomeWorks,
	readInboxMessages,
	readNotes,
	readParentTeacherConferences,
	readSchoolNotices,
	readTimetable,
	readUnreadMessagesCount,
	type SchoolNotice,
} from "@repo/librus-client";
import {
	deletePushSubscription,
	listPushSubscriptions,
	loadCronState,
	loadPushPreferences,
	PUSH_TYPES,
	type PushSubscriptionRecord,
	type PushType,
	saveCronState,
} from "@/kv/push-store";
import { loadAccount } from "@/kv/store";
import { sendPushNotification } from "./push-service";

/** Deep link per notification type — the in-app route the tap opens. */
export const DEEPLINKS: Record<PushType, string> = {
	grades: "/grades",
	messages: "/messages",
	notices: "/more/notices",
	attendance: "/more/attendance",
	homework: "/more/homework",
	notes: "/more/notes",
	timetable: "/timetable",
	conferences: "/more/conferences",
};

/** UI copy per type (Polish, ready for the notification). */
export const PUSH_COPY: Record<PushType, { title: string; body: string }> = {
	grades: { title: "Nowa ocena", body: "Nowe oceny w dzienniku." },
	messages: { title: "Nowa wiadomość", body: "Masz nowe wiadomości w skrzynce." },
	notices: { title: "Nowe ogłoszenie", body: "Nowe ogłoszenie szkolne." },
	attendance: { title: "Frekwencja", body: "Nowy wpis frekwencji." },
	homework: { title: "Zadania domowe", body: "Nowe zadanie domowe." },
	notes: { title: "Nowa uwaga", body: "Nowa uwaga od nauczyciela." },
	timetable: { title: "Zmiana w planie", body: "Zmiana w planie lekcji na ten tydzień." },
	conferences: { title: "Nowe zebranie", body: "Nowe zebranie z rodzicami." },
};

/** Web-push payload the service worker renders (sw.ts). */
export interface PushPayload {
	title: string;
	body: string;
	url: string;
}

interface PollerReaders {
	grades: typeof readGrades;
	messagesUnread: typeof readUnreadMessagesCount;
	messagesInbox: typeof readInboxMessages;
	notices: typeof readSchoolNotices;
	attendance: typeof readAttendances;
	homework: typeof readHomeWorks;
	notes: typeof readNotes;
	timetable: typeof readTimetable;
	conferences: typeof readParentTeacherConferences;
}

/**
 * The push-send boundary. Returns gone=true when the push service answered
 * 404/410 (subscription expired — caller removes it from KV).
 */
type SendPush = (
	env: Env,
	subscription: PushSubscriptionRecord,
	payload: PushPayload,
) => Promise<{ gone: boolean }>;

export interface PollerDeps {
	/** Monday of the week containing `now`, YYYY-MM-DD. */
	weekStart: (now: Date) => string;
	readers: PollerReaders;
	sendPush: SendPush;
	now: () => Date;
}

/** djb2 over a string — short stable fingerprints for the diff. */
function fingerprintOf(value: string): string {
	let hash = 5381;
	for (let i = 0; i < value.length; i++) {
		hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
	}
	return (hash >>> 0).toString(16);
}

/** Fingerprint from a list of record ids (order-independent). */
function idsFingerprint(ids: Array<string | number>): string {
	return fingerprintOf(ids.map(String).sort().join(","));
}

/**
 * Fetches the metadata of one tracked resource and reduces it to a
 * fingerprint. Lists contribute their ids; messages contribute the unread
 * counter plus the ids of the first inbox page; the timetable contributes
 * the whole normalized week (a lesson swap changes the hash).
 */
async function readFingerprint(
	jar: CookieJar,
	type: PushType,
	readers: PollerReaders,
	weekStart: string,
): Promise<string> {
	switch (type) {
		case "grades": {
			const grades: Grade[] = await readers.grades(jar);
			return idsFingerprint(grades.map((g) => g.id));
		}
		case "messages": {
			const counts = await readers.messagesUnread(jar);
			const page = await readers.messagesInbox(jar, 1, 20);
			const ids = page.messages.map((item) => item.messageId);
			return fingerprintOf(`${counts.inbox}|${ids.sort().join(",")}`);
		}
		case "notices": {
			const notices: SchoolNotice[] = await readers.notices(jar);
			return idsFingerprint(notices.map((n) => n.id));
		}
		case "attendance": {
			const records: Attendance[] = await readers.attendance(jar);
			return idsFingerprint(records.map((r) => r.id));
		}
		case "homework": {
			const items: HomeWork[] = await readers.homework(jar);
			return idsFingerprint(items.map((h) => h.id));
		}
		case "notes": {
			const items: Note[] = await readers.notes(jar);
			return idsFingerprint(items.map((n) => n.id));
		}
		case "timetable": {
			const week = await readers.timetable(jar, weekStart);
			return fingerprintOf(JSON.stringify(week));
		}
		case "conferences": {
			const items: ParentTeacherConference[] = await readers.conferences(jar);
			return idsFingerprint(items.map((c) => c.id));
		}
	}
}

/** Polls one account: diff -> pushes -> cron-state update. */
export async function pollAccount(
	kv: KVNamespace,
	accountId: string,
	env: Env,
	deps: PollerDeps,
): Promise<void> {
	const account = await loadAccount(kv, accountId);
	if (!account) return;
	const state = await loadCronState(kv, accountId);
	if (state.suspended) return;

	const jar = CookieJar.fromDTO(account.jar);
	const now = deps.now();
	const weekStart = deps.weekStart(now);

	// Fetch every resource's fingerprint; one failing type skips that type
	// without poisoning the rest of the poll.
	const fingerprints = new Map<PushType, string>();
	let jarExpired = false;
	await Promise.all(
		PUSH_TYPES.map(async (type) => {
			try {
				fingerprints.set(type, await readFingerprint(jar, type, deps.readers, weekStart));
			} catch (error) {
				if (isLibrusError(error) && error.code === "SESSION_EXPIRED") {
					jarExpired = true;
				}
			}
		}),
	);

	if (jarExpired) {
		// Exactly one "sesja wygasła" push per outage; then pause the account
		// until login/refresh resets the suspension.
		if (!state.sessionNotified) {
			const subscriptions = await listPushSubscriptions(kv, accountId);
			const payload: PushPayload = {
				title: "Sesja Librusa wygasła",
				body: "Otwórz Aplaus, aby zalogować się ponownie.",
				url: "/",
			};
			await Promise.all(subscriptions.map((sub) => deps.sendPush(env, sub, payload)));
			await saveCronState(kv, accountId, {
				...state,
				suspended: true,
				sessionNotified: true,
				lastSeen: state.lastSeen,
			});
		}
		return;
	}

	// First poll of a fresh state stores the baseline silently — no pushes.
	const firstRun = Object.keys(state.lastSeen).length === 0;
	const changed: PushType[] = [];
	for (const type of PUSH_TYPES) {
		const seen = state.lastSeen[type];
		const current = fingerprints.get(type);
		if (!current) continue; // this type failed — keep the old fingerprint
		if (seen === undefined) continue; // baseline for a first-seen type
		if (seen !== current) changed.push(type);
	}

	const subscriptions = await listPushSubscriptions(kv, accountId);
	const preferences = await loadPushPreferences(kv, accountId);
	await Promise.all(
		changed
			.filter((type) => preferences[type])
			.map((type) => {
				const payload: PushPayload = {
					title: PUSH_COPY[type].title,
					body: PUSH_COPY[type].body,
					url: DEEPLINKS[type],
				};
				return Promise.all(
					subscriptions.map(async (sub) => {
						const result = await deps.sendPush(env, sub, payload);
						if (result.gone) await deletePushSubscription(kv, accountId, sub.endpoint);
					}),
				);
			}),
	);

	// Persist only when something changed (baseline or diffs) — last-seen
	// writes are not free on the KV free tier.
	const nextLastSeen: Partial<Record<PushType, string>> = { ...state.lastSeen };
	for (const type of PUSH_TYPES) {
		const current = fingerprints.get(type);
		if (current) nextLastSeen[type] = current;
	}
	const lastSeenChanged =
		firstRun ||
		changed.length > 0 ||
		Object.keys(nextLastSeen).length !== Object.keys(state.lastSeen).length;
	if (lastSeenChanged) {
		await saveCronState(kv, accountId, { ...state, lastSeen: nextLastSeen });
	}
}

/** The cron entry: every account on the device store, polled in parallel. */
export async function runPollingCycle(kv: KVNamespace, env: Env, deps: PollerDeps): Promise<void> {
	const list = await kv.list({ prefix: "account:" });
	const accountIds = list.keys
		.map((key) => key.name.slice("account:".length))
		.filter((id) => id.length > 0);
	await Promise.all(accountIds.map((accountId) => pollAccount(kv, accountId, env, deps)));
}

/** Monday (UTC) of the week containing `now`, YYYY-MM-DD — Librus weekStart. */
function mondayOf(now: Date): string {
	const date = new Date(now);
	const diff = (date.getUTCDay() + 6) % 7;
	date.setUTCDate(date.getUTCDate() - diff);
	return date.toISOString().slice(0, 10);
}

/** Production deps: real readers, real web-push sender, wall clock. */
export function defaultPollerDeps(): PollerDeps {
	return {
		weekStart: mondayOf,
		readers: {
			grades: readGrades,
			messagesUnread: readUnreadMessagesCount,
			messagesInbox: readInboxMessages,
			notices: readSchoolNotices,
			attendance: readAttendances,
			homework: readHomeWorks,
			notes: readNotes,
			timetable: readTimetable,
			conferences: readParentTeacherConferences,
		},
		sendPush: sendPushNotification,
		now: () => new Date(),
	};
}

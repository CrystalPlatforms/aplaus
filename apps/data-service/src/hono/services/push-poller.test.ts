/**
 * The push poller contract:
 * - diff of the 8 tracked resources -> one push per changed type, deep link
 *   and copy correct; an unchanged second poll pushes NOTHING;
 * - a type switched "off" in preferences is silent, the rest still push;
 * - an expired jar -> exactly one "sesja wygasła" push, then the account is
 *   suspended (readers untouched) until resetCronSuspension;
 * - the poller's reader set is metadata-only: lists and counters, never
 *   message content (call registry).
 *
 * Readers are fixture fns (the HttpDeps-style boundary), KV is the real
 * workerd simulation, the push sender is a recording stub.
 */

import { env } from "cloudflare:workers";
import { CookieJar, LibrusError } from "@repo/librus-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	defaultCronState,
	loadCronState,
	type PushPreferences,
	resetCronSuspension,
	savePushPreferences,
	savePushSubscription,
} from "@/kv/push-store";
import { saveAccount } from "@/kv/store";
import {
	DEEPLINKS,
	type PollerDeps,
	PUSH_COPY,
	type PushPayload,
	pollAccount,
} from "./push-poller";

const ACCOUNT_ID = "cron-test-account";

/** Fresh fixtures per poll: the test mutates these between polls. */
/**
 * The exact shapes the poller consumes: ids for the list fingerprint, the
 * inbox counter plus first-page ids, any JSON-serializable timetable.
 */
interface Fixtures {
	grades: Array<{ id: number }>;
	messagesUnread: { inbox: number; others?: Record<string, number> };
	messagesInbox: { messages: Array<{ messageId: string }>; total: number };
	notices: Array<{ id: string }>;
	attendance: Array<{ id: number }>;
	homework: Array<{ id: number }>;
	notes: Array<{ id: number }>;
	timetable: unknown;
	conferences: Array<{ id: number }>;
}

let fixtures: Fixtures;

function readerFixture() {
	const calls: string[] = [];
	const track = <T>(name: string, resolve: () => T) =>
		vi.fn(async (): Promise<T> => {
			calls.push(name);
			return resolve();
		});
	const readers = {
		grades: track("grades", () => fixtures.grades),
		messagesUnread: track("messagesUnread", () => fixtures.messagesUnread),
		messagesInbox: track("messagesInbox", () => fixtures.messagesInbox),
		notices: track("notices", () => fixtures.notices),
		attendance: track("attendance", () => fixtures.attendance),
		homework: track("homework", () => fixtures.homework),
		notes: track("notes", () => fixtures.notes),
		timetable: track("timetable", () => fixtures.timetable),
		conferences: track("conferences", () => fixtures.conferences),
	};
	return { readers, calls };
}

function makeDeps(
	overrides?: Partial<PollerDeps["readers"]>,
): PollerDeps & { sent: PushPayload[]; calls: string[] } {
	const { readers, calls } = readerFixture();
	const sent: PushPayload[] = [];
	return {
		weekStart: () => "2026-10-12",
		// Cast at the injection seam: fixtures carry the fields the poller reads.
		readers: { ...readers, ...overrides } as unknown as PollerDeps["readers"],
		sendPush: async (_env, _subscription, payload) => {
			sent.push(payload);
			return { gone: false };
		},
		now: () => new Date("2026-10-14T12:00:00Z"),
		sent,
		calls,
	};
}

const ALL_ON: PushPreferences = {
	grades: true,
	messages: true,
	notices: true,
	attendance: true,
	homework: true,
	notes: true,
	timetable: true,
	conferences: true,
};

async function seedAccount(): Promise<void> {
	await saveAccount(env.KV, {
		id: ACCOUNT_ID,
		firstName: "Anna",
		lastName: "Testowa",
		groupId: 8,
		jar: new CookieJar().toDTO(),
		createdAt: "2026-10-01T00:00:00Z",
	});
	await savePushSubscription(env.KV, ACCOUNT_ID, {
		endpoint: "https://push.example/endpoint-1",
		keys: { p256dh: "k-p256dh", auth: "k-auth" },
		createdAt: "2026-10-01T00:00:00Z",
	});
	await savePushPreferences(env.KV, ACCOUNT_ID, { ...ALL_ON });
}

beforeEach(async () => {
	fixtures = {
		grades: [{ id: 1 }],
		messagesUnread: { inbox: 2, others: {} },
		messagesInbox: { messages: [{ messageId: "11" }, { messageId: "12" }], total: 2 },
		notices: [{ id: "n1" }],
		attendance: [{ id: 5 }],
		homework: [{ id: 7 }],
		notes: [{ id: 3 }],
		timetable: { days: [] },
		conferences: [{ id: 9 }],
	};
	// Clean every key this suite owns (KV persists across tests in workerd).
	const prefixes = [
		`account:${ACCOUNT_ID}`,
		`pushsub:${ACCOUNT_ID}`,
		`prefs:${ACCOUNT_ID}`,
		`cronstate:${ACCOUNT_ID}`,
	];
	for (const prefix of prefixes) {
		const list = await env.KV.list({ prefix });
		await Promise.all(list.keys.map((key) => env.KV.delete(key.name)));
	}
	await seedAccount();
});

describe("push poller — diff", () => {
	it("baseline poll pushes nothing; changing all 8 pushes once per type; identical poll pushes nothing", async () => {
		const deps = makeDeps();

		await pollAccount(env.KV, ACCOUNT_ID, env, deps);
		expect(deps.sent).toEqual([]); // baseline silently stored

		// Every resource changes: 8 fixture scenarios in one poll.
		fixtures = {
			grades: [{ id: 1 }, { id: 2 }],
			messagesUnread: { inbox: 3, others: {} },
			messagesInbox: {
				messages: [{ messageId: "11" }, { messageId: "12" }, { messageId: "13" }],
				total: 3,
			},
			notices: [{ id: "n1" }, { id: "n2" }],
			attendance: [{ id: 5 }, { id: 6 }],
			homework: [{ id: 7 }, { id: 8 }],
			notes: [{ id: 3 }, { id: 4 }],
			timetable: { days: [{ lessons: [] }] },
			conferences: [{ id: 9 }, { id: 10 }],
		};
		await pollAccount(env.KV, ACCOUNT_ID, env, deps);
		expect(deps.sent).toHaveLength(8);
		expect(new Set(deps.sent.map((p) => p.url))).toEqual(new Set(Object.values(DEEPLINKS)));
		expect(deps.sent.find((p) => p.url === "/grades")?.title).toBe(PUSH_COPY.grades.title);
		expect(deps.sent.find((p) => p.url === "/messages")?.title).toBe(PUSH_COPY.messages.title);
		expect(deps.sent.find((p) => p.url === "/more/notices")?.title).toBe(PUSH_COPY.notices.title);

		// Second poll of the SAME state: zero notifications, no duplicates.
		await pollAccount(env.KV, ACCOUNT_ID, env, deps);
		expect(deps.sent).toHaveLength(8);
	});

	it("a type switched off is silent while the others still push", async () => {
		await savePushPreferences(env.KV, ACCOUNT_ID, { ...ALL_ON, grades: false });
		const deps = makeDeps();

		await pollAccount(env.KV, ACCOUNT_ID, env, deps); // baseline
		fixtures = { ...fixtures, grades: [{ id: 1 }, { id: 99 }], notes: [{ id: 3 }, { id: 33 }] };
		await pollAccount(env.KV, ACCOUNT_ID, env, deps);

		expect(deps.sent.map((p) => p.url)).toEqual(["/more/notes"]); // grades muted
	});
});

describe("push poller — expired jar", () => {
	it("sends exactly one 'sesja wygasła' push, suspends the account, and resumes after reset", async () => {
		const deps = makeDeps();
		await pollAccount(env.KV, ACCOUNT_ID, env, deps); // baseline with a live jar

		const expired = new LibrusError("SESSION_EXPIRED", 401);
		deps.readers.grades = async () => {
			throw expired;
		};
		await pollAccount(env.KV, ACCOUNT_ID, env, deps);
		expect(deps.sent).toHaveLength(1);
		expect(deps.sent[0]?.title).toBe("Sesja Librusa wygasła");
		expect(deps.sent[0]?.url).toBe("/");
		const callsAfterExpiry = deps.calls.length;

		// Suspended: the next poll never reaches the readers.
		const suspended = await loadCronState(env.KV, ACCOUNT_ID);
		expect(suspended.suspended).toBe(true);
		await pollAccount(env.KV, ACCOUNT_ID, env, deps);
		expect(deps.sent).toHaveLength(1); // no second "wygasła" push
		expect(deps.calls.length).toBe(callsAfterExpiry); // readers untouched

		// A fresh jar (login/refresh) un-suspends: the poller reads again.
		await resetCronSuspension(env.KV, ACCOUNT_ID);
		const liveAgain = makeDeps();
		await pollAccount(env.KV, ACCOUNT_ID, env, liveAgain);
		expect(liveAgain.sent).toEqual([]); // data unchanged -> no storm of pushes
		expect(liveAgain.calls.length).toBeGreaterThan(0);
	});
});

describe("push poller — call registry", () => {
	it("polls metadata readers only (lists and counters, never message content)", async () => {
		const deps = makeDeps();
		await pollAccount(env.KV, ACCOUNT_ID, env, deps);

		// The complete registry of readers a poll may touch. There is no
		// message-detail/content reader here — and none exists on the deps
		// interface either, so content reads are unreachable for the cron.
		const METADATA_READERS = new Set([
			"grades",
			"messagesUnread",
			"messagesInbox",
			"notices",
			"attendance",
			"homework",
			"notes",
			"timetable",
			"conferences",
		]);
		for (const name of deps.calls) {
			expect(METADATA_READERS.has(name), `unexpected reader: ${name}`).toBe(true);
		}
		// And every tracked resource was actually polled.
		expect(deps.calls).toContain("messagesUnread");
		expect(deps.calls).toContain("messagesInbox");
		expect(deps.calls).not.toContain("messageDetail");
	});

	it("keeps last-seen writes to polls that actually changed something", async () => {
		const deps = makeDeps();
		await pollAccount(env.KV, ACCOUNT_ID, env, deps);
		const afterBaseline = await loadCronState(env.KV, ACCOUNT_ID);
		expect(afterBaseline.lastSeen.grades).toBeDefined();

		await pollAccount(env.KV, ACCOUNT_ID, env, deps); // no change
		const afterIdle = await loadCronState(env.KV, ACCOUNT_ID);
		expect(afterIdle).toEqual({ ...defaultCronState(), lastSeen: afterBaseline.lastSeen });
	});
});

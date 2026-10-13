/**
 * Calendar readers: `Calendars` (list of calendar refs) and
 * `Calendars/ClassFreeDays` (free days of the class).
 *
 * The audit sampled empty arrays for both, so the element shape is not
 * observed: normalization is defensive — an element needs an Id and a Date
 * to count, everything else is optional and nullable.
 */
import type { CookieJar } from "./cookie-jar";
import { gatewayRequest } from "./gateway";
import type { HttpDeps } from "./http";

export interface CalendarRef {
	id: string | number | null;
	url: string | null;
}

export interface ClassFreeDay {
	id: string | number | null;
	/** YYYY-MM-DD (or a longer ISO string). */
	date: string;
	name: string | null;
}

function asString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

/** Reads and normalizes /Calendars (calendar references). */
export async function readCalendars(jar: CookieJar, deps?: HttpDeps): Promise<CalendarRef[]> {
	const { body } = await gatewayRequest(jar, "Calendars", deps);
	const envelope = body as { Calendars?: unknown };
	const list = Array.isArray(envelope.Calendars) ? envelope.Calendars : [];
	return list.map((raw) => {
		const e = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
		const id = e.Id;
		return {
			id: typeof id === "string" || typeof id === "number" ? id : null,
			url: asString(e.Url),
		};
	});
}

/** Reads and normalizes /Calendars/ClassFreeDays. */
export async function readClassFreeDays(jar: CookieJar, deps?: HttpDeps): Promise<ClassFreeDay[]> {
	const { body } = await gatewayRequest(jar, "Calendars/ClassFreeDays", deps);
	const envelope = body as { ClassFreeDays?: unknown };
	const list = Array.isArray(envelope.ClassFreeDays) ? envelope.ClassFreeDays : [];
	const days: ClassFreeDay[] = [];
	for (const raw of list) {
		if (typeof raw !== "object" || raw === null) continue;
		const e = raw as Record<string, unknown>;
		const id = e.Id;
		const date = asString(e.Date);
		if (id === undefined || date === null) continue;
		days.push({
			id: typeof id === "string" || typeof id === "number" ? id : null,
			date: date.slice(0, 10),
			name: asString(e.Name),
		} satisfies ClassFreeDay);
	}
	return days;
}

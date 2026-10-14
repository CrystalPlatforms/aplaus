/**
 * Parent-teacher conferences reader: `/ParentTeacherConferences` (zebrania).
 *
 * Shape per audit: `{ ParentTeacherConferences: [{ Id, Date, Name,
 * Class: {Id, Url}, Teacher: {Id, Url}, Topic, Room, Time }], Resources, Url }`.
 */
import type { CookieJar } from "./cookie-jar";
import { gatewayRequest } from "./gateway";
import type { HttpDeps } from "./http";

/** One parent-teacher conference, normalized. */
export interface ParentTeacherConference {
	id: number;
	date: string;
	name: string;
	classId: number | null;
	teacherId: number | null;
	teacherName: string | null;
	topic: string | null;
	room: string | null;
	time: string | null;
}

function asString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
	return typeof value === "number" ? value : null;
}

function resourceOf(
	resources: Record<string, unknown>,
	ref: unknown,
): Record<string, unknown> | null {
	if (typeof ref !== "object" || ref === null) return null;
	const url = (ref as { Url?: unknown }).Url;
	if (typeof url !== "string") return null;
	const direct = resources[url];
	if (typeof direct === "object" && direct !== null) return direct as Record<string, unknown>;
	const path = url.replace(/^https?:\/\/[^/]+/, "").toLowerCase();
	for (const [key, value] of Object.entries(resources)) {
		if (typeof value !== "object" || value === null) continue;
		const keyPath = key.replace(/^https?:\/\/[^/]+/, "").toLowerCase();
		if (keyPath === path || key.endsWith(path) || path.endsWith(keyPath)) {
			return value as Record<string, unknown>;
		}
	}
	return null;
}

function personNameOf(resources: Record<string, unknown>, ref: unknown): string | null {
	const person = resourceOf(resources, ref);
	if (!person) return null;
	const first = asString(person.FirstName);
	const last = asString(person.LastName);
	return [first, last].filter(Boolean).join(" ") || null;
}

function inlinePersonNameOf(ref: unknown): string | null {
	if (typeof ref !== "object" || ref === null) return null;
	const inline = ref as { FirstName?: unknown; LastName?: unknown; Name?: unknown };
	const composed = [asString(inline.FirstName), asString(inline.LastName)]
		.filter(Boolean)
		.join(" ");
	return composed || asString(inline.Name);
}

function refId(ref: unknown): number | null {
	if (typeof ref !== "object" || ref === null) return null;
	const id = (ref as { Id?: unknown }).Id;
	return typeof id === "number" ? id : null;
}

function normalizeConference(
	raw: unknown,
	resources: Record<string, unknown>,
): ParentTeacherConference | null {
	if (typeof raw !== "object" || raw === null) return null;
	const c = raw as Record<string, unknown>;
	const id = asNumber(c.Id);
	if (id === null) return null;
	return {
		id,
		date: asString(c.Date) ?? "",
		name: asString(c.Name) ?? "",
		classId: refId(c.Class),
		teacherId: refId(c.Teacher),
		teacherName: inlinePersonNameOf(c.Teacher) ?? personNameOf(resources, c.Teacher),
		topic: asString(c.Topic),
		room: asString(c.Room),
		time: asString(c.Time),
	};
}

/** Reads and normalizes /ParentTeacherConferences. */
export async function readParentTeacherConferences(
	jar: CookieJar,
	deps?: HttpDeps,
): Promise<ParentTeacherConference[]> {
	const { body } = await gatewayRequest(jar, "ParentTeacherConferences", deps);
	const envelope = body as { ParentTeacherConferences?: unknown; Resources?: unknown };
	const list = Array.isArray(envelope.ParentTeacherConferences)
		? envelope.ParentTeacherConferences
		: [];
	const resources =
		typeof envelope.Resources === "object" && envelope.Resources !== null
			? (envelope.Resources as Record<string, unknown>)
			: {};
	return list
		.map((raw) => normalizeConference(raw, resources))
		.filter((c): c is ParentTeacherConference => c !== null);
}

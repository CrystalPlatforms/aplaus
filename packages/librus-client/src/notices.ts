/**
 * School notices reader: `/SchoolNotices`.
 *
 * Shape per audit: `{ SchoolNotices: [{ Id, StartDate, EndDate, Subject,
 * Content, AddedBy: {Id, Url}, CreationDate, WasRead }], Resources, Url }`.
 * Here `Id` is a string — unlike most G resources, where it is a number.
 */
import type { CookieJar } from "./cookie-jar";
import { gatewayRequest } from "./gateway";
import type { HttpDeps } from "./http";

/** One school notice, normalized. */
export interface SchoolNotice {
	id: string;
	subject: string;
	content: string;
	/** First day the notice is in force. */
	startDate: string;
	/** Last day the notice is in force. */
	endDate: string;
	creationDate: string;
	wasRead: boolean;
	addedById: number | null;
	addedByName: string | null;
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
	// Tolerant fallback: the ref URL and the Resources keys do not always agree
	// on host/scheme — compare the path part instead.
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

function normalizeNotice(raw: unknown, resources: Record<string, unknown>): SchoolNotice | null {
	if (typeof raw !== "object" || raw === null) return null;
	const n = raw as Record<string, unknown>;
	const id = asString(n.Id) ?? (asNumber(n.Id) !== null ? String(n.Id) : null);
	if (id === null) return null;
	return {
		id,
		subject: asString(n.Subject) ?? "",
		content: asString(n.Content) ?? "",
		startDate: asString(n.StartDate) ?? "",
		endDate: asString(n.EndDate) ?? "",
		creationDate: asString(n.CreationDate) ?? "",
		wasRead: n.WasRead === true,
		addedById: refId(n.AddedBy),
		addedByName: inlinePersonNameOf(n.AddedBy) ?? personNameOf(resources, n.AddedBy),
	};
}

/** Reads and normalizes /SchoolNotices; the AddedBy name resolves via Resources. */
export async function readSchoolNotices(jar: CookieJar, deps?: HttpDeps): Promise<SchoolNotice[]> {
	const { body } = await gatewayRequest(jar, "SchoolNotices", deps);
	const envelope = body as { SchoolNotices?: unknown; Resources?: unknown };
	const list = Array.isArray(envelope.SchoolNotices) ? envelope.SchoolNotices : [];
	const resources =
		typeof envelope.Resources === "object" && envelope.Resources !== null
			? (envelope.Resources as Record<string, unknown>)
			: {};
	return list
		.map((raw) => normalizeNotice(raw, resources))
		.filter((n): n is SchoolNotice => n !== null);
}

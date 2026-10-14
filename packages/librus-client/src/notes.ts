/**
 * Notes reader: `/Notes` (uwagi).
 *
 * The element shape was never observed: every audited account answered with
 * an empty array (the same situation as ClassFreeDays in phase 4). The parser
 * is defensive accordingly — an item counts when it carries a numeric `Id`,
 * every other field is optional and null when absent or of a surprise type.
 */
import type { CookieJar } from "./cookie-jar";
import { gatewayRequest } from "./gateway";
import type { HttpDeps } from "./http";

/** One note (uwaga), normalized. Only `id` is guaranteed. */
export interface Note {
	id: number;
	content: string | null;
	addedDate: string | null;
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

function normalizeNote(raw: unknown, resources: Record<string, unknown>): Note | null {
	if (typeof raw !== "object" || raw === null) return null;
	const n = raw as Record<string, unknown>;
	const id = asNumber(n.Id);
	if (id === null) return null;
	return {
		id,
		content: asString(n.Content),
		addedDate: asString(n.DateAdded) ?? asString(n.AddDate),
		addedById: refId(n.AddedBy),
		addedByName: inlinePersonNameOf(n.AddedBy) ?? personNameOf(resources, n.AddedBy),
	};
}

/** Reads and normalizes /Notes; empty on accounts with no notes. */
export async function readNotes(jar: CookieJar, deps?: HttpDeps): Promise<Note[]> {
	const { body } = await gatewayRequest(jar, "Notes", deps);
	const envelope = body as { Notes?: unknown; Resources?: unknown };
	const list = Array.isArray(envelope.Notes) ? envelope.Notes : [];
	const resources =
		typeof envelope.Resources === "object" && envelope.Resources !== null
			? (envelope.Resources as Record<string, unknown>)
			: {};
	return list.map((raw) => normalizeNote(raw, resources)).filter((n): n is Note => n !== null);
}

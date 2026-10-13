/**
 * Attendance readers: `Attendances` and `Attendances/Types`.
 *
 * G envelope per audit: `{ Attendances: [...], Resources, Url }` and
 * `{ Types: [...], Resources, Url }`.
 */
import type { CookieJar } from "./cookie-jar";
import { gatewayRequest } from "./gateway";
import type { HttpDeps } from "./http";

/** One attendance record, normalized. */
export interface Attendance {
	id: number;
	lessonId: number | null;
	/** YYYY-MM-DD or a longer ISO string. */
	date: string;
	addDate: string;
	lessonNo: number | null;
	semester: number;
	typeId: number | null;
	addedById: number | null;
}

/**
 * One attendance type from the account's type dictionary. `identifier` is
 * the semantic key Librus uses ("presence", "absence",
 * "absence_unexcused", "lateness"); null when the account's dictionary
 * doesn't carry it.
 */
export interface AttendanceType {
	id: number;
	name: string;
	short: string | null;
	standard: boolean;
	/** Resolved color: ColorRGB inline or the Color ref resolved via Resources. */
	colorHex: string | null;
	isPresenceKind: boolean;
	order: number | null;
	identifier: string | null;
}

function asString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
	return typeof value === "number" ? value : null;
}

function refId(ref: unknown): number | null {
	if (typeof ref !== "object" || ref === null) return null;
	const id = (ref as { Id?: unknown }).Id;
	return typeof id === "number" ? id : null;
}

function normalizeAttendance(raw: unknown): Attendance | null {
	if (typeof raw !== "object" || raw === null) return null;
	const a = raw as Record<string, unknown>;
	const id = asNumber(a.Id);
	if (id === null) return null;
	return {
		id,
		lessonId: refId(a.Lesson),
		date: asString(a.Date) ?? "",
		addDate: asString(a.AddDate) ?? "",
		lessonNo: asNumber(a.LessonNo),
		semester: asNumber(a.Semester) ?? 0,
		typeId: refId(a.Type),
		addedById: refId(a.AddedBy),
	};
}

/**
 * Reads and normalizes /Attendances. Type names/colors resolve through
 * Resources when present.
 */
export async function readAttendances(jar: CookieJar, deps?: HttpDeps): Promise<Attendance[]> {
	const { body } = await gatewayRequest(jar, "Attendances", deps);
	const envelope = body as { Attendances?: unknown };
	const list = Array.isArray(envelope.Attendances) ? envelope.Attendances : [];
	return list.map(normalizeAttendance).filter((a): a is Attendance => a !== null);
}

function colorOf(raw: unknown, resources: Record<string, unknown>): string | null {
	const rgb = asString((raw as Record<string, unknown>)?.ColorRGB);
	if (rgb) return rgb;
	const colorRef = (raw as Record<string, unknown>)?.Color;
	if (typeof colorRef !== "object" || colorRef === null) return null;
	const url = asString((colorRef as Record<string, unknown>).Url);
	const found = url ? resources[url] : undefined;
	const hex = asString((found as Record<string, unknown> | undefined)?.ColorRGB);
	return hex;
}

function normalizeType(raw: unknown, resources: Record<string, unknown>): AttendanceType | null {
	if (typeof raw !== "object" || raw === null) return null;
	const t = raw as Record<string, unknown>;
	const id = asNumber(t.Id);
	if (id === null) return null;
	return {
		id,
		name: asString(t.Name) ?? "",
		short: asString(t.Short),
		standard: t.Standard === true,
		colorHex: colorOf(t, resources),
		isPresenceKind: t.IsPresenceKind === true,
		order: asNumber(t.Order),
		identifier: asString(t.Identifier),
	};
}

/** Reads and normalizes /Attendances/Types. */
export async function readAttendanceTypes(
	jar: CookieJar,
	deps?: HttpDeps,
): Promise<AttendanceType[]> {
	const { body } = await gatewayRequest(jar, "Attendances/Types", deps);
	const envelope = body as { Types?: unknown; Resources?: unknown };
	const list = Array.isArray(envelope.Types) ? envelope.Types : [];
	const resources =
		typeof envelope.Resources === "object" && envelope.Resources !== null
			? (envelope.Resources as Record<string, unknown>)
			: {};
	return list
		.map((raw) => normalizeType(raw, resources))
		.filter((t): t is AttendanceType => t !== null);
}

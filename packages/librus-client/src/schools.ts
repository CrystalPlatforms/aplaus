/**
 * School reader: `/Schools`.
 *
 * Shape per audit: the payload key is the singular `School` — one object, not
 * a list — with the school meta and a `LessonsRange` array of period ranges.
 */
import type { CookieJar } from "./cookie-jar";
import { gatewayRequest } from "./gateway";
import type { HttpDeps } from "./http";

/** School meta, normalized. */
export interface School {
	id: number;
	name: string;
	town: string | null;
	street: string | null;
	buildingNumber: string | null;
	postCode: string | null;
	email: string | null;
	phoneNumber: string | null;
	schoolYear: number | null;
	/** "Jan Kowalski" from NameHeadTeacher + SurnameHeadTeacher. */
	headTeacherName: string | null;
	/** First LessonsRange entry: period bounds as clock strings. */
	lessonsFrom: string | null;
	lessonsTo: string | null;
}

function asString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
	return typeof value === "number" ? value : null;
}

/** Reads /Schools; null when the account answers without a School object. */
export async function readSchool(jar: CookieJar, deps?: HttpDeps): Promise<School | null> {
	const { body } = await gatewayRequest(jar, "Schools", deps);
	const envelope = body as { School?: unknown };
	if (typeof envelope.School !== "object" || envelope.School === null) return null;
	const s = envelope.School as Record<string, unknown>;
	const id = asNumber(s.Id);
	if (id === null) return null;
	const headFirst = asString(s.NameHeadTeacher);
	const headLast = asString(s.SurnameHeadTeacher);
	const lessonsRange = Array.isArray(s.LessonsRange) ? s.LessonsRange : [];
	const firstRange =
		lessonsRange.find(
			(r): r is Record<string, unknown> => typeof r === "object" && r !== null && "From" in r,
		) ?? null;
	return {
		id,
		name: asString(s.Name) ?? "",
		town: asString(s.Town),
		street: asString(s.Street),
		buildingNumber: asString(s.BuildingNumber),
		postCode: asString(s.PostCode),
		email: asString(s.Email),
		phoneNumber: asString(s.PhoneNumber),
		schoolYear: asNumber(s.SchoolYear),
		headTeacherName: [headFirst, headLast].filter(Boolean).join(" ") || null,
		lessonsFrom: firstRange ? asString(firstRange.From) : null,
		lessonsTo: firstRange ? asString(firstRange.To) : null,
	};
}

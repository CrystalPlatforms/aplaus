/**
 * Attendance statistics: counts per semantic category (mapped from the
 * type's Identifier in Attendances/Types) and per concrete type.
 */
import type { Attendance, AttendanceType } from "@repo/librus-client";

export interface AttendanceStats {
	/** IsPresenceKind types ("presence"). */
	presence: number;
	/** "absence" — excused absences. */
	excused: number;
	/** "absence_unexcused". */
	unexcused: number;
	/** "lateness". */
	lateness: number;
	/** Count per concrete type, named from Attendances/Types. */
	perType: { id: number; name: string; count: number }[];
}

/**
 * Maps a type to the semantic category using every signal the dictionary
 * carries: Identifier first, then the Polish name, then the short code —
 * real accounts return identifiers that are null or localized, which is why
 * identifier-equality alone counted zeros. Unknown types stay outside the
 * four headline numbers (still counted in perType).
 */
function categoryOf(type: AttendanceType | undefined): keyof AttendanceStats | null {
	if (!type) return null;
	const identifier = (type.identifier ?? "").toLowerCase();
	const name = type.name.toLowerCase();
	const short = (type.short ?? "").toLowerCase();

	// Unexcused must be checked before the generic absence — its identifier
	// and name both contain the absence stem.
	if (
		identifier.includes("unexcused") ||
		name.includes("nieusprawiedliw") ||
		short === "bu" ||
		short === "b.u."
	) {
		return "unexcused";
	}
	// Absence before presence: "nieobecność" contains the "obecn" stem.
	if (
		identifier.includes("absence") ||
		identifier.includes("nieobecn") ||
		name.includes("nieobecn") ||
		short === "nb" ||
		short === "u"
	) {
		return "excused";
	}
	if (identifier.includes("late") || name.includes("spóź") || short === "sp") {
		return "lateness";
	}
	if (type.isPresenceKind || identifier.includes("presence") || name.includes("obecn")) {
		return "presence";
	}
	return null;
}

/**
 * Counts attendance records. `semester` filters to one semester; without it
 * both semesters count together. No records -> all zeros, never an error.
 */
export function computeAttendanceStats(
	attendances: Attendance[],
	types: AttendanceType[],
	semester?: number,
): AttendanceStats {
	const scoped =
		semester === undefined ? attendances : attendances.filter((a) => a.semester === semester);
	const typeById = new Map(types.map((t) => [t.id, t]));
	const perType = new Map<number, number>();
	const stats: AttendanceStats = {
		presence: 0,
		excused: 0,
		unexcused: 0,
		lateness: 0,
		perType: [],
	};
	for (const record of scoped) {
		if (record.typeId === null) continue;
		perType.set(record.typeId, (perType.get(record.typeId) ?? 0) + 1);
		const type = typeById.get(record.typeId);
		const category = categoryOf(type);
		if (category === "presence") stats.presence += 1;
		else if (category === "excused") stats.excused += 1;
		else if (category === "unexcused") stats.unexcused += 1;
		else if (category === "lateness") stats.lateness += 1;
	}
	stats.perType = [...perType.entries()]
		.map(([id, count]) => ({ id, name: typeById.get(id)?.name ?? String(id), count }))
		.sort((a, b) => b.count - a.count);
	return stats;
}

/** Distinct semesters found in the records, ascending. */
export function attendanceSemesters(attendances: Attendance[]): number[] {
	return [...new Set(attendances.map((a) => a.semester))].sort((a, b) => a - b);
}

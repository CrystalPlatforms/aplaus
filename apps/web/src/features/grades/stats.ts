/**
 * Grade statistics. Only grades with IsConstituent count toward averages;
 * empty data yields null (never NaN).
 */
import type { Grade } from "@repo/librus-client";

/**
 * Parses a grade label to a number: "5" -> 5, "4+" -> 4.5, "3-" -> 2.75.
 * Non-numeric labels ("bz", "np") return null.
 */
export function parseGradeValue(grade: string): number | null {
	const trimmed = grade.trim();
	if (!trimmed) return null;
	const base = Number.parseFloat(trimmed);
	if (Number.isNaN(base)) return null;
	if (trimmed.endsWith("+")) return base + 0.5;
	if (trimmed.endsWith("-")) return base - 0.25;
	return base;
}

export interface GradeStats {
	average: number | null;
	count: number;
}

function statsOf(grades: Grade[]): GradeStats {
	const values = grades
		.filter((g) => g.isConstituent)
		.map((g) => parseGradeValue(g.grade))
		.filter((v): v is number => v !== null);
	if (values.length === 0) return { average: null, count: 0 };
	const sum = values.reduce((a, b) => a + b, 0);
	return { average: Math.round((sum / values.length) * 100) / 100, count: values.length };
}

export function computeSemesterStats(grades: Grade[]): Record<string, GradeStats> {
	const grouped = new Map<number, Grade[]>();
	for (const grade of grades) {
		const list = grouped.get(grade.semester) ?? [];
		list.push(grade);
		grouped.set(grade.semester, list);
	}
	const result: Record<string, GradeStats> = {};
	for (const [semester, list] of grouped) {
		result[String(semester)] = statsOf(list);
	}
	return result;
}

export function computeOverallStats(grades: Grade[]): GradeStats {
	return statsOf(grades);
}

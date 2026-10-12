import type { Grade, GradeCategory, GradeComment } from "@repo/librus-client";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface GradesView {
	grades: Grade[];
	categories: GradeCategory[];
	comments: GradeComment[];
}

export function useGrades() {
	return useQuery({
		queryKey: ["grades"],
		queryFn: () => apiFetch<GradesView>("/api/grades"),
	});
}

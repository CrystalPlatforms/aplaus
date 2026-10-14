import type { ClassInfo, Lesson, School, Subject } from "@repo/librus-client";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface SchoolOverviewView {
	school: School | null;
	classes: ClassInfo | null;
	lessons: Lesson[];
	subjects: Subject[];
}

export function useSchoolOverview() {
	return useQuery({
		queryKey: ["school"],
		queryFn: () => apiFetch<SchoolOverviewView>("/api/school/overview"),
	});
}

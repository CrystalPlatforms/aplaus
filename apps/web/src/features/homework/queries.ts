import type { HomeWork, HomeWorkAssignment } from "@repo/librus-client";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface HomeworkView {
	homeWorks: HomeWork[];
	assignments: HomeWorkAssignment[];
}

export function useHomework() {
	return useQuery({
		queryKey: ["homework"],
		queryFn: () => apiFetch<HomeworkView>("/api/homework"),
	});
}

import type { ParentTeacherConference } from "@repo/librus-client";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useConferences() {
	return useQuery({
		queryKey: ["conferences"],
		queryFn: () => apiFetch<ParentTeacherConference[]>("/api/school/conferences"),
	});
}

import type { SchoolNotice } from "@repo/librus-client";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useNotices() {
	return useQuery({
		queryKey: ["notices"],
		queryFn: () => apiFetch<SchoolNotice[]>("/api/school/notices"),
	});
}

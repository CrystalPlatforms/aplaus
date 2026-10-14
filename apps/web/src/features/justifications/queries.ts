import type { Justification } from "@repo/librus-client";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

/**
 * `enabled` gates the fetch: only a parent account (groupId 5) may ask for
 * justifications — a student gets 403, so the request must never leave.
 */
export function useJustifications(enabled: boolean) {
	return useQuery({
		queryKey: ["justifications"],
		queryFn: () => apiFetch<Justification[]>("/api/school/justifications"),
		enabled,
	});
}

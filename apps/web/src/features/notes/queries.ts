import type { Note } from "@repo/librus-client";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useNotes() {
	return useQuery({
		queryKey: ["notes"],
		queryFn: () => apiFetch<Note[]>("/api/school/notes"),
	});
}

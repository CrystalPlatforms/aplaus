import type { ClassFreeDay, Timetable } from "@repo/librus-client";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useTimetable(weekStart: string) {
	return useQuery({
		queryKey: ["timetable", weekStart],
		queryFn: () => apiFetch<Timetable>(`/api/timetable?weekStart=${encodeURIComponent(weekStart)}`),
	});
}

export function useClassFreeDays() {
	return useQuery({
		queryKey: ["free-days"],
		queryFn: () =>
			apiFetch<{ calendars: unknown[]; freeDays: ClassFreeDay[] }>("/api/calendar/free-days"),
	});
}

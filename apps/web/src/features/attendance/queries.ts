import type { Attendance, AttendanceType } from "@repo/librus-client";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface AttendanceView {
	attendances: Attendance[];
	types: AttendanceType[];
}

export function useAttendance() {
	return useQuery({
		queryKey: ["attendance"],
		queryFn: () => apiFetch<AttendanceView>("/api/attendance"),
	});
}

/**
 * Attendance proxy: jar from KV, readers from librus-client.
 */
import {
	type Attendance,
	type AttendanceType,
	CookieJar,
	readAttendances,
	readAttendanceTypes,
} from "@repo/librus-client";
import { loadAccount } from "@/kv/store";
import type { Result } from "../types/result";
import { toAppError } from "./librus-errors";

export interface AttendanceView {
	attendances: Attendance[];
	types: AttendanceType[];
}

/** Injectable boundary: the Librus readers. Tests replace them wholesale. */
export interface AttendanceDeps {
	readAttendances: typeof readAttendances;
	readAttendanceTypes: typeof readAttendanceTypes;
}

const defaultAttendanceDeps: AttendanceDeps = { readAttendances, readAttendanceTypes };

/** Reads attendance records + types in the active-account context. */
export async function getAttendance(
	kv: KVNamespace,
	accountId: string,
	deps: AttendanceDeps = defaultAttendanceDeps,
): Promise<Result<AttendanceView>> {
	const account = await loadAccount(kv, accountId);
	if (!account) {
		return {
			ok: false,
			error: {
				code: "SESSION_EXPIRED",
				message: "Sesja wygasła. Zaloguj się ponownie.",
				status: 401,
			},
		};
	}
	const jar = CookieJar.fromDTO(account.jar);
	try {
		const [attendances, types] = await Promise.all([
			deps.readAttendances(jar),
			deps.readAttendanceTypes(jar),
		]);
		return { ok: true, data: { attendances, types } };
	} catch (error) {
		return { ok: false, error: toAppError(error) };
	}
}

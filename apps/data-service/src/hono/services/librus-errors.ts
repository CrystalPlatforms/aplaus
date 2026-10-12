/**
 * LibrusError -> AppError mapping shared by every service that calls
 * librus-client. Services return Result<T>; handlers map to HTTP.
 */
import { isLibrusError, type LibrusErrorCode } from "@repo/librus-client";
import type { AppError } from "../types/result";

const CODE_MAP: Record<LibrusErrorCode, string> = {
	WRONG_CREDENTIALS: "WRONG_CREDENTIALS",
	SESSION_EXPIRED: "SESSION_EXPIRED",
	FORBIDDEN: "FORBIDDEN",
	NOT_FOUND: "NOT_FOUND",
	LOGIN_FAILED: "LIBRUS_UNAVAILABLE",
	UNEXPECTED_RESPONSE: "LIBRUS_UNAVAILABLE",
};

const STATUS_MAP: Record<string, number> = {
	WRONG_CREDENTIALS: 401,
	SESSION_EXPIRED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	LIBRUS_UNAVAILABLE: 502,
};

/** Maps a thrown error to Result-style AppError for service layer. */
export function toAppError(error: unknown): AppError {
	if (isLibrusError(error)) {
		const code = CODE_MAP[error.code];
		const status = STATUS_MAP[code] ?? 502;
		return { code, message: error.userMessage, status };
	}
	const message = error instanceof Error ? error.message : "Internal server error";
	return { code: "LIBRUS_UNAVAILABLE", message, status: 502 };
}

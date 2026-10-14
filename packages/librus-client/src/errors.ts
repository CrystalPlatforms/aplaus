/**
 * Error taxonomy for every way the Librus protocol can fail. Each code carries
 * a Polish user-facing message; the consumer (data-service, later the MCP
 * server) forwards it without inventing its own wording.
 *
 * Mapping from HTTP surface, checked before any parsing (per the audit):
 * - login 403 with `errors[]`  → WRONG_CREDENTIALS
 * - any gateway 401            → SESSION_EXPIRED
 * - any gateway 403            → FORBIDDEN
 * - any gateway 404            → NOT_FOUND
 */
export type LibrusErrorCode =
	| "WRONG_CREDENTIALS"
	| "SESSION_EXPIRED"
	| "FORBIDDEN"
	| "NOT_FOUND"
	| "LOGIN_FAILED"
	| "UNEXPECTED_RESPONSE";

const MESSAGES: Record<LibrusErrorCode, string> = {
	WRONG_CREDENTIALS: "Nieprawidłowy login lub hasło.",
	SESSION_EXPIRED: "Sesja Librusa wygasła. Zaloguj się ponownie.",
	FORBIDDEN: "Brak dostępu do tego zasobu.",
	NOT_FOUND: "Nie znaleziono zasobu.",
	LOGIN_FAILED: "Logowanie do Librusa nie powiodło się. Spróbuj ponownie.",
	UNEXPECTED_RESPONSE: "Librus zwrócił odpowiedź w niespodziewanym formacie.",
};

export class LibrusError extends Error {
	/** Szczegół PL dla UI (statusy/ścieżki/fragment odpowiedzi); null = domyślny. */
	readonly customMessage: string | null;

	constructor(
		public readonly code: LibrusErrorCode,
		public readonly status: number,
		message?: string,
	) {
		super(message ?? MESSAGES[code]);
		this.name = "LibrusError";
		this.customMessage = message ?? null;
	}

	/** The Polish message a UI can show as-is (custom detail wins over the default). */
	get userMessage(): string {
		return this.customMessage ?? MESSAGES[this.code];
	}
}

export function isLibrusError(error: unknown): error is LibrusError {
	return error instanceof LibrusError;
}

const API_URL = import.meta.env.VITE_API_URL ?? "";
const TOKEN_KEY = "aplaus.deviceToken";

class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string,
	) {
		super(message);
		this.name = "ApiError";
	}
}

export function getToken(): string | null {
	try {
		return localStorage.getItem(TOKEN_KEY);
	} catch {
		return null;
	}
}

export function setToken(token: string): void {
	try {
		localStorage.setItem(TOKEN_KEY, token);
	} catch {
		/* private mode: session-only login */
	}
}

export function clearToken(): void {
	try {
		localStorage.removeItem(TOKEN_KEY);
	} catch {
		/* noop */
	}
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const headers = new Headers(init?.headers);
	const token = getToken();
	if (token) headers.set("Authorization", `Bearer ${token}`);
	if (init?.body) headers.set("Content-Type", "application/json");
	const response = await fetch(`${API_URL}${path}`, { ...init, headers });
	if (!response.ok) {
		const payload = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
		throw new ApiError(
			response.status,
			payload.code ?? "UNKNOWN",
			payload.error ?? "Coś poszło nie tak.",
		);
	}
	return (await response.json()) as T;
}

/**
 * Tester diagnostyczny M (HITL r.3): odpytuje kandydujące endpointy listy
 * odbiorców, magazynu plików, etykiet i grup ŻYWĄ sesją M i zwraca statusy
 * z fragmentami surowych odpowiedzi — zamiast żądać od użytkownika
 * przechwytywania ruchu w DevTools. POST-y mogą utworzyć pozycje próbne o
 * nazwie „Probe-Aplaus”, gdy trasa okaże się właściwa (UI ostrzega i pozwala
 * je usunąć z list).
 */
import type { CookieJar } from "./cookie-jar";
import { LibrusError } from "./errors";
import { defaultDeps, type HttpDeps, walkRedirects } from "./http";
import { M_USER_AGENT } from "./messages";

/** One probed call: the method, the candidate path, the status, the snippet. */
export interface ProbeResult {
	method: "GET" | "POST" | "PUT";
	path: string;
	status: number;
	/** Up to 400 chars of the raw response; "(puste)" for an empty body. */
	body: string;
}

/** One probe call that never throws — errors become status 0 + the message. */
async function probeOnce(
	jar: CookieJar,
	method: "GET" | "POST" | "PUT",
	path: string,
	body: unknown,
	deps: HttpDeps,
): Promise<ProbeResult> {
	const headers: Record<string, string> = {
		Accept: "application/json",
		"User-Agent": M_USER_AGENT,
	};
	// Stare formularze Librusa mowia form-urlencoded — string w body jedzie
	// tak, obiekt jako JSON.
	const isForm = typeof body === "string";
	if (body !== undefined)
		headers["Content-Type"] = isForm ? "application/x-www-form-urlencoded" : "application/json";
	try {
		const walk = await walkRedirects(
			new URL(`https://wiadomosci.librus.pl/api/${path}`).toString(),
			{
				method,
				headers,
				body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
			},
			jar,
			deps,
		);
		const raw = await walk.response.text();
		return {
			method,
			path,
			status: walk.response.status,
			body: raw.trim() === "" ? "(puste)" : raw.slice(0, 400),
		};
	} catch (error) {
		const status = error instanceof LibrusError ? error.status : 0;
		const message = error instanceof Error ? error.message : "nieznany błąd";
		return { method, path, status, body: message.slice(0, 240) };
	}
}

/**
 * Probes every candidate endpoint worth confirming on a live account: the
 * sanity reads (me, receivers/types), the receiver-list candidates and the
 * write candidates for the files storage, tags and custom groups.
 */
export async function probeMessagesEndpoints(
	jar: CookieJar,
	typeId: string,
	deps: HttpDeps = defaultDeps,
): Promise<ProbeResult[]> {
	const encoded = encodeURIComponent(typeId);
	const probes: { method: "GET" | "POST" | "PUT"; path: string; body?: unknown }[] = [
		{ method: "GET", path: "me" },
		{ method: "GET", path: "receivers/types" },
		// Prawdziwe sciezki grup ze skanu kodu klienta (r.12).
		{ method: "GET", path: `receivers/groups/${encoded}` },
		{ method: "GET", path: `receivers/groups/jst-${encoded}` },
		// Stale nazwy grup z tabeli klienta (r.12) — mapping typow jest nieznany.
		{ method: "GET", path: "receivers/groups/teachers" },
		{ method: "GET", path: "receivers/groups/class-parents" },
		{ method: "GET", path: "receivers/groups/school-employees" },
		{ method: "GET", path: "receivers/groups/students-and-attendants" },
		// Reszta tabeli klienta: zbiorcza lista grup, lista ucznia, przedmioty.
		{ method: "GET", path: "receivers/groups" },
		{ method: "GET", path: "receivers/student-subjects" },
		{ method: "GET", path: "receivers/jst/subjects" },
		// Etykiety i grupy potwierdzone (r.15-16) — POST-proby usunięte, żeby
		// tester nie tworzył już pozycji próbnych.
		{ method: "GET", path: "tags" },
		{ method: "GET", path: "receivers/custom-groups" },
	];
	const results: ProbeResult[] = [];
	for (const probe of probes) {
		const result = await probeOnce(jar, probe.method, probe.path, probe.body, deps);
		results.push(result);
		// Członkowie grupy: gdy lista grup zwróci groupId, sprawdzamy odczyt
		// członków — kompozytor mógłby wtedy wybierać całe grupy osób.
		if (probe.method === "GET" && probe.path === "receivers/custom-groups") {
			const groupId = /"groupId"\s*:\s*(\d+)/.exec(result.body)?.[1];
			if (groupId !== undefined) {
				results.push(
					await probeOnce(jar, "GET", `receivers/custom-groups/${groupId}`, undefined, deps),
				);
				results.push(
					await probeOnce(
						jar,
						"GET",
						`receivers/custom-groups/${groupId}/receivers-management`,
						undefined,
						deps,
					),
				);
			}
		}
	}
	return results;
}

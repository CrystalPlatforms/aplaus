/**
 * Receivers of one type for the composer picker (issue #10 feedback: the user
 * picks PEOPLE from a category — no manual accountId entry).
 *
 * The audit verified only /receivers/types; it never LISTED receivers of a
 * type, so the collection path is not established. This reader tries the
 * plausible paths in order (404 falls through, like readMessageDetail) and
 * normalizes defensively — the HITL round-trip confirms which path the real
 * service answers.
 */
import type { CookieJar } from "./cookie-jar";
import { isLibrusError } from "./errors";
import { defaultDeps, type HttpDeps } from "./http";
import { idAsString, messagesRequest } from "./messages";

/** One person from a receiver-type list, normalized for the picker. */
export interface ReceiverEntry {
	typeId: string;
	accountId: string;
	name: string;
}

function asString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

/** accountId/receiverId/id under whatever key the endpoint used. */
function entryAccountIdOf(e: Record<string, unknown>): string | null {
	for (const key of [
		"accountId",
		"AccountId",
		"receiverId",
		"ReceiverId",
		"id",
		"Id",
		"userId",
		"UserId",
	]) {
		const id = idAsString(e[key]);
		if (id !== null) return id;
	}
	return null;
}

/** firstName+lastName / name / label — whatever the item carries. */
function entryNameOf(e: Record<string, unknown>): string {
	const direct = asString(e.name) ?? asString(e.Name) ?? asString(e.label);
	if (direct !== null && direct !== "") return direct;
	const first = asString(e.firstName) ?? asString(e.FirstName) ?? "";
	const last = asString(e.lastName) ?? asString(e.LastName) ?? "";
	const joined = [first, last]
		.filter((part) => part !== "")
		.join(" ")
		.trim();
	return joined !== "" ? joined : "?";
}

/**
 * Collects receiver items from every plausible envelope: a plain array, an
 * array under `data` or `data.list`, or an object-of-arrays grouped by type
 * id (the same shape the send body uses).
 */
function collectEntries(body: unknown, typeId: string): ReceiverEntry[] {
	const out: ReceiverEntry[] = [];
	const pushItem = (raw: unknown, groupTypeId: string): void => {
		if (typeof raw !== "object" || raw === null) return;
		const e = raw as Record<string, unknown>;
		const accountId = entryAccountIdOf(e);
		if (accountId === null) return;
		const itemTypeId = idAsString(e.typeId) ?? idAsString(e.type) ?? groupTypeId;
		out.push({ typeId: itemTypeId ?? typeId, accountId, name: entryNameOf(e) });
	};

	const consider = (value: unknown, groupTypeId: string | null): void => {
		if (Array.isArray(value)) {
			for (const raw of value) pushItem(raw, groupTypeId ?? typeId);
			return;
		}
		if (typeof value === "object" && value !== null && groupTypeId === null) {
			// Grouped: {"schoolReceivers": [{...}], ...} — keep only the wanted
			// type; porównanie bez wielkości liter. Klucze-generyczne
			// (receivers/list/items) zbieramy niezależnie od typu — to kontenery,
			// nie grupy (np. {receivers: [{accountId, label}]} kadry szkoły).
			for (const [key, entries] of Object.entries(value as Record<string, unknown>)) {
				const generic = key === "receivers" || key === "list" || key === "items";
				if (!generic && key.toLowerCase() !== typeId.toLowerCase()) continue;
				if (!Array.isArray(entries)) continue;
				for (const raw of entries) pushItem(raw, generic ? typeId : key);
			}
		}
	};

	const envelope = body as { data?: unknown; list?: unknown } | null;
	if (envelope !== null && typeof envelope === "object") {
		consider(envelope.data, null);
		const data = envelope.data;
		if (data !== null && typeof data === "object" && !Array.isArray(data)) {
			const nested = data as Record<string, unknown>;
			consider(nested.list, null);
			consider(nested.receivers, null);
		}
	}
	consider(body, null);
	return out;
}

function dedupe(entries: ReceiverEntry[]): ReceiverEntry[] {
	const seen = new Set<string>();
	const out: ReceiverEntry[] = [];
	for (const entry of entries) {
		const key = `${entry.typeId}/${entry.accountId}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(entry);
	}
	return out;
}

/**
 * Lists receivers of one type. None of the collection paths is audited — the
 * reader tries the plausible candidates in order (404 falls through) and
 * normalizes every shape defensively; an empty result means no candidate
 * answered with items (the HITL DevTools capture decides the real path).
 */
export async function readReceiversByType(
	jar: CookieJar,
	typeId: string,
	deps: HttpDeps = defaultDeps,
): Promise<ReceiverEntry[]> {
	// Pseudo-typ "group-{id}" = członkowie własnej grupy odbiorców
	// (prawa trasa ze skanu: /receivers/custom-groups/{id}/receivers-management).
	if (typeId.startsWith("group-")) {
		return readCustomGroupMembers(jar, typeId.slice("group-".length), deps);
	}
	// Nauczyciele i Wychowawcy ucznia: przedmioty z student-subjects + nazwiska
	// z kadry (ground truth r.16: obie listy 200 na koncie ucznia). Wychowawca
	// = nauczyciel z przedmiotem „Godzina wychowawcza”. Pozostałe kategorie
	// nie mają źródła na koncie ucznia — zostają puste (uczciwie).
	if (typeId === "teachers") {
		try {
			const joined = await readStudentTeachers(jar, deps);
			if (joined.length > 0) return joined;
		} catch (error) {
			if (!isLibrusError(error) || error.code !== "NOT_FOUND") throw error;
		}
	}
	if (typeId === "tutors") {
		try {
			const tutors = await readTutors(jar, deps);
			if (tutors.length > 0) return tutors;
		} catch (error) {
			if (!isLibrusError(error) || error.code !== "NOT_FOUND") throw error;
		}
	}
	// Kategorie pracowników bez dedykowanego źródła (Dyrektorzy, Bibliotekarz,
	// Inny specjalista, Admin...) — oficjalny Librus pozwala uczniowi pisać do
	// wszystkich pracowników, więc ich treścią jest lista kadry szkoły.
	// Rady rodziców (403 dla ucznia) zostają puste.
	if (typeId !== "parentsCouncil" && typeId !== "schoolParentsCouncil") {
		try {
			const staffBody = await messagesRequest(jar, "receivers/groups/school-employees", deps);
			const staff = dedupe(collectEntries(staffBody, typeId));
			if (staff.length > 0) return staff;
		} catch (error) {
			if (!isLibrusError(error) || error.code !== "NOT_FOUND") throw error;
		}
	}
	const encoded = encodeURIComponent(typeId);
	// Prawdziwe sciezki z kodu klienta (skan r.12): grupy pod
	// /receivers/groups/{grupa}; szkoly JST uzywaja prefiksu jst-.
	const paths = [
		`receivers/groups/${encoded}`,
		`receivers/groups/jst-${encoded}`,
		`receivers/${encoded}`,
		`receivers/types/${encoded}`,
		`receivers?type=${encoded}`,
		"receivers",
		// Kontrakty klienta (r.12): lista ucznia i przedmioty — dla konta
		// ucznia to prawdopodobnie WLASNIE lista odbiorcow (nauczyciele).
		"receivers/student-subjects",
		"receivers/jst/subjects",
		"receivers/groups",
	];
	for (const path of paths) {
		try {
			const body = await messagesRequest(jar, path, deps);
			const entries = collectEntries(body, typeId);
			if (entries.length > 0) return dedupe(entries);
		} catch (error) {
			if (isLibrusError(error) && error.code === "NOT_FOUND") continue;
			throw error;
		}
	}
	return [];
}

/**
 * Członkowie własnej grupy odbiorców — prawa trasa ze skanu kodu klienta:
 * GET /receivers/custom-groups/{id}/receivers-management.
 */
export async function readCustomGroupMembers(
	jar: CookieJar,
	groupId: string,
	deps: HttpDeps = defaultDeps,
): Promise<ReceiverEntry[]> {
	const body = await messagesRequest(
		jar,
		`receivers/custom-groups/${encodeURIComponent(groupId)}/receivers-management`,
		deps,
	);
	return dedupe(collectEntries(body, "schoolReceivers"));
}

/**
 * Nauczyciele ucznia: GET /receivers/student-subjects daje
 * {teacherIdentifier, subject}; nazwiska dobrane z kadry szkoły
 * (/receivers/groups/school-employees → {accountId, label}).
 */
interface StudentTeacher {
	accountId: string;
	label: string;
	subject: string;
}

async function readStudentTeachersRaw(jar: CookieJar, deps: HttpDeps): Promise<StudentTeacher[]> {
	const subjectsBody = await messagesRequest(jar, "receivers/student-subjects", deps);
	const subjects = (subjectsBody as { data?: unknown }).data;
	if (!Array.isArray(subjects)) return [];
	const labels = new Map<string, string>();
	try {
		const staffBody = await messagesRequest(jar, "receivers/groups/school-employees", deps);
		const staff = (staffBody as { receivers?: unknown }).receivers;
		if (Array.isArray(staff)) {
			for (const item of staff) {
				if (typeof item !== "object" || item === null) continue;
				const it = item as Record<string, unknown>;
				const id = idAsString(it.accountId) ?? idAsString(it.userId);
				const label = asString(it.label) ?? asString(it.name);
				if (id !== null && label !== null) labels.set(id, label);
			}
		}
	} catch {
		/* bez nazwisk — wpis pokaże sam przedmiot */
	}
	const out: StudentTeacher[] = [];
	for (const raw of subjects) {
		if (typeof raw !== "object" || raw === null) continue;
		const e = raw as Record<string, unknown>;
		const accountId = idAsString(e.teacherIdentifier) ?? idAsString(e.accountId);
		if (accountId === null) continue;
		out.push({
			accountId,
			subject: asString(e.subject) ?? "",
			label: labels.get(accountId) ?? "",
		});
	}
	return out;
}

/** Nauczyciele ucznia — nazwa z przedmiotem, np. „Banachewicz Ewa — Muzyka”. */
async function readStudentTeachers(jar: CookieJar, deps: HttpDeps): Promise<ReceiverEntry[]> {
	return (await readStudentTeachersRaw(jar, deps)).map((t) => ({
		typeId: "teachers",
		accountId: t.accountId,
		name: [t.label, t.subject].filter((part) => part !== "").join(" — ") || "?",
	}));
}

/** Wychowawca/y — nauczyciel z przedmiotem „Godzina wychowawcza”, samo nazwisko. */
async function readTutors(jar: CookieJar, deps: HttpDeps): Promise<ReceiverEntry[]> {
	return (await readStudentTeachersRaw(jar, deps))
		.filter((t) => t.subject.toLowerCase().includes("wychowawcza"))
		.map((t) => ({ typeId: "tutors", accountId: t.accountId, name: t.label || "?" }));
}

/**
 * Tool handlers for the local MCP server.
 *
 * Narrow interface (LibrusClientSurface) over the librus-client barrel: every
 * handler takes (surface, jar, args) and returns a typed object — no MCP SDK
 * types in here, so unit tests can drive handlers with a plain fixture object.
 * The stdio wiring lives in index.ts.
 */
import type {
	CookieJar,
	Grade,
	GradeCategory,
	GradeComment,
	HomeWork,
	HomeWorkAssignment,
	LibrusAccount,
	MessageListPage,
	SchoolNotice,
	Subject,
	Timetable,
	TimetableDay,
	UnreadCounts,
} from "@repo/librus-client";

/**
 * The slice of librus-client the tools need. Binding it as an interface keeps
 * the handlers testable at the module boundary (librus-client is the external
 * system here) without mocking HTTP fixtures per tool.
 */
export interface LibrusClientSurface {
	login(login: string, password: string): Promise<{ jar: CookieJar; account: LibrusAccount }>;
	readGrades(jar: CookieJar): Promise<Grade[]>;
	readSubjects(jar: CookieJar): Promise<Subject[]>;
	readGradeCategories(jar: CookieJar): Promise<GradeCategory[]>;
	readGradeComments(jar: CookieJar): Promise<GradeComment[]>;
	readTimetable(jar: CookieJar, weekStart: string): Promise<Timetable>;
	establishMessagesSession(gJar: CookieJar): Promise<CookieJar>;
	readInboxMessages(jar: CookieJar, page: number, limit: number): Promise<MessageListPage>;
	readUnreadMessagesCount(jar: CookieJar): Promise<UnreadCounts>;
	readHomeWorks(jar: CookieJar): Promise<HomeWork[]>;
	readHomeWorkAssignments(jar: CookieJar): Promise<HomeWorkAssignment[]>;
	readSchoolNotices(jar: CookieJar): Promise<SchoolNotice[]>;
}

/* ------------------------------ date helpers ------------------------------ */

/** YYYY-MM-DD of the given epoch in the machine's local timezone. */
export function localDateOf(epochMs: number): string {
	const date = new Date(epochMs);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

/** Shifts a YYYY-MM-DD date by whole days (local calendar, DST-safe enough for ±60). */
export function addDays(dateStr: string, days: number): string {
	const date = new Date(`${dateStr}T12:00:00`);
	date.setDate(date.getDate() + days);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Monday starting the ISO week that contains the date (Librus weeks run
 * Monday-first; Sunday is day 7 of the week opened by the previous Monday).
 */
export function mondayOf(dateStr: string): string {
	const date = new Date(`${dateStr}T12:00:00`);
	// getDay(): Sun=0..Sat=6 → shift so Mon=0..Sun=6, then step back that many days.
	const sinceMonday = (date.getDay() + 6) % 7;
	return addDays(dateStr, -sinceMonday);
}

/**
 * Lowercase without Polish diacritics — "Matematyka", "matematyka" and
 * "MATEMATYKA" must match. NFD decomposes ą→a + combining mark; dropping the
 * combining marks finishes the fold.
 */
export function normalizeText(text: string): string {
	return (
		text
			.toLowerCase()
			.normalize("NFD")
			.replace(/\p{Combining_Mark}/gu, "")
			// Ł has no NFD decomposition (a stroke, not a diacritic) — fold it by hand.
			.replaceAll("ł", "l")
	);
}

/* --------------------------------- grades --------------------------------- */

export interface GradesBySubjectArgs {
	/** Fragment nazwy przedmiotu (bez ogonków, duża/mała litera bez znaczenia). */
	subject?: string;
}

export interface GradesBySubjectResult {
	/** Filtr po normalizacji; null gdy narzędzie zawróciło wszystkie oceny. */
	subject: string | null;
	count: number;
	/** Gdy filtr nic nie trafił: nazwy przedmiotów, które w ogóle mają oceny. */
	availableSubjects: string[];
	grades: Array<{
		subject: string | null;
		grade: string;
		date: string;
		category: string | null;
		comments: string[];
		teacher: string | null;
		semester: number;
		countsToAverage: boolean;
		isFinal: boolean;
		isSemester: boolean;
	}>;
}

/** „Oceny z przedmiotu” — wszystkie oceny, filtr po fragmencie nazwy przedmiotu. */
export async function gradesBySubject(
	surface: LibrusClientSurface,
	jar: CookieJar,
	args: GradesBySubjectArgs,
): Promise<GradesBySubjectResult> {
	const [grades, subjects, categories, comments] = await Promise.all([
		surface.readGrades(jar),
		surface.readSubjects(jar),
		surface.readGradeCategories(jar),
		surface.readGradeComments(jar),
	]);
	const subjectNames = nameIndex(subjects);
	const categoryNames = nameIndex(categories);
	const commentsByGrade = groupCommentsByGrade(comments);

	const filter = args.subject ? normalizeText(args.subject.trim()) : null;
	const matched = grades.filter(
		(grade) =>
			filter === null ||
			(grade.subjectName !== null && normalizeText(grade.subjectName).includes(filter)),
	);
	// A filter that misses everything returns the menu of subjects that do have
	// grades — the model can then correct itself instead of asking again.
	const available =
		filter !== null && matched.length === 0
			? [...new Set(grades.map((g) => g.subjectName).filter((n): n is string => n !== null))]
			: [];

	const sorted = [...matched].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
	return {
		subject: filter,
		count: matched.length,
		availableSubjects: available,
		grades: sorted.map((grade) => gradeRow(grade, subjectNames, categoryNames, commentsByGrade)),
	};
}

/** {id, name} dictionaries (subjects, categories) as a lookup map. */
function nameIndex(items: Array<{ id: number; name: string }>): Map<number, string> {
	const map = new Map<number, string>();
	for (const item of items) map.set(item.id, item.name);
	return map;
}

/** Grade comments indexed by the grade they belong to; empty texts dropped. */
function groupCommentsByGrade(
	comments: Awaited<ReturnType<LibrusClientSurface["readGradeComments"]>>,
): Map<number, string[]> {
	const map = new Map<number, string[]>();
	for (const comment of comments) {
		if (comment.gradeId === null || comment.text === null || comment.text === "") continue;
		const list = map.get(comment.gradeId) ?? [];
		list.push(comment.text);
		map.set(comment.gradeId, list);
	}
	return map;
}

/** One row of the grades tool result, dictionaries pre-resolved. */
function gradeRow(
	grade: Awaited<ReturnType<LibrusClientSurface["readGrades"]>>[number],
	subjectNames: Map<number, string>,
	categoryNames: Map<number, string>,
	commentsByGrade: Map<number, string[]>,
): GradesBySubjectResult["grades"][number] {
	return {
		subject: grade.subjectName ?? subjectNames.get(grade.subjectId ?? -1) ?? null,
		grade: grade.grade,
		date: grade.dateOccurred,
		category: grade.categoryId !== null ? (categoryNames.get(grade.categoryId) ?? null) : null,
		comments: commentsByGrade.get(grade.id) ?? [],
		teacher: grade.addedByName,
		semester: grade.semester,
		countsToAverage: grade.isConstituent,
		isFinal: grade.isFinal,
		isSemester: grade.isSemester,
	};
}

/* -------------------------------- timetable ------------------------------- */

type TimetableDayName = "dzis" | "jutro";

export interface TimetableForDayArgs {
	day: TimetableDayName;
}

export interface TimetableForDayResult {
	date: string;
	day: TimetableDayName;
	/** Puste, gdy brak lekcji (weekend, ferie) — nie jest to błąd. */
	lessons: Array<{
		hourFrom: string;
		hourTo: string;
		lessonNo: string | null;
		subject: string | null;
		teacher: string | null;
		classroom: string | null;
		status: "ok" | "odwolana" | "zastepstwo";
		note: string | null;
	}>;
}

/** „Plan na dziś/jutro” — płaska lista lekcji z jednego dnia tygodnia. */
export async function timetableForDay(
	surface: LibrusClientSurface,
	jar: CookieJar,
	args: TimetableForDayArgs,
	now: () => number,
): Promise<TimetableForDayResult> {
	const today = localDateOf(now());
	const date = args.day === "jutro" ? addDays(today, 1) : today;
	const timetable = await surface.readTimetable(jar, mondayOf(date));
	const day = timetable.days.find((entry) => entry.date === date);
	return { date, day: args.day, lessons: day ? flattenDayLessons(day) : [] };
}

/** Flattens the week grid's period slots of one day into hour-sorted rows. */
function flattenDayLessons(day: TimetableDay): TimetableForDayResult["lessons"] {
	const lessons: TimetableForDayResult["lessons"] = [];
	for (const slot of day.slots) {
		for (const lesson of slot) {
			lessons.push({
				hourFrom: lesson.hourFrom,
				hourTo: lesson.hourTo,
				lessonNo: lesson.lessonNo,
				subject:
					lesson.isSubstitutionClass && lesson.orgSubjectName !== null
						? `${lesson.orgSubjectName} → ${lesson.subjectName ?? "?"}`
						: lesson.subjectName,
				teacher: lesson.teacherName,
				classroom: lesson.classroomSymbol,
				status: lesson.isCanceled ? "odwolana" : lesson.isSubstitutionClass ? "zastepstwo" : "ok",
				note: lesson.substitutionNote,
			});
		}
	}
	return lessons.sort((a, b) => a.hourFrom.localeCompare(b.hourFrom));
}

/* --------------------------------- messages -------------------------------- */

export interface UnreadMessagesArgs {
	/** Ile nieprzeczytanych pokazać (1-50, domyślnie 10). */
	limit?: number;
}

export interface UnreadMessagesResult {
	unreadCount: number;
	/** Nieprzeczytane z pierwszej strony skrzynki (metadane, bez treści). */
	messages: Array<{
		sender: string | null;
		topic: string;
		sendDate: string | null;
	}>;
	/** True, gdy nieprzeczytanych jest więcej, niż pokazano. */
	moreAvailable: boolean;
}

/**
 * „Nieprzeczytane wiadomości” — wyłącznie metadany (nadawca, temat, data),
 * nigdy treść; to świadome ograniczenie z issue.
 */
export async function unreadMessages(
	surface: LibrusClientSurface,
	gJar: CookieJar,
	args: UnreadMessagesArgs,
): Promise<UnreadMessagesResult> {
	const limit = clampLimit(args.limit, 10);
	const mJar = await surface.establishMessagesSession(gJar);
	const counts = await surface.readUnreadMessagesCount(mJar);
	const page: MessageListPage = await surface.readInboxMessages(mJar, 1, 50);
	const unread = page.messages.filter((message) => message.readDate === null);
	return {
		unreadCount: counts.inbox,
		messages: unread.slice(0, limit).map((message) => ({
			sender: message.senderName,
			topic: message.topic,
			sendDate: message.sendDate,
		})),
		moreAvailable: unread.length > limit,
	};
}

/* -------------------------------- homework --------------------------------- */

export interface UpcomingHomeworkArgs {
	/** Horyzont w dniach od dziś (1-60, domyślnie 14). */
	days?: number;
}

export interface UpcomingHomeworkResult {
	from: string;
	to: string;
	/** Zadania z terminalem lekcji w horyzoncie (z Librusowych HomeWorks). */
	homeworks: Array<{
		date: string;
		subject: string | null;
		content: string;
		category: string | null;
		lessonNo: string | null;
	}>;
	/** Zlecenia z terminem oddania w horyzoncie (HomeWorkAssignments). */
	assignments: Array<{
		dueDate: string;
		topic: string;
		teacher: string | null;
		mustAttachFile: boolean;
	}>;
}

/** „Zadania na najbliższy czas” — prace domowe i zlecenia w horyzoncie dni. */
export async function upcomingHomework(
	surface: LibrusClientSurface,
	jar: CookieJar,
	args: UpcomingHomeworkArgs,
	now: () => number,
): Promise<UpcomingHomeworkResult> {
	const days = clampLimit(args.days, 14, 1, 60);
	const from = localDateOf(now());
	const to = addDays(from, days);
	const [homeworks, assignments] = await Promise.all([
		surface.readHomeWorks(jar),
		surface.readHomeWorkAssignments(jar),
	]);
	const inRange = (date: string) => date >= from && date <= to;
	const homeworkInRange = homeworks
		.filter((homework) => inRange(homework.date))
		.sort((a, b) => a.date.localeCompare(b.date));
	const assignmentsInRange = assignments
		.filter((assignment) => inRange(assignment.dueDate))
		.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
	return {
		from,
		to,
		homeworks: homeworkInRange.map((homework) => ({
			date: homework.date,
			subject: homework.subjectName,
			content: homework.content,
			category: homework.categoryName,
			lessonNo: homework.lessonNo,
		})),
		assignments: assignmentsInRange.map((assignment) => ({
			dueDate: assignment.dueDate,
			topic: assignment.topic,
			teacher: assignment.teacherName,
			mustAttachFile: assignment.mustSendAttachFile,
		})),
	};
}

/* --------------------------------- notices --------------------------------- */

export interface NoticesArgs {
	/** Ile ogłoszeń pokazać, od najnowszych (1-50, domyślnie 20). */
	limit?: number;
}

export interface NoticesResult {
	count: number;
	notices: Array<{
		subject: string;
		content: string;
		startDate: string;
		endDate: string;
		addedBy: string | null;
		wasRead: boolean;
	}>;
}

/** „Ogłoszenia” — szkolne ogłoszenia, od najnowszych. */
export async function schoolNotices(
	surface: LibrusClientSurface,
	jar: CookieJar,
	args: NoticesArgs,
): Promise<NoticesResult> {
	const limit = clampLimit(args.limit, 20, 1, 50);
	const notices = await surface.readSchoolNotices(jar);
	const sorted = [...notices].sort((a, b) => b.startDate.localeCompare(a.startDate));
	return {
		count: sorted.length,
		notices: sorted.slice(0, limit).map((notice: SchoolNotice) => ({
			subject: notice.subject,
			content: notice.content,
			startDate: notice.startDate,
			endDate: notice.endDate,
			addedBy: notice.addedByName,
			wasRead: notice.wasRead,
		})),
	};
}

/* -------------------------------- internals -------------------------------- */

function clampLimit(value: number | undefined, fallback: number, min = 1, max = 50): number {
	if (value === undefined || !Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, Math.floor(value)));
}

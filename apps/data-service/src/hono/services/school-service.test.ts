/**
 * The justifications role gate: only parent accounts (groupId 5) may read
 * them. A student account (8) gets FORBIDDEN without a Librus call — the
 * reader (mocked) throws if it is ever invoked.
 */
import { env } from "cloudflare:workers";
import type { CookieJarDTO } from "@repo/librus-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const readJustificationsMock = vi.hoisted(() => vi.fn());
const readSchoolMock = vi.hoisted(() => vi.fn());
const readClassesMock = vi.hoisted(() => vi.fn());
const readLessonsMock = vi.hoisted(() => vi.fn());
const readSubjectsMock = vi.hoisted(() => vi.fn());
const readTeachersMock = vi.hoisted(() => vi.fn());
const readNotesMock = vi.hoisted(() => vi.fn());
const readNoticesMock = vi.hoisted(() => vi.fn());
const readConferencesMock = vi.hoisted(() => vi.fn());

vi.mock("@repo/librus-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@repo/librus-client")>();
	return { ...actual, readJustifications: readJustificationsMock };
});

import { getJustifications, getSchoolOverview } from "./school-service";

const JAR: CookieJarDTO = [
	{ name: "synergiaSid", value: "abc", domain: "synergia.librus.pl", path: "/" },
];

async function seedAccount(groupId: number): Promise<string> {
	const id = `librus:${groupId === 5 ? 91 : 92}`;
	await env.KV.put(
		`account:${id}`,
		JSON.stringify({
			id,
			firstName: "Test",
			lastName: "Konto",
			groupId,
			jar: JAR,
			createdAt: "2026-10-13T00:00:00.000Z",
		}),
	);
	return id;
}

describe("getJustifications role gate", () => {
	beforeEach(() => {
		readJustificationsMock.mockReset();
	});

	it("answers FORBIDDEN for a student account (8) without calling Librus", async () => {
		readJustificationsMock.mockImplementation(() => {
			throw new Error("must not be called for role 8");
		});
		const accountId = await seedAccount(8);
		const result = await getJustifications(env.KV, accountId, {
			readJustifications: readJustificationsMock,
		} as never);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("FORBIDDEN");
			expect(result.error.status).toBe(403);
		}
		expect(readJustificationsMock).not.toHaveBeenCalled();
	});

	it("reads justifications for a parent account (5)", async () => {
		readJustificationsMock.mockResolvedValue([
			{ id: 41, justificationStatus: "accepted", notifiedTeachers: ["Anna Kowalska"] },
		]);
		const accountId = await seedAccount(5);
		const result = await getJustifications(env.KV, accountId, {
			readJustifications: readJustificationsMock,
		} as never);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data[0]?.justificationStatus).toBe("accepted");
		}
		expect(readJustificationsMock).toHaveBeenCalledTimes(1);
	});
});

describe("getSchoolOverview name filling", () => {
	it("fills lesson subject/teacher names and the tutor from the dictionaries", async () => {
		readJustificationsMock.mockReset();
		readSubjectsMock.mockResolvedValue([{ id: 12, name: "Matematyka" }]);
		readTeachersMock.mockResolvedValue([{ id: 55, firstName: "Anna", lastName: "Kowalska" }]);
		readSchoolMock.mockResolvedValue(null);
		readClassesMock.mockResolvedValue({
			id: 3,
			number: 7,
			symbol: "b",
			beginSchoolYear: null,
			endFirstSemester: "2027-01-29",
			endSchoolYear: "2027-06-25",
			unitId: null,
			tutorIds: [55],
			tutorName: null,
		});
		readLessonsMock.mockResolvedValue([
			{ id: 701, subjectId: 12, subjectName: null, teacherId: 55, teacherName: null, classId: 3 },
		]);
		const accountId = await seedAccount(8);
		const result = await getSchoolOverview(env.KV, accountId, {
			readSchool: readSchoolMock,
			readClasses: readClassesMock,
			readLessons: readLessonsMock,
			readSubjects: readSubjectsMock,
			readTeachers: readTeachersMock,
			readNotes: readNotesMock,
			readSchoolNotices: readNoticesMock,
			readParentTeacherConferences: readConferencesMock,
			readJustifications: readJustificationsMock,
		} as never);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.lessons[0]?.subjectName).toBe("Matematyka");
			expect(result.data.lessons[0]?.teacherName).toBe("Anna Kowalska");
			expect(result.data.classes?.tutorName).toBe("Anna Kowalska");
		}
	});
});

describe("getSchoolOverview Users fallback + dedupe", () => {
	it("resolves the tutor and lesson teachers from Users/{id} when /Teachers is empty", async () => {
		readJustificationsMock.mockReset();
		readSubjectsMock.mockResolvedValue([
			{ id: 12, name: "Matematyka" },
			{ id: 20, name: "WF" },
			{ id: 21, name: "Język niemiecki" },
		]);
		readTeachersMock.mockResolvedValue([]); // /Teachers 404 on real accounts
		readSchoolMock.mockResolvedValue(null);
		readClassesMock.mockResolvedValue({
			id: 3,
			number: 7,
			symbol: "b",
			beginSchoolYear: null,
			endFirstSemester: null,
			endSchoolYear: null,
			unitId: null,
			tutorIds: [55],
			tutorName: null,
		});
		readLessonsMock.mockResolvedValue([
			// Three weekly groups of WF (subject 20) and two of German (subject 21)
			{ id: 1, subjectId: 20, subjectName: null, teacherId: 55, teacherName: null, classId: 3 },
			{ id: 2, subjectId: 20, subjectName: null, teacherId: 55, teacherName: null, classId: 3 },
			{ id: 3, subjectId: 21, subjectName: null, teacherId: 77, teacherName: null, classId: 3 },
			{ id: 4, subjectId: 21, subjectName: null, teacherId: 77, teacherName: null, classId: 3 },
			{ id: 5, subjectId: 21, subjectName: null, teacherId: 77, teacherName: null, classId: 3 },
		]);
		const readUserMock = vi.fn(async (_jar: unknown, id: string | number) =>
			String(id) === "55"
				? { id: 55, firstName: "Anna", lastName: "Kowalska" }
				: { id: 77, firstName: "Ewa", lastName: "Niemiecka" },
		);
		const accountId = await seedAccount(8);
		const result = await getSchoolOverview(env.KV, accountId, {
			readSchool: readSchoolMock,
			readClasses: readClassesMock,
			readLessons: readLessonsMock,
			readSubjects: readSubjectsMock,
			readTeachers: readTeachersMock,
			readUser: readUserMock,
			readNotes: readNotesMock,
			readSchoolNotices: readNoticesMock,
			readParentTeacherConferences: readConferencesMock,
			readJustifications: readJustificationsMock,
		} as never);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.classes?.tutorName).toBe("Anna Kowalska");
			const rows = result.data.lessons.map((l) => `${l.subjectName}/${l.teacherName}`);
			expect(rows).toEqual(["WF/Anna Kowalska", "Język niemiecki/Ewa Niemiecka"]);
		}
	});
});

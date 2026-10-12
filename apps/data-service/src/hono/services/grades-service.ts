/**
 * Grades proxy: jar from KV, readers from librus-client.
 */
import {
	CookieJar,
	type Grade,
	type GradeCategory,
	type GradeComment,
	readGradeCategories,
	readGradeComments,
	readGrades,
} from "@repo/librus-client";
import { loadAccount } from "@/kv/store";
import type { Result } from "../types/result";
import { toAppError } from "./librus-errors";

export interface GradesView {
	grades: Grade[];
	categories: GradeCategory[];
	comments: GradeComment[];
}

/** Injectable boundary: the Librus readers. Tests replace them wholesale. */
export interface GradesDeps {
	readGrades: typeof readGrades;
	readGradeCategories: typeof readGradeCategories;
	readGradeComments: typeof readGradeComments;
}

const defaultGradesDeps: GradesDeps = { readGrades, readGradeCategories, readGradeComments };

/** Reads grades for the device-account context. */
export async function getGrades(
	kv: KVNamespace,
	accountId: string,
	deps: GradesDeps = defaultGradesDeps,
): Promise<Result<GradesView>> {
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
		const [grades, categories, comments] = await Promise.all([
			deps.readGrades(jar),
			deps.readGradeCategories(jar),
			deps.readGradeComments(jar),
		]);
		return { ok: true, data: { grades, categories, comments } };
	} catch (error) {
		return { ok: false, error: toAppError(error) };
	}
}

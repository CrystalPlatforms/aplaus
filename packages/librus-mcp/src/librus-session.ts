/**
 * The real LibrusClientSurface, bound to the librus-client barrel, plus the
 * session wrapper: lazy login on first tool call, cached jar, one transparent
 * re-login when a reader reports SESSION_EXPIRED. Credentials come from the
 * local environment (the owner's machine) — never from production.
 */

import type { HttpDeps } from "@repo/librus-client";
import * as librus from "@repo/librus-client";
import { isLibrusError } from "@repo/librus-client";
import type { LibrusClientSurface } from "./tools";

/** Binds every function the tools use to the real client (default deps). */
export function createLibrusSurface(deps: HttpDeps = librus.defaultDeps): LibrusClientSurface {
	return {
		login: (login, password) => librus.loginToLibrus(login, password, deps),
		readGrades: (jar) => librus.readGrades(jar, deps),
		readSubjects: (jar) => librus.readSubjects(jar, deps),
		readGradeCategories: (jar) => librus.readGradeCategories(jar, deps),
		readGradeComments: (jar) => librus.readGradeComments(jar, deps),
		readTimetable: (jar, weekStart) => librus.readTimetable(jar, weekStart, deps),
		establishMessagesSession: (gJar) => librus.establishMessagesSession(gJar, deps),
		readInboxMessages: (jar, page, limit) => librus.readInboxMessages(jar, page, limit, deps),
		readUnreadMessagesCount: (jar) => librus.readUnreadMessagesCount(jar, deps),
		readHomeWorks: (jar) => librus.readHomeWorks(jar, deps),
		readHomeWorkAssignments: (jar) => librus.readHomeWorkAssignments(jar, deps),
		readSchoolNotices: (jar) => librus.readSchoolNotices(jar, deps),
	};
}

export interface LibrusCredentials {
	login: string;
	password: string;
}

export class LibrusSession {
	private jar: librus.CookieJar | null = null;

	constructor(
		private readonly surface: LibrusClientSurface,
		private readonly credentials: LibrusCredentials,
	) {}

	/**
	 * Runs one tool read against a logged-in jar. The first call logs in; a
	 * SESSION_EXPIRED mid-read clears the cache and retries exactly once so a
	 * stale jar never surfaces to the model as an error it cannot fix.
	 */
	async run<T>(read: (jar: librus.CookieJar) => Promise<T>): Promise<T> {
		const jar = await this.ensureJar();
		try {
			return await read(jar);
		} catch (error) {
			if (!isLibrusError(error) || error.code !== "SESSION_EXPIRED") throw error;
			this.jar = null;
			return read(await this.ensureJar());
		}
	}

	private async ensureJar(): Promise<librus.CookieJar> {
		if (this.jar === null) {
			const outcome = await this.surface.login(this.credentials.login, this.credentials.password);
			this.jar = outcome.jar;
		}
		return this.jar;
	}
}

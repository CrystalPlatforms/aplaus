/**
 * @repo/librus-client — deep module for the unofficial Librus Synergia API.
 *
 * Public interface: login, /Me, typed readers, cookie jar, errors. The protocol
 * (x-baner, redirect walking, cookie rules) stays inside.
 */

export { buildBaner, encodeBanerPart, randomBanerPart } from "./baner";
export {
	CookieJar,
	type CookieJarDTO,
	type CookieRecord,
} from "./cookie-jar";
export { isLibrusError, LibrusError, type LibrusErrorCode } from "./errors";
export { type GatewayResponse, gatewayRequest } from "./gateway";
export {
	type Grade,
	type GradeCategory,
	type GradeComment,
	readGradeCategories,
	readGradeComments,
	readGrades,
} from "./grades";
export { defaultDeps, type HttpDeps } from "./http";
export { type LibrusAccount, type LoginOutcome, loginToLibrus } from "./login";
export { readMe } from "./me";

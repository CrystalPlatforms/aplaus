/**
 * @repo/librus-client — deep module for the unofficial Librus Synergia API.
 *
 * Public interface: login, /Me, typed readers, cookie jar, errors. The protocol
 * (x-baner, redirect walking, cookie rules) stays inside.
 */

export {
	type Attendance,
	type AttendanceType,
	readAttendances,
	readAttendanceTypes,
} from "./attendances";
export { buildBaner, encodeBanerPart, randomBanerPart } from "./baner";
export {
	type CalendarRef,
	type ClassFreeDay,
	readCalendars,
	readClassFreeDays,
} from "./calendars";
export {
	type ClassInfo,
	readClasses,
} from "./classes";
export { type Classroom, readClassrooms } from "./classrooms";
export {
	type ParentTeacherConference,
	readParentTeacherConferences,
} from "./conferences";
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
export {
	type HomeWork,
	type HomeWorkAssignment,
	readHomeWorkAssignments,
	readHomeWorks,
} from "./homework";
export { defaultDeps, type HttpDeps } from "./http";
export { type Justification, readJustifications } from "./justifications";
export { type Lesson, readLessons } from "./lessons";
export { type LibrusAccount, type LoginOutcome, loginToLibrus } from "./login";
export { readMe } from "./me";
export {
	type AttachmentDownload,
	type CustomReceiverGroup,
	fetchAttachment,
	type MessageAttachment,
	type MessageDetail,
	type MessageListItem,
	type MessageListPage,
	type MessagesMe,
	type MessageTag,
	type ReceiverType,
	readCustomReceiverGroups,
	readInboxMessages,
	readMessageDetail,
	readMessagesMe,
	readOutboxMessages,
	readReceiverTypes,
	readTags,
	readUnreadMessagesCount,
	type UnreadCounts,
} from "./messages";
export { establishMessagesSession } from "./messages-auth";
export { type Note, readNotes } from "./notes";
export { readSchoolNotices, type SchoolNotice } from "./notices";
export { readSchool, type School } from "./schools";
export { readSubjects, type Subject } from "./subjects";
export { readTeachers, type Teacher } from "./teachers";
export {
	readTimetable,
	shiftWeekStart,
	type Timetable,
	type TimetableDay,
	type TimetableLesson,
	weekStartFromUrl,
} from "./timetable";
export { readUser, type User } from "./users";

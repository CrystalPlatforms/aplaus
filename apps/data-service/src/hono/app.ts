import { Hono } from "hono";
import { attendance } from "./handlers/attendance-handlers";
import { api as authApi } from "./handlers/auth-handlers";
import { grades } from "./handlers/grades-handlers";
import health from "./handlers/health-handlers";
import { homework } from "./handlers/homework-handlers";
import { messages } from "./handlers/messages-handlers";
import { school } from "./handlers/school-handlers";
import { calendar, timetable } from "./handlers/timetable-handlers";
import { createCorsMiddleware } from "./middleware/cors";
import { onErrorHandler } from "./middleware/error-handler";
import { requestId } from "./middleware/request-id";

export const App = new Hono<{ Bindings: Env }>();

App.use("*", requestId());
App.onError(onErrorHandler);
App.use("*", createCorsMiddleware());

App.route("/health", health);
App.route("/api", authApi);
App.route("/api/grades", grades);
App.route("/api/timetable", timetable);
App.route("/api/calendar", calendar);
App.route("/api/homework", homework);
App.route("/api/attendance", attendance);
App.route("/api/school", school);
App.route("/api/messages", messages);

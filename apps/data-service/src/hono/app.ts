import { Hono } from "hono";
import { api as authApi } from "./handlers/auth-handlers";
import { grades } from "./handlers/grades-handlers";
import health from "./handlers/health-handlers";
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

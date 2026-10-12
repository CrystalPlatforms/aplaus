# Error Handling (Cross-Package)

## Layered Approach

| Layer | Pattern | Location |
|-------|---------|----------|
| Librus API | `LibrusError` taxonomy (code + Polish message + HTTP status) | librus-client |
| API services | Catch `LibrusError` -> `toAppError()` -> `Result<T>` | data-service `apps/data-service/src/hono/services/` |
| API handlers | `resultToResponse` maps `Result<T>` to JSON | data-service `apps/data-service/src/hono/handlers/` |

## librus-client Errors

`LibrusError` carries `code` (`LibrusErrorCode`), `status`, and `userMessage` (Polish, ready
for the UI). Mapping is HTTP-status-first, checked before parsing any body:
401 -> `SESSION_EXPIRED`, 403 at login with `errors[]` -> `WRONG_CREDENTIALS`,
403 elsewhere -> `FORBIDDEN`, 404 -> `NOT_FOUND`, anything else -> `LOGIN_FAILED`
or `UNEXPECTED_RESPONSE`.

## Result Pattern (data-service)

Services return `Result<T>` — never throw. `AppError` shape: `code`, `message`, `status`,
optional `field`. `services/librus-errors.ts` owns the single `toAppError()` mapping.
Handlers unwrap via `resultToResponse`. Unexpected errors propagate to global `onErrorHandler`.

Middleware that needs to short-circuit (auth, rate limit, validation) throws `HTTPException`
from `hono/http-exception`; the global handler maps it to a JSON response. Do not introduce a
dedicated `ApiError` class server-side — `HTTPException` and `Result<T>` cover every case.
(The web app has its own `ApiError` for fetch failures; that one is client-side only.)

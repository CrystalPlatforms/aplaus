# data-service

Cloudflare Worker API: device tokens in KV, Librus proxy via librus-client.

## Stack

- Hono (Cloudflare Workers adapter), WorkerEntrypoint class pattern
- Storage: KV only (binding `KV`) — devices, accounts, cookie jars, login-throttle counters
- Consumes `@repo/librus-client` for the whole Librus protocol

## Structure

```
src/
├── index.ts              # Worker entrypoint
├── kv/                   # typed KV access (store, login-throttle)
└── hono/
    ├── app.ts            # Hono app, middleware chain, routes
    ├── handlers/         # thin: auth-handlers, grades-handlers, health-handlers
    ├── services/         # business logic: auth-service, grades-service, health-service
    ├── middleware/       # request-id, cors, device-auth, rate-limiter, error-handler
    ├── schemas/          # zod request schemas
    ├── types/            # Result<T>, AppError
    └── utils/            # error helpers
```

## Endpoints

- `GET /health/live` - liveness (instant 200)
- `GET /health/ready` - readiness (KV probe; 200 when KV answers, 503 otherwise)
- `POST /api/login` - Librus login -> device token; with a device token it adds another account to the device; rate limited (IP limiter + per-login failure counter)
- `GET /api/me` - device-token -> active account meta (banner data)
- `GET /api/accounts` - device-token -> all accounts of the device + activeAccountId
- `POST /api/accounts/switch` - device-token + `{accountId}` -> moves the proxy context to that account
- `POST /api/accounts/refresh` - device-token + `{login, password}` -> silent renewal: re-login, jar swap in KV; rate limited; ownership-checked
- `GET /api/grades` - device-token -> normalized grades + categories + comments
- `GET /api/timetable?weekStart=YYYY-MM-DD` - device-token -> week grid + next/prev weekStart
- `GET /api/calendar/free-days` - device-token -> calendars + class free days
- `GET /api/homework` - device-token -> schedule homework entries + assignments
- `GET /api/attendance` - device-token -> attendance records + type dictionary
- `GET /api/school/overview` - device-token -> school meta + class + lessons + subjects
- `GET /api/school/notices` - device-token -> school notices with validity periods
- `GET /api/school/notes` - device-token -> notes (uwagi)
- `GET /api/school/conferences` - device-token -> parent-teacher conferences
- `GET /api/school/justifications` - device-token -> justifications; FORBIDDEN unless the
  active account is a parent (groupId 5)
- `GET /api/messages/me` - device-token -> M account meta (messages session)
- `GET /api/messages/inbox?page=&limit=` - device-token -> one inbox page + total
- `GET /api/messages/outbox?page=&limit=` - device-token -> one outbox page + total
- `GET /api/messages/inbox/:id` - device-token -> message detail (marks read in Librus)
- `GET /api/messages/outbox/:id` - device-token -> detail of a sent message
- `GET /api/messages/inbox/unread-count` - device-token -> unread counters (metadata only)
- `GET /api/messages/attachments/:fileId/:messageId` - device-token -> the attachment bytes
  (contract from the official messages client)
- `GET /api/messages/tags` - device-token -> message tags
- `GET /api/messages/receivers/types` - device-token -> receiver type dictionary
- `GET /api/messages/receivers/custom-groups` - device-token -> custom receiver groups

The messages routes keep the M cookie jar per account (`AccountRecord.mJar`); when absent or
expired it is re-established once from the stored G jar (no credentials involved).

## Device auth

`requireDevice()` from `middleware/device-auth.ts` reads `Authorization: Bearer <token>`,
resolves `device:{token}` in KV, sets `accountId` on the context. 401 with a Polish message
when missing or unknown.

## Patterns

See `hono.md` and `error-handling.md` rules for handler/service patterns and Result/AppError
details. Services never throw: they catch LibrusError and map it through
`services/librus-errors.ts` (toAppError) into `Result<T>`.

**Middleware order** (in app.ts): requestId -> onError -> cors; auth, rate limiting and
validation are per route.

## Dev

```bash
pnpm run dev                # local dev server (port 8788)
```

Deployment is CI-only - see the Deployment section of the root `AGENTS.md`.

## Testing

```bash
pnpm run test               # vitest run, inside workerd
```

This suite runs in the Workers runtime (`vitest.config.mts` wires `cloudflareTest()` from
`@cloudflare/vitest-plugin`), not Node. Bindings are the real ones from `wrangler.jsonc`'s dev
environment - `import { env } from "cloudflare:workers"` and use them directly rather than
stubbing. Rate-limit assertions track whatever `ratelimits` says.

## Env vars

**Versioned config** - `wrangler.jsonc`, under `env.<name>.vars`:
- `CLOUDFLARE_ENV` - dev | staging | production
- `ALLOWED_ORIGINS` - comma-separated origins (staging/production; dev uses a fixed localhost list)

**Secrets** - none yet. The push phase adds VAPID keys via `./sync-secrets.sh <env>`, which
pushes the whole `.example.vars`-fanned file in one `wrangler secret bulk` call.

**KV namespaces** - one per environment under `env.<name>.kv_namespaces`. Local dev and tests
use the workerd simulation; the committed ids are placeholders. Before the first deploy, create
real namespaces (`wrangler kv namespace create KV`) and paste the ids.

After editing `env.<name>.vars` or bindings, run `pnpm run cf-typegen` (in this package).
`pnpm run check:runtime-types` fails the build on a stale `worker-configuration.d.ts`.

## Don't

- Put Librus protocol code here - extend `@repo/librus-client` instead
- Store passwords in KV - cookie jars and account meta only
- Modify `worker-configuration.d.ts`, use `pnpm run cf-typegen`

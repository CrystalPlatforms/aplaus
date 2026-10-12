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
- `POST /api/login` - Librus login -> device token; rate limited (IP limiter + per-login failure counter)
- `GET /api/me` - device-token -> account meta (banner data)
- `GET /api/grades` - device-token -> normalized grades + categories + comments

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

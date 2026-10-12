# Deep Modules

Small interface, large implementation (Ousterhout). Absorb complexity inside modules — don't spread it across many tiny files.

## Decision Checks

- Before creating a file: does this deepen an existing module or just widen its interface?
- Before exporting: does the caller need this or is it internal?
- Shallow modules (many tiny files doing little) increase system complexity

## Module Boundaries

| Layer | Module boundary | Interface (narrow) | Hides |
|-------|----------------|-----------|-------|
| Librus protocol | `packages/librus-client/src/index.ts` | login, readers, cookie jar, typed errors | x-baner, redirect walking, cookie rules, gateway envelope |
| API handler | `data-service/src/hono/handlers/{name}.ts` | Hono routes | Request validation, response mapping |
| API service | `data-service/src/hono/services/{name}.ts` | Service functions returning `Result<T>` | Business rules, librus-client calls, KV, error mapping |
| Middleware | `data-service/src/hono/middleware/{name}.ts` | Hono middleware export | Auth checks, rate limit logic, header parsing |

## librus-client Module Pattern

`packages/librus-client` is one deep module. Consumers import only from the barrel
(`@repo/librus-client`): login, readers, cookie jar DTO, typed errors.

- `HttpDeps` injects fetch/now/random — tests mock at the HTTP boundary only
- Readers normalize the G envelope (`{<Resource>, Resources, Url}`) into flat typed objects
- Protocol internals (`baner.ts`, `http.ts`, `cookie-parse.ts`, `gateway.ts`) stay unexported

Don't export protocol internals. If a consumer needs a normalized shape, expose it as a
TypeScript type from the barrel.

## data-service Handler→Service Split

One handler file + one service file per domain is fine. Don't split further unless a service exceeds 500 lines — then split by subdomain, not by function count.

- Handlers: thin — parse request, call service, map `Result<T>` to response
- Services: deep — all business logic, validation, librus-client calls, KV writes

## Testing at the Boundary

- **librus-client**: test exported functions, mocking fetch at the HTTP boundary
- **API handlers**: test via HTTP requests (`app.request()`)
- **Middleware**: test via HTTP requests with appropriate fixtures
- If you need to test an internal function → the module should probably split

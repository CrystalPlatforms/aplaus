# librus-client

Deep module wrapping the unofficial Librus Synergia API. Consumers (data-service, later
the MCP server) see a narrow interface: login, /Me, login errors, gateway transport,
cookie jar, typed errors. The protocol (x-baner, redirects, cookie rules) stays inside.

## Structure

```
src/
├── index.ts        # barrel — the only import path for consumers
├── errors.ts       # LibrusError taxonomy with Polish messages
├── baner.ts        # x-baner header encoding (each char +20)
├── cookie-jar.ts   # session jar, serializable to KV as DTO
├── cookie-parse.ts # Set-Cookie parsing and domain/path matching
├── http.ts         # fetch wrapper, manual redirect walking
├── gateway.ts      # authenticated GET to the Synergia gateway
├── login.ts        # portal -> OAuth (x-baner) -> goTo -> Synergia
├── me.ts           # /Me reader
└── grades.ts       # Grades readers (phase 3)
```

## Patterns

- `HttpDeps` injects fetch/now/random so tests mock at the HTTP boundary only.
- Errors before parsing: 401 -> SESSION_EXPIRED, 307-like 403 -> FORBIDDEN, 404 -> NOT_FOUND.
- Readers normalize the G envelope (`{<Resource>, Resources, Url}`) into flat typed objects,
  resolving `{Id, Url}` refs through `Resources` (subject/teacher names) when present.
- Consumers never import protocol internals — only from the barrel.
- Max 500 lines per file; biome tabs; English doc comments.

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
├── grades.ts       # Grades readers (phase 3)
├── notices.ts      # /SchoolNotices (Id is a string here)
├── notes.ts        # /Notes (unobserved shape — defensive parser)
├── conferences.ts  # /ParentTeacherConferences
├── schools.ts      # /Schools (singular School object)
├── classes.ts      # /Classes (singular Class object, tutor refs)
├── lessons.ts      # /Lessons (subject/teacher/class tuples)
├── justifications.ts # /Justifications — {status, message, data}, parent-only
├── messages-auth.ts  # M session chain: wiadomosci3 -> MultiDomainLogon
└── messages.ts     # M readers: folders, detail, unread counter, dictionaries
```

## Patterns

- `HttpDeps` injects fetch/now/random so tests mock at the HTTP boundary only.
- Errors before parsing: 401 -> SESSION_EXPIRED, 307-like 403 -> FORBIDDEN, 404 -> NOT_FOUND.
- Readers normalize the G envelope (`{<Resource>, Resources, Url}`) into flat typed objects,
  resolving `{Id, Url}` refs through `Resources` (subject/teacher names) when present.
- `Justifications` is the one G resource whose payload is `{status, message, data}` (lowercase)
  — its reader parses that shape, not the G envelope.
- The messages (M) API lives on wiadomosci.librus.pl/api with its own session: `establishMessagesSession`
  walks wiadomosci3 -> MultiDomainLogon with the G jar and returns a jar of ONLY wiadomosci
  cookies (stored next to the G jar). M list envelopes are `{data, total}`; ids are strings.
- Consumers never import protocol internals — only from the barrel.
- Max 500 lines per file; biome tabs; English doc comments.

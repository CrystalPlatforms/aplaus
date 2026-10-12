# Aplaus — data service

REST API (backend) — Hono na Cloudflare Workers, przechowywanie wyłącznie w KV.

- **`wrangler.jsonc`** — definicje środowisk (dev/staging/production), binding KV, rate limity.
- **`src/kv/`** — typowany dostęp do KV (urządzenia, konta, licznik nieudanych logowań).
- **`src/hono/`** — aplikacja Hono (handlery, serwisy, middleware, schematy).

Szczegóły: [AGENTS.md](./AGENTS.md).

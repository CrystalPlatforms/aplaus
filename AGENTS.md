# Aplaus

Monorepo: unofficial Librus Synergia client (Hono API on Cloudflare Workers, KV only) + PWA.

## Packages

| Package | Purpose |
|---------|---------|
| `packages/librus-client` | Deep module: Librus login protocol, cookie sessions, typed readers |
| `apps/data-service` | REST API (Hono on CF Workers) — device tokens, KV storage, Librus proxy |
| `apps/web` | PWA (React 19 + Vite + Tailwind + TanStack Query) |

Each has its own `AGENTS.md` with package-specific patterns (`CLAUDE.md` symlinks to `AGENTS.md`).

## Architecture

`apps/web` and `apps/data-service` both depend on `packages/librus-client` — it owns the whole
Librus protocol (login dance, x-baner header, cookie jar, gateway readers). The Worker never
parses Librus responses itself; it persists cookie jars in KV and proxies typed readers.
Passwords are never stored server-side: the server keeps cookie jars and account meta only.

## Commands

```bash
pnpm run setup             # install dependencies
pnpm run dev:data-service  # API dev (port 8788)
pnpm run dev:web           # web dev (port 5173)
pnpm run lint              # check all (formatting + linting)
pnpm run lint:fix          # auto-fix all
pnpm run test              # run all tests
pnpm run types             # type-check all packages
```

## Verification

Lint auto-runs via PostToolUse hook on Edit/Write (biome check --write).

After completing changes, run manually:
1. `pnpm run types` — type-check all packages
2. `pnpm run test` — run all tests
3. `pnpm run check:docs` — fail if any doc names a directory, file, endpoint, script, scoped package or link that does not exist
4. `pnpm run check:runtime-types` — fail if a Worker's generated `worker-configuration.d.ts` no longer matches the compatibility date, flags and workerd version it would be generated from today

All four run on every pull request, so documentation drift and stale generated types block a merge the same way a failing test does.

- Max 500 lines per source file — split if exceeding
- Biome config: `biome.json` (root), plugins: `.biome-plugins/*.grit`

## Deployment

Deploys run in CI (`.github/workflows/deploy.yml`), never from a local command — there is no `deploy` script in any package, deliberately.

- Push to `main` -> staging. A `v*.*.*` tag -> production. A manual run picks either.
- The trigger->environment rule lives in `scripts/deploy-target.ts`, not in workflow YAML, so it is unit-tested.
- Every deploy uploads a version, canaries 10% of traffic, gates on `GET /health/ready` (KV probe) pinned to that version, then promotes to 100%. A failed gate halts and rolls back.
- Absent `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` the job skips with a notice and stays green.
- An environment binding no custom domain cannot be probed, so the pipeline refuses it rather than deploying blind.
- KV namespace ids in `apps/data-service/wrangler.jsonc` are placeholders until real namespaces are created (`wrangler kv namespace create KV`) and their ids pasted in.

## Rules

Cross-cutting rules auto-load by file path from `.claude/rules/`:
- [General TypeScript & Cloudflare](.claude/rules/general.md) — type safety, error handling, naming, bug-fix workflow
- [Error Handling](.claude/rules/error-handling.md) — LibrusError taxonomy + Result/AppError
- [Deep Modules](.claude/rules/deep-modules.md) — module boundaries, where new files belong
- [Cloudflare Deployment](.claude/rules/cloudflare-deployment.md) — hostname separation, custom domains, SSL/TLS
- [Atomic Imports](.claude/rules/atomic-imports.md) — combine import + usage in one edit to survive lint auto-fix

Package-specific rules live under `.claude/rules/data-service/` — see [llms.txt](./llms.txt) for the full index.

## Docs Server

`.mcp.json` wires the official Cloudflare documentation MCP server (`docs.mcp.cloudflare.com`) so agents can consult current platform docs instead of relying on training data.

## Design Docs

- `/plans` holds the Aplaus PRD and phase plan (`plans/aplaus-prd.md`, `plans/aplaus-plan.md`)
- Apply review notes/status updates directly in the corresponding plan doc
- Never create separate md files for reviews/audits/analyses unless explicitly asked
- Flag implementation deviations inline in the doc

## UI conventions

- Every loading state shows the dot loader (`apps/web/src/components/Loader.tsx`, green dots), never a bare text placeholder alone.
- The loader dots are green (#167c51); when the loader sits on a white (#FFFFFF) surface, switch the dot color so it stays visible.

## Don't

- Edit `apps/data-service/worker-configuration.d.ts` by hand — regenerate with `pnpm run cf-typegen` (from `apps/data-service`)
- Put Librus protocol code anywhere but `packages/librus-client`
- Store passwords in KV — the server keeps cookie jars and account meta only
- Reference or scaffold webhooks, queues, Durable Objects, or Workflows — none are wired in; document them only once actually built

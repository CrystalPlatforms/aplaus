# Aplaus

Nieoficjalny klient Librusa Synergia: PWA + API na Cloudflare Workers (tylko KV).

*Indeks dla agentów: [llms.txt](./llms.txt)*

## Struktura

Monorepo [pnpm workspace](https://pnpm.io/workspaces):

- [packages/librus-client](./packages/librus-client/) — cały protokół Librusa (logowanie, cookies, typowane readery)
- [apps/data-service](./apps/data-service/) — API REST (Hono na Cloudflare Workers, KV)
- [apps/web](./apps/web/) — PWA (React 19 + Vite + Tailwind + TanStack Query)

## Setup

```bash
pnpm run setup
```

`packages/librus-client` nie ma kroku kompilacji — konsumowany jest prosto z kodu TypeScript.

## Development

```bash
pnpm run dev:data-service   # API (port 8788)
pnpm run dev:web            # aplikacja web (port 5173)
```

Web w trybie dev przekazuje żądania `/api` na `http://localhost:8788` (proxy w `apps/web/vite.config.ts`) — przeglądarka woła własny origin i nic nie trzeba konfigurować.

## Logowanie

Aplikacja loguje danymi Librusa (login + hasło z urządzenia). Serwer zwraca token urządzenia
i trzyma w KV wyłącznie słoik cookies sesji oraz metadane konta — hasła nigdy nie są zapisywane
po stronie serwera.

## Testowanie

```bash
pnpm run test              # wszystkie testy
pnpm run test:watch        # watch mode
```

## Wdrożenie

Wdrożenia działają w CI ([.github/workflows/deploy.yml](./.github/workflows/deploy.yml)), nigdy z laptopa.

| Trigger | Wdraża na |
|---------|-----------|
| Push do `main` | staging |
| Tag `v*.*.*` | production |
| Ręczny run (**Actions → Deploy → Run workflow**) | wybrane środowisko |

### Włączanie wdrożeń

Do skonfigurowania pipeline'u dodaj sekrety repozytorium `CLOUDFLARE_API_TOKEN` i
`CLOUDFLARE_ACCOUNT_ID`, utwórz środowiska GitHub `staging` i `production` oraz podepnij
custom domain w `apps/data-service/wrangler.jsonc` (`pnpm run init-project` o nią dopyta).
Bez sekretów job wdrożenia pomija się z powiadomieniem i build zostaje zielony.

Każde wdrożenie wysyła wersję, puszcza 10% ruchu na kanary, sprawdza readiness
(`GET /health/ready` — prawdziwa próba KV, w przeciwieństwie do `/health/live`) przypiętą
do nowej wersji, i dopiero po zielonej bramie promuje 100% ruchu.

Przed pierwszym wdrożeniem utwórz namespace KV per środowisko
(`wrangler kv namespace create KV`) i wklej prawdziwe id-y do
`apps/data-service/wrangler.jsonc` (`env.<name>.kv_namespaces`).

Sekrety workera (na razie brak; w fazie push dojdą klucze VAPID) wypycha się osobno:
`bash apps/data-service/sync-secrets.sh {env}`.

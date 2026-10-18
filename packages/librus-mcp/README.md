# @repo/librus-mcp

Lokalny serwer MCP (stdio) nad `@repo/librus-client` — pozwala rozmawiać z
Claude'em o danych szkolnych z Librusa. Tylko odczyt; dane logowania zostają
na Twoim komputerze (zmienne środowiskowe w lokalnej konfiguracji klienta MCP).

## Narzędzia

| Narzędzie | Opis |
|---|---|
| `oceny_z_przedmiotu` | Oceny (opcjonalny filtr po nazwie przedmiotu, bez ogonków) |
| `plan_na_dzien` | Plan lekcji na dziś albo jutro (zastępstwa i odwołane) |
| `nieprzeczytane_wiadomosci` | Nieprzeczytane — tylko metadane (nadawca, temat, data) |
| `zadania_na_najblizszy_czas` | Prace domowe i zlecenia w horyzoncie dni |
| `ogloszenia` | Ogłoszenia szkolne, od najnowszych |

## Rejestracja w Claude Code

**Ważne (Windows):** `claude mcp add` zapamiętuje serwer pod katalogiem, w
którym go uruchomisz — serwer MCP startuje później właśnie z tego katalogu.
Komendę wykonaj **z katalogu repo**; dodana z katalogu domowego nie znajdzie
workspace'u (`pnpm --filter` nie ma czego filtrować) i klient zgłosi timeout.

Z katalogu repo (podstaw swoje dane między cudzysłowami):

```sh
claude mcp add aplaus --env LIBRUS_LOGIN="twoj-login" --env LIBRUS_PASSWORD="twoje-haslo" -- cmd /c pnpm --filter @repo/librus-mcp start
```

`cmd /c` jest obowiązkowe: `pnpm` na Windows to skrypt `pnpm.cmd`, którego
Node nie odpali bezpośrednio (`spawn pnpm ENOENT`). Wariant w pełni odporny
na katalog startowy Claude'a (bez pnpm i cmd, ścieżki bezwzględne):

```sh
claude mcp add aplaus --env LIBRUS_LOGIN="twoj-login" --env LIBRUS_PASSWORD="twoje-haslo" -- node %USERPROFILE%\Documents\aplaus\packages\librus-mcp\node_modules\tsx\dist\cli.mjs %USERPROFILE%\Documents\aplaus\packages\librus-mcp\src\index.ts
```

Inspektor (ręczne oglądanie narzędzi bez czatu):

```sh
pnpm --filter @repo/librus-mcp exec tsx src/index.ts
# w drugim terminalu:
npx @modelcontextprotocol/inspector
```

(Inspektor uruchamia serwer sam — w jego formularzu wpisz command `pnpm`,
args `--filter @repo/librus-mcp start` i zmienne `LIBRUS_LOGIN`/`LIBRUS_PASSWORD`.)

## Zakres i ograniczenia

- **Tylko odczyt** — wysyłanie wiadomości przez MCP to osobna decyzja.
- **Tylko lokalny stdio** — brak trybu zdalnego.
- Sesja: logowanie leniwie przy pierwszym narzędziu; po wygaśnięciu sesji
  jedno przezroczyste ponowne zalogowanie.
- Błędy Librusa zwracają po polsku (`LibrusError.userMessage`) jako wynik
  `isError` — model może je cytować użytkownikowi.

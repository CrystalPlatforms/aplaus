# Plan: Aplaus

> Źródło PRD: [plans/aplaus-prd.md](./aplaus-prd.md) · issue [#1](https://github.com/CrystalPlatforms/aplaus/issues/1) · audyt API: [librus-api-audit.md](../librus-api-audit.md)

## Architectural decisions

Decyzje trwałe — obowiązują we wszystkich fazach (zmiana = powrót do PRD):

- **Architektura**: monorepo pnpm. Dostarczalne: `packages/librus-client` (głęboki moduł — cały protokół Librusa za wąskim interfejsem), `apps/data-service` (Worker: proxy + cron + push, wyłącznie KV), `apps/web` (PWA: React 19 + Vite + Tailwind + vite-plugin-pwa + TanStack Query). Plan 2: `apps/mcp`. Better Auth, Postgres i data-ops **usunięte** w fazie 1.
- **Model danych (KV, zero SQL)** — encje: `Device` (token nieprzejrzysty → lista kont), `Account` (meta: imię, rola; dwa słoiki cookies: G i M), `LastSeen` (stan diffów per konto per typ zdarzenia), `PushSubscription` (per urządzenie), `NotifPrefs` (per konto per typ).
- **Auth**: logowanie danymi Librusa z urządzenia; serwer zwraca token urządzenia; **hasła nigdy nie są zapisywane po stronie serwera**; słoik cookies konta w KV współdzielony przez urządzenia i cron; odnowienie sesji napędzane z urządzenia (401 → ciche re-logowanie hasłem z urządzenia → nowy słoik w KV).
- **Integracje**: nieoficjalne API Librusa — G `synergia.librus.pl/gateway/api/2.0` (dane szkolne) i M `wiadomosci.librus.pl/api` (wiadomości, osobna sesja przez MultiDomainLogon); Cloudflare Workers + KV + Cron + natywny web push (VAPID). Żadnych innych zewnętrznych serwisów.
- **Zasady z audytu**: `x-baner` przy logowaniu (znaki +20, `_`, Unix ms); Base64 UTF-8 dla topic/content; 404 na podpisach = pusta lista; obsługa 401/403/404 przed parsowaniem; **żadnych automatycznych retry wysyłki** przy niejednoznacznym wyniku; cron nigdy nie pobiera treści wiadomości (ryzyko oznaczenia jako przeczytana).
- **Ograniczenia repo**: max 500 linii na plik źródłowy; biome; `Result<T>` w serwisach; deploys wyłącznie przez CI (canary + gate na `/health/ready`); praca w miejscu, bez worktree/PR; commit/push tylko na polecenie (`/ship`).
- **Kolejność**: fundament → logowanie → dane szkolne (wzorzec odczytu) → konta → wiadomości (kontrakty HITL) → offline/PWA → push → design pass → MCP (plan 2).

---

## Phase 1: Reset repo

**Status**: zaimplementowane (issue #2). Worker przemianowany `hono-on-cf-ds` -> `aplaus-ds`;
KV w trzech środowiskach (placeholder id-y do podmiany przed pierwszym deployem); readiness
na probru KV (200/503). Puste katalogi po data-ops usunięte.

**User stories**: 36, 37 (część)

### What to build

Wycięcie z szablonu wszystkiego, czego Aplaus nie używa: Better Auth, Postgres, data-ops i ich konfiguracji/dokumentacji. Ustanowienie struktury: `packages/librus-client`, `apps/data-service`, `apps/web` (szkielet PWA React 19 + Vite + Tailwind), miejsce na plan 2. Readiness endpoint bez bazy: sprawdza dostępność bindowania KV. Pipeline CI zostaje nietknięty (trigger→env, canary, gate, rollback).

### Assumptions carried in

- Szablon działa i przechodzi własne weryfikacje (`types`, `test`, `check:docs`, `check:runtime-types`) przed zmianami.
- Cloudflare free tier jest wystarczający — brak zmian w konfiguracji konta.

### Out of scope for this phase

- Jakakolwiek logika Librusa (zaczyna się w fazie 2).
- UI poza pustym shelletem.

### Acceptance criteria

- [ ] `pnpm run types && pnpm run test && pnpm run lint` przechodzi po czyszczeniu — [command]
- [ ] `pnpm run check:docs && pnpm run check:runtime-types` przechodzi — [command]
- [ ] W manifestach i configu nie ma referencji do better-auth/postgres/drizzle (`grep -ri "better-auth\|postgres\|drizzle" package.json packages apps --include="*.json*"` zwraca pusto) — [command]
- [ ] `/health/ready` zwraca 200 przy obecnym bindingu KV i błąd bez niego — [test: integracyjny przez `app.request()`]

---

## Phase 2: Pocisk śledzący — logowanie

**Status**: zaimplementowane (issue #3). Odchylenie w górę: oprócz platformowego IP-limitera
(RATE_LIMIT_AUTH 20/min) login jest throttlowany per-login w KV — 5 nieudanych prób w 15 min
daje 429 (realizuje "5x bledne logowanie -> 429" z How to verify issue #3). Klucz licznika
to SHA-256 loginu, czyszczone po udanym logowaniu. Haslo nigdy nie trafia do KV. Ustalenie z diagnostyki na zywym API: POST danymi
idzie na adres OAuth **z parametrem state** i musi niesc cookies sesji OAuth
(auditowe "Cookie: <cookies odpowiedniej domeny>"); serwer odpowiada przekierowaniem,
ktore klient ponawia jako POST — dopiero wtedy dostaje JSON 200/403 errors[].
POST bez cookies albo na adres bez state konczy sie `error=invalid_request`.

**User stories**: 1, 3¹, 5¹, 6, 38

### What to build

Pierwszy pełny pion: ekran logowania (po polsku, w duchu Apple) → endpoint logowania w data-service (z rate limiterem z szablonu) → `librus-client` wykonuje prawdziwy protokół: portal → OAuth (`x-baner`) → `goTo` → Synergia, buduje słoik cookies G i pobiera `/Me` (imię, rola). Po sukcesie: token urządzenia (KV) + słoik w KV. Shell apki: dolna nawigacja (placeholdery), baner „Zalogowano jako \<imię — rola>". Taksonomia błędów z komunikatami po polsku: złe hasło (403 + `errors[]`), sesja wygasła (401), brak uprawnień (403), brak zasobu (404).

### Assumptions carried in

- Readiness/KV z fazy 1 działa; pipeline CI wdraża dev branch na staging.
- Pary logowania z audytu są ważne i aktywne.

### Out of scope for this phase

- Sesja M (wiadomości) — faza 8.
- Ciche odnawianie i wiele kont — faza 7 (tu: jednorazowy login, token, baner po zalogowaniu).
- Wszelkie dane poza `/Me`.

### Acceptance criteria

- [ ] Taniec logowania na mockach HTTP: portal→OAuth→`goTo`→Synergia; nagłówek `x-baner` ma format `<przekodowany-random>_<przekodowany-unix-ms>` (+20 na znak) — [test: unit librus-client]
- [ ] Słoik cookies trzymamy per domena/ścieżka (synergia vs api.librus.pl vs wiadomosci) — [test: unit]
- [ ] Błędne hasło (403 + `errors[]`) mapuje na typowany błąd z polskim komunikatem, bez crasha — [test: unit]
- [ ] POST login → token urządzenia w odpowiedzi; żądanie z tokenem przechodzi; bez tokenu 401 — [test: integracyjny `app.request()`]
- [ ] Po zalogowaniu KV zawiera słoik cookies i metę konta, a **nie zawiera hasła** — [test: integracyjny na KV-dubli]
- [ ] Nadmiarowe próby logowania dostają 429 — [test: integracyjny]
- [ ] HITL: logowanie jedną parą z audytu na dev stagingu pokazuje baner z imieniem i rolą — [observable: checklista HITL]

---

## Phase 3: Oceny end-to-end

**Status**: zaimplementowane (issue #4). Decyzja obliczeniowa: srednia liczy wylacznie oceny
`IsConstituent` z numeryczna etykieta ("5" = 5, "4+" = 4.5, "3-" = 2.75; etykiety slowne typu
"bz" nie licza sie). Nazwy przedmiotow i nauczycieli sa rozwiazywane z `Resources` gdy sa
dostepne, inaczej null (UI pokazuje "-", bez crashu).

**User stories**: 7, 8, 9

### What to build

Wzorzec odczytu dla całej apki: typowany reader `librus-client` (normalizacja kształtu G: `{Zasób, Resources, Url}`) → proxy GET w data-service autoryzowany tokenem urządzenia → widoki React z TanStack Query. Widoki ocen: lista per przedmiot i semestr; szczegół oceny (kategoria, komentarz, nauczyciel, daty, flagi `IsConstituent`/`IsSemester`/`IsFinal`); statystyki i średnie (liczone tylko z ocen liczących się do średniej).

### Assumptions carried in

- Logowanie i token z fazy 2 działają; nie ruszamy przepływu auth.
- Fixture z przykładów odpowiedzi audytu (JSON) reprezentuje kształty danych.

### Out of scope for this phase

- Kokpit (agreguje dane z faz 3–6).
- Push o nowej ocenie — faza 12.

### Acceptance criteria

- [ ] Reader normalizuje fixture `Grades` (w tym zagnieżdżone referencje `Subject`/`Category`/`AddedBy` jako `{Id,Url}`) — [test: unit na fixture z audytu]
- [ ] Proxy: bez tokenu 401; z tokenem zwraca znormalizowane oceny — [test: integracyjny]
- [ ] Średnia: liczy się wyłącznie `IsConstituent`; podział na semestry; puste dane nie wywalają NaN — [test: unit kalkulacji]
- [ ] HITL: oceny realnego konta widoczne na stagingu (lista, szczegół, statystyki) — [observable: checklista HITL]

---

## Phase 4: Plan lekcji + kalendarz

**Status**: zaimplementowane (issue #6). Arytmetyka tygodni jest kliencka (`shiftWeekStart` na
YYYY-MM-DD w librus-client); `Pages.Next/Prev` mapowane do `weekStart` jako wsparcie nawigacji.
Kształt elementów `ClassFreeDays` nie był obserwowany w audycie (puste tablice na wszystkich
kontach) — parser jest defensywny: element liczy się, gdy ma `Id` i `Date`, reszta opcjonalna.
Odwołane lekcje i zastępstwa wyróżnione `data-flag` + etykietą tekstową („Odwołana"/„Zastępstwo"),
nie tylko kolorem. Poprawki HITL: zastępstwa pokazują oryginalnego nauczyciela przekreślonego
→ nowego (pola `Org*` z załącznika audytu), lekcja otwiera arkusz szczegółów z przejściem do
osobnej strony ocen przedmiotu (`/grades/subject/:id`).

**User stories**: 10, 11, 12

### What to build

Rea­ders `Timetables?weekStart` (klucze dynamiczne — daty; slot może być pustą tablicą; flagi `IsCanceled`, `IsSubstitutionClass`) z nawigacją stronami `Pages.Next/Prev`; `Calendars` i `Calendars/ClassFreeDays`. Widok tygodnia (przełączanie tygodni, wyróżnione odwołane/zastępstwa) i kalendarz z dniami wolnymi.

### Assumptions carried in

- Wzorzec odczytu z fazy 3 (reader→proxy→React) jest stabilny i reużywany.

### Out of scope for this phase

- Zmiany planu w push — faza 12.

### Acceptance criteria

- [ ] Reader obsługuje dynamiczne klucze-daty i puste sloty bez rzutowania na `any` — [test: unit na fixture z audytu]
- [ ] Nawigacja tygodni buduje `weekStart` poprzedni/następny i mapuje `Pages.Next/Prev` — [test: unit]
- [ ] Odwołana lekcja i zastępstwo mają rozróżnialny, dostępny wizualnie wygląd (unit na view-model + przegląd HITL) — [test: unit]
- [ ] HITL: przełączenie tygodnia pokazuje inny plan; kalendarz pokazuje dni wolne — [observable: checklista HITL]

---

## Phase 5: Zadania domowe + frekwencja

**Status**: zaimplementowane (issue #7). Statystyka frekwencji mapuje `Identifier` z
`Attendances/Types`: `presence` → obecności, `absence` → usprawiedliwione, `absence_unexcused` →
nieusprawiedliwione, `lateness` → spóźnienia; typy o nieznanych identyfikatorach liczone per typ,
poza czterema kategoriami głównymi — semantyka do potwierdzenia w HITL. Po HITL: mapowanie jest
wielosygnałowe (Identifier → polska nazwa → skrót), bo realne słowniki zwracają Identifier null
lub zlokalizowany; ekran pokazuje też rozbicie per typ. Sale i oryginalni nauczyciele
zastępstw dopełniane z słowników /Classrooms i /Teachers (Resources odpowiedzi Timetables
niosą wyłącznie Urls — potwierdzone w danych audytu); oba słowniki best-effort (404/403 → pusto). Zadania: lista pokazuje skrót (2 linie),
pełna treść w arkuszu po tapnięciu.

**User stories**: 13, 14

### What to build

Readers `HomeWorks`, `HomeWorkAssignments` (uwaga: wielkie `W` — pułapka z audytu), `Attendances`, `Attendances/Types`. Widoki: lista zadań/wpisów z terminami i przedmiotem; lista obecności ze statystyką (usprawiedliwione / nieusprawiedliwione / spóźnienia, per semestr).

### Assumptions carried in

- Wzorzec odczytu z fazy 3.

### Out of scope for this phase

- Oddawanie prac domowych — poza zakresem PRD (brak kontraktu w audycie).
- Powiadomienia o zadaniach — faza 12.

### Acceptance criteria

- [ ] Reader używa dokładnej pisowni `HomeWorkAssignments` (test regresyjny pułapki 404 z audytu) — [test: unit]
- [ ] Statystyka frekwencji: poprawne zliczenia per typ z `Attendances/Types`; brak rekordów = zerowe statystyki, nie błąd — [test: unit]
- [ ] HITL: zadania i frekwencja realnego konta widoczne — [observable: checklista HITL]

---

## Phase 6: Kokpit + pozostałe odczyty + usprawiedliwienia

**User stories**: 23, 24, 25, 26, 27

### What to build

Readers: `SchoolNotices`, `Notes`, `ParentTeacherConferences`, `Schools`, `Classes`, `Subjects`, `Lessons`, `Justifications` (kształt `{status, message, data}` — wyjątek od G). Widoki: ogłoszenia z okresami, uwagi, zebrania, informacje szkole/klasie/przedmiotach. Kokpit: agregacja — najnowsze oceny, dzisiejszy plan, zadania na najbliższy czas, ogłoszenia. Widoczność usprawiedliwień tylko dla roli 5 (rodzic) — dla ucznia sekcja ukryta, żądanie nie wychodzi na serwer.

### Assumptions carried in

- Rola konta znana z fazy 2 (`/Me` / TokenInfo).

### Out of scope for this phase

- Składanie usprawiedliwień — poza zakresem PRD (brak kontraktu).
- „Szczęśliwy los" — poza zakresem (brak endpointu).

### Acceptance criteria

- [ ] Reader Justifications normalizuje `{status, message, data}` odrębnie od kształtu G — [test: unit na fixture z audytu]
- [ ] Gate roli: konto roli 8 nie generuje żądania Justifications (UI ukryte + brak wywołania proxy) — [test: unit/integracyjny]
- [ ] Każdy nowy reader ma test na fixture z audytu — [test: unit]
- [ ] HITL: kokpit renderuje karty z żywych danych konta rodzica i ucznia — [observable: checklista HITL]

---

## Phase 7: Konta — wiele kont i ciche odnawianie

**Status**: zaimplementowane (issue #5). Hasło per konto trzyma przeglądarka (localStorage
urządzenia); serwer nigdy go nie zapisuje. Odnawianie napędza urządzenie: 401 z proxy →
`POST /api/accounts/refresh` z loginem+hasłem z urządzenia → nowy słoik w KV → **jednokrotny**
retry żądania (współdzielony przy równoległych żądaniach); porażka odnowienia czyści sesję
i pokazuje ekran logowania. Przełączenie konta to `POST /api/accounts/switch` + unieważnienie
wszystkich cache'ów React Query. Poprawki HITL: „Dodaj konto" otwiera modal (nie formularz
w arkuszu), baner ma strzałkę w dół jako afordancję przełącznika. Nazwy nauczycieli w ocenach
rozwiązywane tolerancyjnie (Resources keys bywają z innym hostem niż `Url` referencji).

**User stories**: 2, 3, 4, 5

### What to build

Model wielu kont: dodanie konta (login+hasło → nowe konto w KV), przełącznik kont w shellu (dolna nawigacja/awatar), kontekst konta w każdym żądaniu proxy. Hasło trzymane wyłącznie w pamięci urządzenia (przechowywanie przeglądarki); serwer nigdy nie zapisuje. Ciche odnawianie: 401 z proxy → urządzenie wykonuje re-logowanie hasłem → nowy słoik w KV → jednokrotny retry żądania; baner „Zalogowano jako" po zalogowaniu, przełączeniu i odnowieniu.

### Assumptions carried in

- Przepływ logowania z fazy 2 da się wykonać ponownie dla drugiego konta bez zmian.

### Out of scope for this phase

- Przełączanie dzieci w jednym koncie rodzica — poza zakresem PRD (nietestowane); model „wiele kont".

### Acceptance criteria

- [ ] Urządzenie może posiadać ≥2 konta; przełączenie zmienia kontekst danych proxy (test: dwa konta → różne `/Me`) — [test: integracyjny]
- [ ] Wymuszone unieważnienie słoika w KV → 401 → automatyczne odnowienie → retry raz → odpowiedź OK; druga porażka = ekran logowania — [test: integracyjny z mockiem librus-client]
- [ ] Zapisy KV po dodaniu konta nie zawierają pola hasła (asercja na payload) — [test: integracyjny]
- [ ] HITL: baner widoczny w trzech momentach (login, przełączenie, odnowienie po sztucznym wygaśnięciu) — [observable: checklista HITL]

---

## Phase 8: Wiadomości — odczyt

**User stories**: 15

### What to build

Sesja M: łańcuch `wiadomosci3` → `MultiDomainLogon` (domena wiadomosci.librus.pl, osobny słoik). Readers: `/me` (M), `/inbox/messages` + `total`, `/outbox/messages`, `/inbox/unreadMessagesCount`, `/tags`, `/receivers/types`, `/receivers/custom-groups`. Widoki: folder odebrane/wysłane (paginacja), treść wiadomości, lista załączników, nieprzeczytane wyróżnione. Otwarcie wiadomości w UI naturalnie oznacza przeczytaną w Librusie — zachowanie zaakceptowane (serwer cron w fazie 12 tego nie robi).

### Assumptions carried in

- MultiDomainLogon działa wg audytu dla wszystkich par; token w URL jest poufny (nie logujemy).
- 404 na `/signatures` = pusta lista (faza 10 korzysta).

### Out of scope for this phase

- Wszelkie zapisy (szkice/wysyłka) — faza 9 i 10.
- Kosz, przenoszenie — faza 10.

### Acceptance criteria

- [ ] Łańcuch sesji M na mockach: wiadomosci3 → MultiDomainLogon → słoik per domena; sekretne parametry nie trafiają do logów — [test: unit]
- [ ] Reader inbox normalizuje `{data, total}` z parametrami `page`/`limit` — [test: unit na fixture z audytu]
- [ ] HITL: skrzynka realnego konta pokazuje wiadomości; nieprzeczytane wyróżnione; licznik zgadza się z Librusem — [observable: checklista HITL]

---

## Phase 9: Wiadomości — szkice + wysyłka (HITL)

**User stories**: 16, 17

### What to build

Kompozytor: wybór odbiorców (typy + własne grupy), temat, treść (HTML, escape), kodowanie Base64. Szkice: tworzenie (`newOne`), edycja (`PUT newOne/{id}`), usuwanie — kontrakt potwierdzony audytem. Wysyłka `POST /messages` wg kontraktu z kodu klienta Librusa — za wyraźną akcją użytkownika, **bez automatycznego retry** przy niejednoznacznym wyniku. Pierwszy send wykonuje interesariusz po checkliście.

### Assumptions carried in

- Sesja M z fazy 8 działa dla zapisów (audyt potwierdził szkice na wszystkich parach).
- Kontrakt wysyłki (receivers/topic/content/storageId/category, response 201 `{data:{messageId,status}}`) jest poprawny; poprawki możliwe po HITL.

### Out of scope for this phase

- Odpowiedź/przekazanie, załączniki, podpisy, etykiety, kosz — faza 10.

### Acceptance criteria

- [ ] Body szkica i wysyłki zgodne z kontraktem audytu (Base64 topic/content, `receivers.schoolReceivers`, `storageId: null` bez plików, `category`) — [test: kontraktowy unit]
- [ ] Szkic: create→read→update→read→delete na mockach; treść po update zgodna — [test: unit]
- [ ] Brak automatycznego retry wysyłki (asercja: dokładnie jedno żądanie przy błędzie/niejednoznaczności) — [test: unit]
- [ ] HITL: checklista pierwszego send na realnym koncie; weryfikacja odbioru w oryginalnym Librusie; raport rozbieżności przed zamknięciem fazy — [observable: checklista HITL]

---

## Phase 10: Wiadomości — pełny obieg (HITL)

**User stories**: 18, 19, 20, 21, 22

### What to build

Odpowiedź i przekazanie (szkice reply/forward z `repliedToMessageId`/`forwardedMessageId` jako string + send). Załączniki: `files-storage` (storageId), upload multipart, usunięcie pliku; upload w kompozytorze. Podpisy: lista (404=pusta), create/modify/delete. Etykiety i własne grupy odbiorców: CRUD. Kosz: przeniesienie (`DELETE /messages/{id}`), przywrócenie, trwałe usunięcie — z potwierdzeniem w UI.

### Assumptions carried in

- Szkice i wysyłka z fazy 9 działają; faza dodaje warianty kontekstowe.

### Out of scope for this phase

- Wycofywanie wysłanej wiadomości (`/messages/{id}/withdrawal`) — poza PRD (warunki niezweryfikowane w audycie); ewentualnie osobny issue po aktualizacji PRD.
- Odczytywanie treści przez cron — trwale zabronione (faza 12).

### Acceptance criteria

- [ ] Body reply/forward zawiera `repliedToMessageId`/`forwardedMessageId` jako **string** — [test: kontraktowy unit]
- [ ] Sekwencja załączników: storage → upload (multipart kształt) → usunięcie — na mockach — [test: unit]
- [ ] CRUD podpisów/etykiet/grup na mockach; 404 podpisów → pusta lista — [test: unit]
- [ ] Kosz: przenieś→przywróć→usuń trwale na mockach; UI wymaga potwierdzenia trwałego usunięcia — [test: unit]
- [ ] HITL: checklista per operacja (reply, forward, plik, podpis, etykieta, kosz) na realnym koncie z weryfikacją w Librusie — [observable: checklista HITL]

---

## Phase 11: Offline + instalacja PWA

**User stories**: 32, 33

### What to build

`vite-plugin-pwa`: manifest (nazwa Aplaus, ikony, splash), service worker, cache odpowiedzi API (IndexedDB) — ostatnie dane widoczne offline z banerem „brak internetu", szkielet apki offline. Instrukcja instalacji: Android (Chrome) i iOS (Dodaj do ekranu głównego; push od fazy 12 wymaga instalacji na iOS).

### Assumptions carried in

- Cache na urządzeniu nie łamie zasady „zero własnej bazy" (to pamięć podręczna klienta, nie dane aplikacji).
- Push nie istnieje jeszcze — instalacja bez niego ma być już w pełni użyteczna.

### Out of scope for this phase

- Push — faza 12.
- Motywy/design pass — faza 13.

### Acceptance criteria

- [ ] Lighthouse: PWA „installable" = yes, manifest bez błędów — [command: audyt Lighthouse na buildzie]
- [ ] Warstwa offline: przy nieudanym fetch widok renderuje ostatnie dane + baner (brak crasha, brak pustego ekranu) — [test: integracyjny web]
- [ ] HITL: tryb samolotowy — ostatnie dane widoczne, baner widoczny — [observable: checklista HITL]
- [ ] HITL: instalacja na Androidzie i iPhonie; ikona i nazwa poprawne — [observable: checklista HITL]

---

## Phase 12: Push

**User stories**: 28, 29, 30, 31

### What to build

Klucze VAPID (secrets), rejestracja subskrypcji per urządzenie w KV, preferencje per konto per typ (8 przełączników). Cron co ~5 min: dla każdego konta z żywym słoikiem G(+M dla wiadomości) pobiera metadane 8 zasobów (Grades, inbox count + pierwsza strona listy, SchoolNotices, Attendances, HomeWorks/HomeWorkAssignments, Notes, Timetables tygodnia bieżącego, ParentTeacherConferences), robi diff z `LastSeen` i wysyła web push z deep-linkiem do właściwego widoku. Słoik wygasł → push „sesja Librusa wygasła — otwórz Aplaus", odpytywanie konta wstrzymane. **Cron nigdy nie pobiera treści wiadomości** (tylko listy/liczniki).

### Assumptions carried in

- PWA jest zainstalowana na urządzeniach docelowych (faza 11) — warunek push na iOS.
- Free tier KV/Workers udźwignie 4 konta × poll co 5 min; zapisy LastSeen tylko przy zmianach.

### Out of scope for this phase

- Cisza nocna — odrzucona w PRD (zawsze powiadamiaj od razu).
- Push bez zainstalowanej PWA na iOS — ograniczenie platformy, nie naprawiamy.

### Acceptance criteria

- [ ] Diff: 8 scenariuszy fixture → poprawne powiadomienie per typ; drugi poll tego samego stanu = zero powiadomień (bez duplikatów) — [test: unit]
- [ ] Przełącznik typu na „off" wycisza dany typ; pozostałe działają — [test: unit]
- [ ] Wygasły słoik → dokładnie jeden push „sesja wygasła", konto wstrzymane do odnowienia — [test: unit]
- [ ] Zestaw endpointów używanych przez cron to podzbiór list/metryk (treść wiadomości wykluczona) — [test: unit na rejestr wywołań]
- [ ] HITL: nowa ocena wpisana w Librusie → push ≤ 5 min na urządzeniu; tapnięcie otwiera właściwy widok — [observable: checklista HITL]
- [ ] HITL: push „sesja wygasła" po sztucznym skasowaniu słoika — [observable: checklista HITL]

---

## Phase 13: Design pass — motywy i HIG

**User stories**: 34, 35

### What to build

Przegląd `/apple-design` wszystkich widoków: system tokenów (kolory, typografia, odstępy, ruch), motywy jasny / ciemny / systemowy z zapisem wyboru, translucencja/cienie, animacje zgodne z HIG, `prefers-reduced-motion`. Ujednolicone stany każdego widoku: ładowanie / pusty / błąd / offline. Audyt polszczyzny tekstów UI.

### Assumptions carried in

- Wszystkie widoki funkcjonalnie kompletne (fazy 2–12); zmieniamy warstwę prezentacji, nie zachowanie.

### Out of scope for this phase

- Nowe funkcje — tylko wygląd, stany i motywy.
- Angielski interfejs — poza zakresem PRD.

### Acceptance criteria

- [ ] Przełącznik motywów: jasny/ciemny/system; wybór przeżywa restart apki; tryb systemowy podąża za OS — [test: komponentowy + HITL]
- [ ] Żadnych „na sztywno" wpisanych kolorów w widokach poza tokenami — [command: `grep` na hardcoded hex poza plikami tokenów]
- [ ] Lighthouse: a11y ≥ 90 na głównych widokach — [command]
- [ ] HITL: przegląd wszystkich widoków w obu motywach wg checklisty (stany ładowanie/pusto/błąd/offline) — [observable: checklista HITL]

---

## Phase 14: PLAN 2 — serwer MCP

**User stories**: 39

### What to build

Lokalny serwer MCP (stdio) reużywający `librus-client`: narzędzia typu „oceny z przedmiotu", „plan na dziś/jutro", „nieprzeczytane wiadomości" (metadane), „zadania na najbliższy czas", „ogłoszenia". Konfiguracja lokalna u właściciela (dane konta z urządzenia/konfiguracji lokalnej — nie z serwera produkcyjnego). Do wdrożenia po stabilizacji Planu 1.

### Assumptions carried in

- `librus-client` jest stabilny po Planie 1 (MCP to kolejny konsument tego samego modułu).

### Out of scope for this phase

- Zapisy przez MCP (wysyłanie wiadomości) — tylko odczyt; rozszerzenie jako osobna decyzja.
- Publiczny/zdalny MCP — tylko lokalny stdio.

### Acceptance criteria

- [ ] Serwer startuje i zgłasza narzędzia (inspektor MCP / rejestracja w kliencie) — [command]
- [ ] Handlery narzędzi zwracają typowane dane z mockiem librus-client — [test: unit]
- [ ] HITL: 3 przykładowe pytania w czacie Claude'a odpowiadane poprawnie z realnych danych — [observable: checklista HITL]

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

**Status**: zaimplementowane (issue #8). Readery G (`SchoolNotices`, `Notes`, `Schools`,
`Classes`, `Lessons`, `ParentTeacherConferences`, `Justifications`; `Subjects` istniał od fazy 3).
`Notes` i `Schools.LessonsRange` nie były obserwowane w audycie — parsery defensywne (element
liczy się z `Id`, reszta opcjonalna; analogicznie jak `ClassFreeDays` w fazie 4). `Justifications`
parsuje wyjątkowy kształt `{status, message, data}` (lowercase). Bramka roli jest dwuwarstwowa:
web ukrywa sekcję i nie inicjuje query (`enabled`), a proxy odpowiada FORBIDDEN dla `groupId !== 5`
bez wołania Librusa. Kokpit agreguje kliencko (czysty vm: najnowsze oceny, dzisiejszy plan bez
odwołanych, zadania od najbliższego terminu z fallbackiem na zaległe, ogłoszenia w mocy) — zakładka
Start. Odchylenie w górę: `AccountView` (serwer i web) doliczyło `groupId`, bo gate po etykiecie
roli byłby kruchy. Poprawki HITL: nazwy przedmiotów/nauczycieli lekcji i wychowawca dopełniane
ze słowników /Subjects i /Teachers na proxy (koperta /Lessons i /Classes nie niesie nazw na
żywych kontach); ogłoszenia pokazują 3 linijki treści, pełną w arkuszu po tapnięciu; etykiety
statusów odwrócone — aktualne ogłoszenie to norma (bez etykiety), wyróżniane są „Zakończone"
i „Nadchodzące"; zebrania otwierają arkusz ze szczegółami. Poprawki HITL (runda 2): treść
wiadomości M przychodzi **Base64 (UTF-8)** — potwierdzone na żywym koncie, `decodeMaybeBase64`
dekoduje topic/content (alfabet Base64 + poprawne UTF-8; zwykły tekst przepuszczany bez zmian);
ogłoszenia i zebrania zamiast arkuszy mają **osobne widoki** `/more/notices/notice/:id` oraz
`/more/conferences/:id` (dane z cache listy, bez dodatkowych żądań); nazwy nauczycieli lekcji
i wychowawca dopełniane z `Users/{id}` (koperta `/Lessons` i `/Classes` nie niesie nazw,
a `/Teachers` odpowiada 404 na żywych kontach — jak przy ocenach), best-effort, do 30 zapytań;
lista lekcji deduplikowana po parze (przedmiot, nauczyciel), bo `/Lessons` zwraca jedną pozycję
na grupę tygodniową (stąd powtórzone WF/niemiecki). Poprawki HITL (runda 3): szczegóły wiadomości
na żywych kontach potrafią zwrócić treść skróconą albo pod inną nazwą pola (treść „znikała"
po dojściu detalu) — reader czyta wszystkie obserwowane warianty pola (`content`, `body`,
`text`, `messageContent`…), a ekran renderuje **dłuższą** z dwóch dostępnych treści
(detal vs cache listy) z dopiskiem, gdy tekst pochodzi z listy. Poprawki HITL (runda 4,
kontrakt z publicznego kodu klienta wiadomości Librusa — bez żywych danych): pełna treść
wiadomości jest w polu **`Message`** (wielkie M) odpowiedzi detalu, a po dekodowaniu Base64
może być w kopercie XML `<Content>…</Content>` — reader czyta `Message` najpierw i rozpakowuje
kopertę; `content` z listy to tylko skrócony podgląd. **Pobieranie załączników** weszło wcześniej
niż planowana faza 10: kontrakt `GET /attachments/{fileId}/messages/{messageId}` z tego samego
kodu klienta; proxy `/api/messages/attachments/:fileId/:messageId` strumieniuje bajty z nazwą
z Content-Disposition, ekran renderuje załączniki jako przyciski pobierania. Dopisek
„Pokazano pełniejszą treść z listy" usunięty (decyzja HITL). Czcionka wordmarku Aplaus:
ADLaM Display → **Aldrich** (splash + ekran logowania). Poprawki HITL (runda 5, diagnostyka
na żywej sesji za zgodą właściciela): potwierdzone 200 i pełny kształt detalu
`/outbox/messages/{id}` (pole `Message`, `attachments`, flaga `archive`, `receivers`,
`readedCount`); `content` z listy to podgląd ucięty na ~100 bajtach Base64; curl bez sesji:
`/outbox/messages/{id}` → 401 (endpoint istnieje), `/messages/{id}` → 404 (to nie jest trasa
detalu). Detal wysłanych, który nie chce się otworzyć, to najpewniej wiadomość w **archiwum** —
fallback detalu zmieniony z martwej ścieżki `/messages/{id}` na `/archive/messages/{id}`
(kontrakt z kodu oficjalnego klienta); skrypt diagnostyczny poza repo (/tmp), nie commitowany.
Poprawki HITL (runda 6): zdekodowana treść to koperta **`<Message><Content><![CDATA[treść]]></Content>…</Message>`**
— ekstrakcja bierze pierwszy węzeł `Content` gdziekolwiek w dokumencie (jak `getElementsByTagName`
w oficjalnym kliencie), a ucięty podgląd z listy pokazuje częściowy tekst po otwierającym
znaczniku zamiast surowych tagów XML; czyszczenie stosowane i na liście, i na detalu.
Poprawki HITL (runda 7 — trasa archiwum + twardość ekstrakcji): analiza bundla oficjalnego
klienta pokazała, że szczegóły archiwalne czyta z tras **`/archive/inbox|outbox/messages/{id}`**
(plain `/archive/messages` to tylko DELETE oficjalnego klienta) — fallback detalu kolejno:
`{folder}/messages/{id}` → `archive/{folder}/messages/{id}` → `archive/messages/{id}`.
Miękka śmierć sesji M (200 z HTML-em logowania po przekierowaniach) rzuca teraz
`SESSION_EXPIRED`, więc jednorazowe ponowne zestawienie jar-a M faktycznie się uruchamia.
`contentOf` dekoduje i czyści **wszystkie** znane pola treści i wybiera najdłuższy kandydat
(krótki `content` nie może zamaskować pełnego `Message`); brak węzła `Content` → strip tagów
(jak parsererror→raw→DOMPurify w oficjalnym kliencie); archiwalny payload bez `messageId`
dostaje id z żądania. UI detalu: gdy detal padnie, a z cache listy zostaje ucięty podgląd,
ekran mówi wprost („skrócony podgląd") i daje „Spróbuj ponownie" zamiast cichego cięcia.
Poprawka HITL (runda 8 — PRAWDZIWY korzeń „Nie udało się pobrać" dla wysłanych): w handlerze
wiadomości **nie było trasy `GET /api/messages/outbox/:id`** — web pytał `/api/messages/outbox/...`
i dostawał Hono 404, więc szczegóły WYSLANYCH nigdy się nie otwierały (odebrane miały trasę).
Dodana trasa + `getOutboxDetail`; regresja zabezpieczona testem HTTP (`App.request`) assertującym
200 oraz wywołanie readera z folderem `outbox`.

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

**Status**: zaimplementowane (issue #9). Łańcuch sesji M (`wiadomosci3` → `MultiDomainLogon`)
ustanawia słoik M per konto obok słoika G (`AccountRecord.mJar` w KV); proxy sam naprawia sesję —
brak słoika lub 401 z M wyzwala jednokrotne ustanowienie z obecnego słoika G, bez haseł i bez
dodatkowego logowania urządzenia. Sekretne parametry URL (token, login) nie są nigdzie logowane
(test pilnuje czystości konsoli podczas łańcucha). Odchylenie od audytu:
detal wiadomości (`/inbox/messages/{id}`) był poza zakresem audytu, więc czytany defensywnie
(`data` obiekt + `attachments` opcjonalnie); otwarcie w UI oznacza przeczytaną (zaakceptowane) —
ekran detalu invaliduje listę i licznik dokładnie raz, a licznik nieprzeczytanych czytany jest
osobnym, pojedynczym żądaniem metadanych (test na rejestrze wywołań). Zakładka Wiadomości dostała
badge z licznikiem; paginacja `page`/`limit` walidowana zod-em (limit ≤ 50). Poprawki HITL:
odpowiedź detalu na żywym koncie nie miała `content` — reader czyta też `body` (asymetria
z audytu: request `content`, response `body`); gdy Librus odmówi szczegółów (404 na obu
ścieżkach), ekran renderuje treść z cache listy z dopiskiem „Pokazano treść z listy";
adresowanie detalu ma fallback `/{folder}/messages/{id}` → `/messages/{id}` (zapis w audycie
używa `/messages/{id}`); nazwy załączników czytane heurystycznie (klucze + dowolny string
wyglądający jak nazwa pliku), pliki bez nazwy dostają numer „Załącznik N" zamiast mylącego
„plik"; pobieranie plików pozostaje poza zakresem fazy (lista załączników wg PRD).

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


### Implementation notes (2026-10-14)

- Zrealizowane: `packages/librus-client/src/drafts.ts` (szkice newOne + send + kontekst reply/forward
  jako string), proxy `/api/messages/{send,drafts...}`, kompozytor + lista szkiców w PWA.
- Aktualizacja po HITL rundzie 1: kompozytor ma teraz **picker osób z kategorii**
  (`readReceiversByType` w `receivers.ts`, `GET /api/messages/receivers?type=`) zamiast ręcznego
  accountId. Ścieżka (`receivers/{type}`, fallback zbiorcze `receivers`) jest wyprowadzona, nie
  zaaudytowana — HITL potwierdza.
- Aktualizacja po HITL rundzie 1: część zapisów M odpowiada 200/201 z PUSTYM body mimo sukcesu
  (szkic, kosz) — warstwa zapisu traktuje puste echo jako sukces bez potwierdzenia; wysyłka z
  pustym echem zgłasza sukces z nieznanym id (bez błędu, żeby nie prowokować duplikatu).
- Wysyłka: dokładnie jedno żądanie `POST /messages`; ponowienie wyłącznie po odnowieniu sesji M
  przy 401 (401 = nic nie zostało dostarczone). Przy 5xx/network error błąd idzie do UI bez ponowienia.

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


### Implementation notes (2026-10-14)

- Zrealizowane: `packages/librus-client/src/messages-ops.ts` (załączniki, podpisy, etykiety, grupy,
  kosz), proxy `/api/messages/{signatures,tags,receivers/custom-groups,trash,attachments...}`, UI:
  akcje reply/forward/kosz na wiadomości, Kosz w liście folderów, ustawienia podpisów/etykiet/grup.
- Odstępstwa: (1) ścieżka listy kosza `/trash-bin/messages` jest wyprowadzona z zaaudytowanej trasy
  restore, nie zaaudytowana wprost; (2) modyfikacja podpisu istnieje end-to-end (API), ale UI ma
  tylko create/delete; zmiana nazwy etykiety/grupy istnieje w API, UI bez rename; (3) wysyłka
  z kontekstem (`repliedToMessageId`/`forwardedMessageId` w `POST /messages`) jest z kontraktu
  klienta Librusa — do potwierdzenia w HITL.

### Implementation notes — HITL runda 21 (2026-10-14) — HITL zdany ✅

- **Użytkownik potwierdził: „wszystko działa”** (odbiorcy, etykiety, grupy, wysyłka).
- Dokończone stany ładowania przycisków (wzorem „Przenoszenie…”): Przywracanie…/Usuwanie…
  (kosz), Usuwanie… (szkice), Dodawanie…/Usuwanie… (podpisy, etykiety, grupy — z
  disabled per wiersz po mutation.variables), istniejące zachowane (Zapisywanie…,
  Wysyłanie…, Sprawdzam…, Skanuję…).
- **Spinner przed każdym napisem statusu**: `ButtonSpinner` (components/Loader.tsx) — mały
  (12px) pierścień kropek jak w loaderze aplikacji, kropki BIAŁE (decyzja użytkownika z innego
  czatu; cienka ciemna obwódka dla widoczności na jasnych tłach), wstawiany PRZED tekstem.
  Zasada zapisana w .claude/CLAUDE.md (UI conventions).

### Implementation notes — HITL runda 20 (2026-10-14) — final picker

- Decyzja użytkownika: kompozytor ma DOKŁADNIE dwie kategorie + własne grupy:
  **Wychowawcy** (wychowawca ucznia z student-subjects) i **Kadra szkoły** (wszyscy
  pracownicy z /receivers/groups/school-employees, search po nazwisku) + „Grupa: {name}".
- Słownik typów Librusa przestał zasilać listę kategorii (useReceiverTypes zostaje tylko
  do etykiet chipów); default kategorii: Wychowawcy.

### Implementation notes — HITL runda 19 (2026-10-14)

- Korekta po prośbie użytkownika („tylko kategorie które Librus wysyła”): eksperyment
  kategorii-przedmiotów (subject-{id}) WYCOFANY — wracają kategorie ze słownika
  /receivers/types (Wychowawcy, Nauczyciele, Dyrektorzy, Rada rodziców, Bibliotekarz,
  Inny specjalista, Admin). Kategorie pracowników wypełnia lista kadry szkoły
  (/receivers/groups/school-employees — jedyne źródło personelu, jak w oficjalnym
  kliencie); Wychowawcy/Nauczyciele precyzyjnie z student-subjects; rady rodziców puste.
- Trasa /receivers/student-subjects i readStudentSubjects usunięte (eksperyment).

### Implementation notes — HITL runda 18 (2026-10-14)

- Prośba użytkownika: tylko kategorie Librusa (usuń wymyśloną „Kadrę szkoły”); oficjalny
  Librus pozwala z konta ucznia pisać do wszystkich. Wdrożone: kategorie = słownik
  /receivers/types; kategorie pracowników bez dedykowanego źródła (headteachers, librarian,
  otherSpecialist, admin, schoolParentsCouncil...) wypełnia lista kadry szkoły (200 dla
  ucznia); rady rodziców (403) zostają puste. Statyczna opcja „Kadra szkoły” usunięta.

### Implementation notes — HITL runda 17 (2026-10-14)

- Prośba użytkownika: pisać też do nauczycieli spoza własnych przedmiotów. Nowa kategoria
  **„Kadra szkoły (wszyscy)”** (typeId `school-employees`) → `/receivers/groups/
  school-employees` (200 na koncie ucznia, pełna lista {accountId, label}); search filtruje
  po nazwisku. Chipy odbiorców mają statyczne etykiety kategorii (STATIC_TYPE_LABELS).
- Kategorie osobiste pozostają: Nauczyciele (własne przedmioty), Wychowawcy („Godzina
  wychowawcza”), grupy własne.

### Implementation notes — HITL runda 16 (2026-10-14) — ODBIORCY DZIAŁAJĄ ✅

- HITL: „SUKCES! są odbiorcy” — picker pokazuje osoby. Sortowanie na kategorie wg danych,
  które Librus realnie udostępnia koncie ucznia (ground truth z testera):
  - **Nauczyciele** = `/receivers/student-subjects` ({teacherIdentifier, subject}) × nazwiska
    z `/receivers/groups/school-employees` ({accountId, label}) → „Banachewicz Ewa — Muzyka”;
  - **Wychowawcy** = nauczyciel z przedmiotem „Godzina wychowawcza” (samo nazwisko);
  - **kadra szkoły** = {receivers:[{accountId,label}]} — obsługiwany kształt (label jako nazwa,
    generyczne kontenery receivers/list/items);
  - **członkownie własnych grup** = /receivers/custom-groups/{id}/receivers-management (200;
    pusta grupa = pusta lista — poprawne);
  - kategorie bez źródła dla ucznia (Dyrektorzy, Bibliotekarz, Rada rodziców = 403) → pusta
    lista z uczciwym komunikatem (globalny fallback kadry usunięty — był niezgodny z kategoriami).
- Probe: usunięte POST-proby etykiet/grup (kontrakty potwierdzone — tester nie tworzy już śmieci).

### Implementation notes — HITL runda 15 (2026-10-14) — ETYKIETY DZIAŁAJĄ ✅

- **HITL: „JEST, dodało się! Etykiety działają!”** — potwierdzony kontrakt zadziałał od
  pierwszego żądania: `{name, colorRGB: <hex bez # wielkimi>}`; mapa 30 nazw CSS -> hex
  w `messages-ops.ts`; lista etykiet pokazuje kropkę koloru (odczyt colorRGB/tagId).
- Odbiorcy — kolejne tory (nadal 404 na groups/{typ} dla „tutors”):
  1. **członkowie własnych grup**: prawa trasa ze skanu
     `/receivers/custom-groups/{id}/receivers-management`; pseudo-typ `group-{id}` w
     readReceiversByType; kompozytor pokazuje grupy użytkownika w selekcji kategorii
     („Grupa: {name}”) — odbiorcy wybieralni z własnych grup JUŻ TERAZ.
  2. nowe kandydaty: `/receivers/student-subjects`, `/receivers/jst/subjects`,
     `/receivers/groups` (zbiorcza) — w readReceiversByType i probe.

### Implementation notes — HITL runda 14 (2026-10-14)

- Nawet nazwa CSS („khaki”) → 422 MISSING_COLOR_RGB. Nowe hipotezy w grze:
  (1) stary formularz etykiet (zrzuty użytkownika) to HTML — stare API mogło brać
  **form-urlencoded**; probe próbuje POST /tags z ciałem `name=...&colorRgb=khaki`
  (probeOnce: string w body = urlencoded, obiekt = JSON), plus trasy /tags/new i PUT /tags.
  (2) formularz etykiet żyje w starym module wiadomości — skaner v6 poluje na niego:
  strony synergii (sesja G) + ramki iframe, wzorce <form action>, „Etykiet…”, modules/msg.
- Wynik rozstrzygnie tester + skaner (przyciski w ustawieniach wiadomości).

### Implementation notes — HITL runda 13 (2026-10-14) — ZAGADKA KOLORU ROZWIĄZANA

- Użytkownik przesłał zrzuty ekranu STAREGO formularza Librusa („Etykiety wiadomości”):
  pole Kolor to select z **nazwami kolorów CSS** (khaki, lightskyblue, …, lawngreen — 30
  pozycji). `colorRgb` przyjmuje więc NAZWĘ CSS, nie hex — stąd wszystkie 422.
- Wdrożone: paleta UI = dokładna lista Librusa jako select (domyślnie „khaki”, jak u nich)
  z podglądem swatcha; createTag wysyła nazwę as-is (warianty hex tylko dla wejścia hex);
  TagWriteSchema przyjmuje nazwy (3-20 znaków); probe: POST /tags z „khaki”.
- Odbiorcy: wdrożone w r.12 prawdziwe trasy /receivers/groups/{grupa} — do potwierdzenia HITL.

### Implementation notes — HITL runda 12 (2026-10-14) — TABELA ENDPOINTÓW KLIENTA

- Skaner wyciągnął stałą tabelę tras oficjalnego klienta (r.11 skanował już właściwe chunki):
  **`/receivers/groups/{grupa}`** (+ warianty `jst-teachers`, `jst-parents`, `jst-students`,
  `jst-school-employees`, `school-employees`, `students-and-attendants`, `class-parents`,
  `kindergarteners`), `/receivers/jst/subjects`, `/receivers/student-subjects`,
  `/receivers/custom-groups/{id}/receivers-management` (członkowie grupy!),
  `/tags`, `/tags/{id}`, `/tags/{id}/messages-attachment`, plus potwierdzenia naszych tras
  (`/trash-bin/messages/{id}/restore`, `/signatures/create|modify/{id}`).
- Kształty: osoby mają `receiverId` (nie accountId) i `availabilityStatus`; tagi czytane jako
  `tagId`. Wdrożone: readReceiversByType próbuje `receivers/groups/{typ}` → `jst-{typ}` →
  stare kandydaci; `receiverId` w entryAccountIdOf; `tagId` w readTags. Probe: GET
  receivers/groups/{typ} i jst-{typ}. Etykiety: string „colorRgb” NIE występuje w paczkach
  ucznia — moduł tworzenia etykiet prawdopodobnie nie ładuje się dla konta ucznia.
- Skaner: limit paczek 24→40, kolejka 40→64, wzorzec `color-field` (colorXxx: =).

### Implementation notes — HITL runda 11 (2026-10-14)

- Skan r.10: kolejka zalała się fragmentem „et.js” (regex chunków łapał ogonki słów typu
  „target.js”) i limit 16 poszedł na 14× ten sam plik — prawdziwe lazy chunki niedosięgnięte.
- Skaner v5: deduplikacja kolejki (Set), chunki tylko po nazewnictwie Vite
  `Nazwa-HASH.js` (myślnik + hasz odfiltrowuje śmieci), HTML czyta script src + modulepreload,
  limit 24 paczek. Fix TDZ `isVendor` (ReferenceError połykany przez try/catch).

### Implementation notes — HITL runda 10 (2026-10-14) — APLIKACJA ZNALEZIONA

- **Skaner trafił na prawdziwą aplikację**: `START → https://wiadomosci.librus.pl/nowy/`
  („Librus - Wiadomości”, paczki w /nowy/assets/). Wcześniej: root = „Portal LIBRUS” (login),
  wszystkie zgadywane ścieżki = 404 — aplikacja żyje wyłącznie pod /nowy/.
- Pierwszy skan /nowy/ dał mało: limit 8 paczek zużyły biblioteki (react/moment), chunki z
  logiką nie zdążyły. Wzorzec `receivers/crossed-out-students` dowodzi, że endpointy
  /receivers/... istnieją (nasze 404 to złe nazwy, nie brak modułu).
- Skaner v4: pomija vendory (react|moment|scheduler|sentry|vendor|jquery), skanuje 16 paczek,
  rozwija chunki z KAŻDEJ paczki (limit kolejki 24), nowe wzorce: pełne ścieżki
  `receivers/...` i kontekst „tag + color”. Limity dopasowań 60→120.

### Implementation notes — HITL runda 9 (2026-10-14)

- **Grupy potwierdzone w 100%**: tester utworzył grupę `201 {"groupId":21109,"name":"Probe-Aplaus"}`;
  lista `{groups:[...]}` czytana poprawnie. „Reszta działa”.
- Etykiety: sweep 6 kanonicznych kolorów też 422 MISSING_COLOR_RGB — palety sztywnej nie
  potwierdzono; kontrakt trzeba wyciągnąć z paczki JS prawdziwego klienta.
- Skaner v3: skanuje **ścieżką prawdziwego klienta** (synergia/wiadomosci3 z sesją G — ta sama,
  którą ustawia sesja M; `walk.url` to wejście aplikacji), fallback: kandydaci na domenie M.
  Raport: linia START (landing URL) + kandydaci z tytułami i rozpoznaniem (stara-aplikacja/
  logowanie/aplikacja) + fragment wejścia + skanowane paczki + druga warstwa chunków.
- Wynik r.8 skanera (na domenie M): root = „Portal LIBRUS” (logowanie), pozostałe ścieżki 404 —
  aplikacja nie jest hostowana pod zgadywanymi ścieżkami; stąd skok na łańcuch synergii.

### Implementation notes — HITL runda 8 (2026-10-14)

- Etykiety: opakowane ciało `{tag:{...}}` dostało MISSING_NAME + MISSING_COLOR_RGB — walidator
  czyta top-level; `name` (string) PRZECHODZI, `colorRgb` nie wiąże się w żadnym z 11 kształtów.
  Zgadywanie zakończone — **Skaner kodu klienta** (`client-scan.ts`, `GET /api/messages/
  client-scan`, przycisk „Skanuj kod klienta Librusa” w ustawieniach): pobiera HTML wejścia SPA
  (kandydaci `/`, `/!messages_v2`, `/messages_v2`, `/!messages3`, `/messages3`, `/app`) i paczki
  JS żywą sesją M, regexuje endpointy receiver / colorRgb / trasy tags — to samo źródło prawdy,
  z którego korzystał audyt, zautomatyzowane bez DevTools.
- Odbiorcy: członkowie grup (custom-groups/{id} i …/{id}/receivers) → 404; types/{t}/search →
  404. Skaner powinien pokazać prawdziwy endpoint ludzi.
- Jeśli skaner nie znajdzie ścieżki wejścia SPA, pozostaje F12 z modułu wiadomości otwartego
  z menu synergii.

### Implementation notes — HITL runda 7 (2026-10-14)

- HITL: „reszta działa dobrze” — grupy, kosz, wiadomości, wysyłka OK. Otwarte: etykiety, odbiorcy.
- Etykiety r.7: wszystkie 7 kodowań koloru (string±#””, liczba, colorRGB, [r,g,b], {r,g,b},
  rgb()) odrzucone 422 MISSING_COLOR_RGB. Hipoteza (zgodna z sugestią użytkownika): Librus chce
  ściślejszego formatu (Java-style: „#4285F4”, ARGB „#FF4285F4”, csv „66,133,244”) albo palety
  z API. Tester próbuje GET /tags/colors i /tags/palette; zapis etykiet ma 11 kodowań.
- Odbiorcy r.7: contacts/users/accounts (runda 4) też 404 — endpoint ludzi nadal nieznany.
  NOWA ŚCIEŻKA: tester odczyta członków pierwszej grupy (GET /receivers/custom-groups/{id} i
  …/{id}/receivers, gdy lista grup zwróci groupId) — kompozytor mógłby wtedy wybierać całe
  grupy osób zamiast pojedynczych kategorii. Docelowo: F12 z modułu wiadomości (otwieranego
  z menu synergii) dla pewnego URL-a.
- Ulepszacz testera: dynamiczne próby członków grupy wstrzykiwane po odczycie listy grup.

### Implementation notes — HITL runda 6 (2026-10-14, ground truth: tester r.2)

- **Grupy ROZWIĄZANE**: tester pokazał `GET /receivers/custom-groups → {"groups":[{"groupId":..,
  "name":..}]}` — czytnik z r.5 (klucze `groupId`/`groupName`) pasuje; istniejące grupy użytkownika
  („siema”, „test grup”…) wyświetlą się na liście. Create potwierdzony (422 „Istnieje już…”).
- **Etykiety**: tester odrzucił colorRgb jako string±„#”, liczbę i klucz `colorRGB` — wszystkie
  422 MISSING_COLOR_RGB. Zapis próbuje teraz 7 kodowań tego samego koloru z palety (±„#”, liczba,
  `colorRGB`, tablica [r,g,b], obiekt {r,g,b}, „rgb(r,g,b)”); finalny błąd preferuje 422 (z
  fragmentem odpowiedzi), nie 404 z pierwszej kandydatki (wcześniej UI pokazywało „Nie znaleziono
  zasobu.”). Tester ma osobne próby dla tablicy/obiektu/rgb().
- **Odbiorcy**: 18 kandydatów z 3 rund → wszystkie 404; endpoint ludzi NIE jest pod /receivers*.
  Tester: runda 4 (contacts?type=, contacts/{t}, users/{t}, accounts/{t}, receivers/types/{t}/users)
  + oczekiwane F12 z modułu wiadomości (użytkownik otwiera wiadomości z menu synergii).
- Tester okrojony z potwierdzonych 404 (23→14 prób).

### Implementation notes — HITL runda 5 (2026-10-14)

- Etykiety: `colorRgb: "#4285f4"` dalej 422 MISSING_COLOR_RGB mimo obecności pola — format lub
  typ wartości jest inny (np. bez „#”, liczba 0xRRGGBB albo klucz `colorRGB`). Zapis etykiet jest
  teraz **samoprawujący**: próbuje 4 wariantów ciała po kolei (422 spada na następny), skuteczny
  wariant tworzy etykietę od razu; gdy żaden nie przejdzie, UI pokazuje błąd pierwszej próby.
- Grupy: lista dalej pusta mimo utworzonych grup — czytnik poszerzony o `Groups`, `data.Groups`,
  `data.items` i klucze `groupId`/`groupName`/`GroupId`/`GroupName`.
- Tester diagnostyczny: fragmenty odpowiedzi 240→400 znaków (pełny kształt pozycji typu odbiorcy),
  warianty koloru etykiety jako osobne próby, runda 3 kandydatów listy odbiorców (`receivers/all`,
  `receivers/{t}/receivers`, `receivers/types/{t}/receivers`, `receivers/types/{t}/list`).
- Kolor etykiety **wybiera użytkownik** (paleta 10 kolorów w sekcji Etykiety, `TAG_PALETTE`);
  automatyczne warianty to tylko kodowania tego samego koloru (z „#”/bez/liczba/`colorRGB`).
  Kontrakt: `POST /tags` przyjmuje `{name, colorRgb}` (schemat `TagWriteSchema` wymaga koloru).
- Do rozstrzygnięcia w r.6: wynik testera (GET /tags = format koloru, GET /receivers/custom-groups
  = kształt listy grup, nowi kandydaci receivers = prawdziwy endpoint ludzi).

### Implementation notes — HITL runda 4 (2026-10-14, ground truth z testera)

- Tester diagnostyczny dostarczył prawdziwe kontrakty (konto ucznia, M):
  - `POST /tags` → 422 `MISSING_COLOR_RGB` — trasa dobra, body wymaga `colorRgb`;
    create/update etykiety wysyłają teraz `{name, colorRgb: "#4285f4"}` (domyślny odcień).
  - `POST /receivers/custom-groups` → 422 „Istnieje już grupa o podanej nazwie.” — trasa i body
    `{name}` POPRAWNE; grupy tworzyły się, ale lista ich nie czytała. Czytnik grup czyta teraz
    każdy rozsądny kształt (`groups`/`data`/`data.groups`/`data.list`). Błędy akcji Librusa
    (4xx/5xx z `metadata.message`) idą wprost do UI (polski komunikat serwera).
  - `GET /me` → `accessToAttachments: true`, ale `cloudStorageIsConfigured: false` — szkoła nie
    ma skonfigurowanego dysku chmurowego, załączniki nie działają także w oficjalnym Librusie.
    **Funkcja załączników usunięta z UI kompozytora** (na życzenie użytkownika); proxy API i
    warstwa protokołu zostają (dla szkół z włączonym dyskiem).
  - Wszystkie kandydaci listy odbiorców `/receivers*` → 404 — endpoint ludzi pozostaje
    nieznany; tester ma rundę 2 kandydatów (`receivers/search` POST/GET, `receivers/{t}/list`,
    `receivers/{t}/search`, `receivers/list?type=`) plus odczyty `GET /tags` i
    `GET /receivers/custom-groups` (potwierdzenie kształtów list po naprawach).
- Kompozytor: sekcja załączników, stany, hooki `use*Attachment*` usunięte; `storageId` zawsze
  `null`. Odczyt załączników odebranych wiadomości zostaje (działa, osobna funkcja).

### Implementation notes — HITL runda 3 (2026-10-14)

- Etykiety/grupy/magazyn plików: zapisy przez **kandydatów tras** (404/405 spada na kolejną) —
  tags: `/tags/create`→`/tags`, modyfikacja `/tags/modify/{id}`→`/tags/{id}`, usuwanie
  `/tags/delete/{id}`→`/tags/{id}`; grupy analogicznie pod `/receivers/custom-groups/...`;
  magazyn: `/files-storage/attachments`→`/attachments/storage`→`/files-storage`.
- **Tester diagnostyczny** (`packages/librus-client/src/probe.ts`, `GET /api/messages/receivers/
  probe?type=`, sekcja na ekranie ustawień wiadomości): odpytuje kandydujące endpointy żywą sesją M
  i pokazuje statusy + fragmenty surowych odpowiedzi z przyciskiem kopiowania — zastępuje
  przechwytywanie DevTools, którego użytkownik nie może zrobić (brak dostępu do oficjalnego
  klienta wiadomości). POST-proby mogą utworzyć pozycje próbne „Probe-Aplaus” (UI ostrzega).
- Pozostałe domyślne rzuty `UNEXPECTED_RESPONSE` (czytnik GET, multipart parse-fail) mają teraz
  szczegółowe komunikaty ze statusem i ścieżką; 405 mapowane na NOT_FOUND (fall-through).
- Grupy odbiorców: sekcja ma tekst objaśniający (czym są; wybieranie grupy w kompozytorze dopiero
  po potwierdzeniu listy odbiorców). Napis podpisu w kompozytorze bez myślników („Wybierz podpis”).

### Implementation notes — HITL runda 2 (2026-10-14)

- Szkice nie zapisywały się, bo pusty picker wysyłał `receivers: {}`, a audyt potwierdził
  wyłącznie `{"schoolReceivers": []}` — `receiversBodyOf([])` zwraca teraz kształt z audytu
  (dotyczy szkiców, kontekstów reply/forward i wysyłki).
- Tworzenie magazynu plików szło jako POST bez ciała i bez Content-Type (403 w HITL r.2) — teraz
  jedzie pusty JSON `{}` jak każdy zaudytowany zapis M; 403 ma czytelny komunikat o uprawnieniach
  konta do załączników (z sugestią weryfikacji w oryginalnym Librusie).
- `LibrusError.userMessage` zwraca teraz szczegółowy komunikat (status/ścieżka/fragment
  odpowiedzi), gdy został podany — wcześniej `toAppError` go gubił i UI widziało zawsze ogólnik
  taksonomii; przy nieczytelnym echu zapisu błąd pokazuje fragment odpowiedzi Librusa (do 200
  znaków), co pozwoli w następnej rundzie zobaczyć prawdziwą odpowiedź serwera.
- Lista odbiorców: nowe kandydaty ścieżek (`receivers/types/{type}`, `receivers?type={type}`),
  dopasowanie kluczy grouped bez wielkości liter (G-stylowe `SchoolReceivers`); jeśli lista nadal
  jest pusta, prawdziwy endpoint trzeba odczytać z DevTools oficjalnego klienta — ścieżki są
  wyprowadzone, nigdy nie zaaudytowane.
- Zabezpieczenia: `draftFromEnvelope(null)` i `updateDraft(null)` nie rzucają już surowym
  TypeError przy naprawdę pustym body; fallback tworzenia szkica sięga listy (limit 20) i
  preferuje pozycję o zgodnym temacie/typie.

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
- [x] Warstwa offline: przy nieudanym fetch widok renderuje ostatnie dane + baner (brak crasha, brak pustego ekranu) — [test: integracyjny web] (api.offline.test.ts: 5/5, OfflineBanner.test: 3/3; baner złapał przy okazji realny bug pustego tekstu)
- [x] HITL: tryb samolotowy — ostatnie dane widoczne, baner widoczny — [observable: checklista HITL] (potwierdzone przez właściciela, 2026-10-16)
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

- [x] Diff: 8 scenariuszy fixture → poprawne powiadomienie per typ; drugi poll tego samego stanu = zero powiadomień (bez duplikatów) — [test: unit] (push-poller.test.ts)
- [ ] Przełącznik typu na „off" wycisza dany typ; pozostałe działają — [test: unit]
- [x] Wygasły słoik → dokładnie jeden push „sesja wygasła", konto wstrzymane do odnowienia — [test: unit] (plus wznowienie po resetCronSuspension)
- [x] Zestaw endpointów używanych przez cron to podzbiór list/metryk (treść wiadomości wykluczona) — [test: unit na rejestr wywołań] (rejestr czytników = wyłącznie metadane; interfejs deps nie ma readera treści)
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

- [x] Przełącznik motywów: jasny/ciemny/system; wybór przeżywa restart apki; tryb systemowy podąża za OS — [test: komponentowy + HITL] (theme.test.tsx: 4/4; HITL: przegląd wzrokowy)
- [x] Żadnych „na sztywno" wpisanych kolorów w widokach poza tokenami — [command: `grep` na hardcoded hex poza plikami tokenów] (zero trafień w .tsx poza fixtures testowymi colorHex)
- [x] Lighthouse: a11y ≥ 90 na głównych widokach — [command] (100/100 na logowaniu + /start, /grades, /timetable, /messages, /more, w OBU motywach; poprawki: warianty dark dla text-neutral-500/400, kontrast nieaktywnych segmentów, badge bg-red-600, sr-only „Przełącz konto" zamiast aria-label na bannerze konta, polskie „Ładowanie" w loaderze)
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

---

## Plan 3: Redesign UI (PRD #17)

Plan faz redesignu warstwy prezentacji (shadcn/tweakcn, desktop sidebar, DetailOverlay,
animacje, większa mobilka) — szczegóły w [redesign-ui.md](./redesign-ui.md).

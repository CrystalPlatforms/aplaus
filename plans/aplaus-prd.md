# PRD — Aplaus

Status: zatwierdzony przez interesariusza (discovery `/ask`, 11.10.2026) · Plan 1: PWA + Web · Plan 2: MCP
Źródło prawdy o API: [librus-api-audit.md](../librus-api-audit.md) + [librus-api-audit.json](../librus-api-audit.json)

## Problem Statement

Aplikacja mobilna Librusa (Synergia) jest płatna — subskrypcja per uczeń. Przeglądarkowa wersja Librusa jest nieczytelna, powolna i brzydka. Rodzina (2 uczniów + 2 konta rodzica) nie ma wygodnego, darmowego dostępu do danych szkolnych: ocen, planu lekcji, zadań domowych, wiadomości — ani powiadomień push bez płacenia Librusowi.

Dodatkowo: nie da się wygodnie pytać asystenta AI (np. Claude) o dane szkolne dziecka, bo API 3.0 Librusa jest niedostępne (401 na cookies), a oficjalnego tokenu Bearer nie uzyskano.

## Solution

**Aplaus** — prywatny serwis rodzinny: aplikacja webowa + PWA (instalowalna na Androidzie i iPhonie), pełna funkcjonalna replika Librusa z dopracowanym, „apple'owym" interfejsem, działająca na nieoficjalnym API Librusa udokumentowanym w audycie. Serwer (Cloudflare Worker) pełni rolę proxy do Librusa, odświeża sesje i — jako jedyna przechowywana stanowo rzecz — trzyma w KV sesje Librusa, stan „co już widzieliśmy" i subskrypcje push, żeby cron co 5 minut wykrywał zmiany i wysyłał powiadomienia web push (te same zdarzenia co apka mobilna).

Hasła do Librusa nie są przechowywane na serwerze — żyją wyłącznie na urządzeniach użytkowników. Zero własnej bazy danych: Aplaus jest oknem na Librusa, nie jego kopią.

Plan 2: serwer MCP dla właściciela, żeby prowadzić rozmowy z Claude'em o ocenach/zadaniach/wiadomościach dzieci.

## User Stories

Aktory: **Użytkownik** (uczeń lub rodzic — członek rodziny), **Rodzic** (konto z rolą 5), **Właściciel** (pan MrCrystal2 — deploy/ops).

### Dostęp i konta

1. Jako Użytkownik, chcę zalogować się loginem i hasłem Librusa (bez zakładania konta Aplaus), żeby od razu zobaczyć swoje dane.
2. Jako Użytkownik, chcę, żeby sesja Librusa odnawiała się po cichu hasłem z mojego urządzenia, żeby nie logować się ponownie gdy sesja wygaśnie.
3. Jako Użytkownik, chcę widzieć krótki baner „Zalogowano jako \<imię — rola>" po zalogowaniu, cichym odnowieniu sesji i przełączeniu konta, żeby zawsze wiedzieć, na kim jestem.
4. Jako Użytkownik, chcę dodać kilka kont Librusa (np. „Adam — uczeń", „Rodzic Adama", „Filip — uczeń", „Rodzic Filipa") i przełączać się między nimi jednym tapnięciem, żeby widzieć dane każdego dziecka bez wylogowywania.
5. Jako Użytkownik, chcę, aby moje hasło Librusa było trzymane tylko na moim urządzeniu (i wysyłane wyłącznie na moment logowania/odnowienia), żeby serwer nie przechowywał haseł.
6. Jako Użytkownik, chcę zrozumiałe komunikaty błędów Librusa (złe hasło, brak uprawnień 403, brak zasobu 404, wygasła sesja), żeby wiedzieć, co zrobić dalej.

### Oceny, plan, kalendarz, zadania, frekwencja

7. Jako Użytkownik, chcę listę ocen z podziałem na przedmioty i semestry, żeby śledzić postępy dziecka.
8. Jako Użytkownik, chcę szczegóły oceny (kategoria, komentarz, waga, nauczyciel, data, czy liczy się do średniej), żeby rozumieć skąd się wzięła.
9. Jako Użytkownik, chcę statystyki i średnie ocen per przedmiot/semestr, żeby szybko ocenić sytuację.
10. Jako Użytkownik, chcę tygodniowy plan lekcji z nawigacją między tygodniami, żeby wiedzieć, co czeka dziecko.
11. Jako Użytkownik, chcę wyróżnione odwołane lekcje i zastępstwa w planie, żeby nie przegapić zmian.
12. Jako Użytkownik, chcę kalendarz z dniami wolnymi klasy i wydarzeniami, żeby planować rodzinę.
13. Jako Użytkownik, chcę listę zadań domowych (wpisy zadaniowe) i prac domowych z terminami, żeby pilnować obowiązków.
14. Jako Użytkownik, chcę listę obecności/nieobecności ze statystyką (usprawiedliwione/nieusprawiedliwione/spóźnienia), żeby mieć kontrolę frekwencji.

### Wiadomości

15. Jako Użytkownik, chcę przeglądać odebrane i wysłane wiadomości z treścią i listą załączników, żeby komunikować się ze szkołą.
16. Jako Użytkownik, chcę pisać i wysyłać wiadomości do odbiorców z katalogu typów odbiorców i własnych grup, żeby kontaktować się z nauczycielami. *(Pierwszy send — test HITL wg checklisty; kontrakt z kodu klienta Librusa, nieprzetestowany w audycie.)*
17. Jako Użytkownik, chcę tworzyć, edytować i usuwać szkice, żeby wracać do niedokończonych wiadomości. *(Kontrakt potwierdzony audytem.)*
18. Jako Użytkownik, chcę odpowiadać i przekazywać wiadomości, żeby nie przepisywać danych ręcznie. *(Kontrakt z kodu klienta — test HITL.)*
19. Jako Użytkownik, chcę załączać pliki do wiadomości, żeby przesyłać dokumenty. *(Kontrakt z kodu klienta — test HITL.)*
20. Jako Użytkownik, chcę zarządzać podpisami (twórz/edytuj/usuń), żeby nie wpisywać stopki za każdym razem. *(Test HITL.)*
21. Jako Użytkownik, chcę zarządzać etykietami wiadomości, żeby porządkować skrzynkę. *(Test HITL.)*
22. Jako Użytkownik, chcę kosz z przywracaniem i trwałym usunięciem, żeby pomyłka nie była ostateczna. *(Test HITL.)*

### Ogłoszenia, uwagi, zebrania, usprawiedliwienia

23. Jako Użytkownik, chcę listę ogłoszeń szkolnych z okresami obowiązywania, żeby nie przegapić komunikatów.
24. Jako Użytkownik, chcę listę uwag (Notes), żeby wiedzieć o eventach wychowawczych.
25. Jako Użytkownik, chcę listę zebrań z rodzicami (ParentTeacherConferences), żeby planować udział.
26. Jako Rodzic, chcę widzieć listę usprawiedliwień ze statusami i terminami, żeby kontrolować ich bieg. *(GET tylko dla roli 5; uczniowskie konta dostaną w UI ukrytą sekcję.)*
27. Jako Użytkownik, chcę informacje o szkole, klasie, przedmiotach i lekcjach, żeby mieć kontekst danych.

### Powiadomienia push

28. Jako Użytkownik, chcę dostawać push o: nowej ocenie, nowej wiadomości, nowym ogłoszeniu, nieobecności/spóźnieniu, nowym zadaniu domowym, nowej uwadze, zmianie planu (odwołane/zastępstwa), nowym zebraniu — żeby wiedzieć o zmianach od razu, jak w apce mobilnej Librusa.
29. Jako Użytkownik, chcę przełączniki on/off per typ powiadomienia w ustawieniach, żeby dostawać tylko to, co chcę.
30. Jako Użytkownik, chcę push „sesja Librusa wygasła — otwórz Aplaus", żeby powiadomienia nie umierały po cichu.
31. Jako Użytkownik, chcę, żeby powiadomienie prowadziło do odpowiedniego widoku po tapnięciu, żeby od razu widzieć kontekst.

### Tryby pracy i wygląd

32. Jako Użytkownik, chcę widzieć ostatnio pobrane dane offline (z banerem „brak internetu"), żeby apka była użyteczna bez sieci.
33. Jako Użytkownik, chcę zainstalować Aplaus jako PWA na Androidzie i iPhonie (iOS: Dodaj do ekranu głównego), żeby korzystać jak z natywnej apki.
34. Jako Użytkownik, chcę motywy jasny / ciemny / systemowy i interfejs w duchu Apple Design (HIG), żeby apka wyglądała drogo i przyjemnie.
35. Jako Użytkownik, chcę interfejs w całości po polsku, żeby używało go dziecko bez znajomości angielskiego.

### Właściciel / ops / plan 2

36. Jako Właściciel, chcę, żeby deploy szł przez istniejący pipeline CI (wersjonowany upload, canary 10%, gate na `/health/ready`, rollback), żeby wdrożenia były bezpieczne.
37. Jako Właściciel, chcę darmowy hosting w ramach free tier Cloudflare (Workers + KV), żeby serwis nic nie kosztował przy skali rodzinnej.
38. Jako Właściciel, chcę ochronę logowania (rate limiting z szablonu), żeby publiczny URL nie wystawiał haseł Librusa na brute-force.
39. *(Plan 2)* Jako Właściciel, chcę lokalny serwer MCP wystawiający narzędzia typu „pokaż oceny Filipa z matmy", „co Filip ma na jutro", „nieprzeczytane wiadomości", żeby pytać Claude'a o dane szkolne w czacie.

## Implementation Decisions

### Architektura (zaakceptowana przez interesariusza)

```
packages/librus-client   → głęboki moduł: cały protokół Librusa za wąskim interfejsem
apps/data-service        → Worker: proxy API + cron powiadomień + web push (KV, bez SQL)
apps/web                 → PWA: React 19 + Vite + Tailwind + vite-plugin-pwa + TanStack Query
apps/mcp                 → Plan 2: lokalny serwer MCP (stdio) reużywający librus-client
```

- Szablonowy Better Auth + Postgres (data-ops) zostają **usunięte** — zero własnej bazy danych, zero własnych kont.
- Pipeline CI z szablonu zostaje (trigger→env w `scripts/deploy-target.ts`, canary, gate na readiness, rollback); readiness przystosowane do braku bazy.

### `librus-client` — granica systemu (głęboki moduł)

Wąski interfejs na zewnątrz: zaloguj, odśwież, pobierz zasób (typowany per zasób z audytu), wyślij/szkicuj wiadomość, zarządzaj załącznikami/podpisami/etykietami. Wewnątrz ukryte:

- pełny taniec logowania (portal → OAuth → `goTo` → przekierowania do Synergii), z losowym `x-baner` (kod znaków +20, `_`, Unix ms),
- osobne sesje: Synergia (G: `synergia.librus.pl/gateway/api/2.0`) i Wiadomości (M: `wiadomosci.librus.pl/api`), słoiki cookies per konto i per domena,
- normalizacja dwóch różnych kształtów odpowiedzi (G: `{Zasób, Resources, Url}`; M: `{data, total}`) i wyjątków (np. Justifications: `{status, message, data}`),
- taksonomia błędów: błąd logowania (403 + `errors[]`), 401 (sesja wygasła), 403 (brak uprawnień, np. usprawiedliwienia dla ucznia), 404 (np. brak podpisów — traktowane jak pusta lista),
- kodowanie wiadomości: `topic`/`content` jako Base64 UTF-8, treść HTML.

### Model sesji i haseł (kluczowa decyzja interesariusza)

- Hasło Librusa mieszka **wyłącznie na urządzeniu** (przechowywanie po stronie przeglądarki); wysyłane tylko w żądaniu logowania/odnowienia.
- Autorytatywny słoik cookies konta leży w **KV**; urządzenia i cron korzystają z tego samego słoika.
- Gdy sesja padnie na żądaniu z urządzenia: Worker zwraca 401 → urządzenie po cichu loguje się ponownie hasłem → nowy słoik ląduje w KV → retry.
- Cron **nie ma haseł**: gdy słoik w KV wygaśnie, przestaje odpytywać konto i wysyła push „sesja wygasła". Sesję dla konta przywraca pierwsze otwarcie apki przez urządzenie z hasłem.
- Nie odnawiać sesji w tle „na zapas" bez potrzeby; nie ponawiać automatycznie wysyłki wiadomości przy niejednoznacznym wyniku (zalecenie audytu).

### Powiadomienia (push)

- Cron co ~5 min: dla każdego konta z żywą sesją odpytuje 8 zasobów (Grades, inbox count+lista 1. strony, SchoolNotices, Attendances, HomeWorks/HomeWorkAssignments, Notes, Timetables bieżącego tygodnia, ParentTeacherConferences) i robi diff ze stanem „ostatnio widziane" w KV.
- Wykrywanie nowych wiadomości: wyłącznie metadane listy/licznik nieprzeczytanych — **nigdy** otwieranie treści wiadomości po stronie serwera (audyt: szczegóły wiadomości mogą oznaczyć jako przeczytaną).
- Wysyłka: natywny web push (VAPID) — bez zewnętrznego serwisu; subskrypcje per urządzenie w KV; tapnięcie otwiera odpowiedni widok.
- Ustawienia per konto per typ zdarzenia — również w KV.

### Frontend

- React 19 + Vite + Tailwind + `vite-plugin-pwa`; stan serwerowy: TanStack Query; cache offline: IndexedDB (ostatnie odpowiedzi + baner trybu offline).
- UI w całości po polsku; motywy jasny/ciemny/system; styl wg `/apple-design` (HIG): bottom-nav jak apka natywna, duże celowe typografia, miękkie cienie.
- Widoki: logowanie, wybór/przełączanie kont, kokpit, oceny (+szczegół przedmiotu, statystyki), plan tygodniowy, kalendarz, zadania domowe, frekwencja (+statystyki), wiadomości (skrzynki, wątek, nowa, szkice, kosz, załączniki, podpisy, etykiety, grupy odbiorców), ogłoszenia, uwagi, usprawiedliwienia (tylko rola 5), zebrania, szkoła/klasa, ustawienia (motyw, powiadomienia, konta).

### free-for.dev (wybrane w discovery)

- Cloudflare Workers free tier (100k req/dzień) + KV — hosting za 0 zł przy skali rodzinnej.
- Natywny web push (VAPID) — darmowy, bez third-party.
- Adres na razie darmowy (`*.workers.dev`); domena własna później.
- Opcjonalnie na później: Sentry (błędy), UptimeRobot (monitoring) — nieblokujące.

## Assumptions

- Nieoficjalne API Librusa (G i M) pozostaje dostępne i stabilne; zmiana po stronie Librusa może zepsuć apkę — akceptowane (apka rodzinna, audyt jako punkt odniesienia).
- Czas życia sesji Librusa wystarcza, by przy codziennym używaniu apki sesja crona żyła; przerwy w powiadomieniach po dłuższej nieaktywności są akceptowalne (mitygacja: push „sesja wygasła").
- Kontrakt wysyłki wiadomości (z kodu klienta Librusa) jest poprawny; możliwe poprawki po pierwszym teście HITL. Analogicznie: załączniki, podpisy, etykiety, odpowiedź/przekazanie, kosz.
- 4 pary kont z audytu są reprezentatywne dla wszystkich kont rodziny; konta rodzica (rola 5) mają dostęp do usprawiedliwień.
- 404 na `/signatures` oznacza „brak podpisów" i jest traktowane jak pusta lista (zalecenie audytu).
- Cloudflare free tier wystarcza: ~4 konta × poll co 5 min + ruch API + zapisy KV tylko przy zmianach.
- Push na iOS wymaga iOS ≥ 16.4 i instalacji PWA na ekran główny — użytkownicy to zaakceptują.
- Przełączanie wielu dzieci w ramach **jednego** konta rodzica nie jest gwarantowane (nietestowane w audycie) — wspieramy model „wiele kont".
- Wszystkie konta rodziny zmieszczą się w modelu „dodaj konto ręcznie" (bez rejestracji publicznej).

## Tradeoffs Considered

- **Oficjalne API 3.0 (api.librus.pl)** — odrzucone: 401 na cookies, brak tokenu Bearer (audyt); nie da się na nim budować.
- **Przechowywanie haseł po stronie serwera (nawet zaszyfrowanych)** — odrzucone: decyzja interesariusza; konsekwencja: cron nie potrafi sam odnowić sesji (mitygacja pushem „sesja wygasła").
- **Własna baza SQL (Postgres/D1) na konta i dane** — odrzucone: interesariusz chce „zero własnej bazy"; KV + IndexedDB wystarczają w skali rodzinnej.
- **Serwis publiczny z rejestracją** — odrzucone: ciężar prawny/bezpieczeństwa przechowywania haseł obcych ludzi (dane nieletnich); apka rodzinna.
- **OneSignal/zewnętrzny serwis push** — odrzucone: natywny web push z VAPID jest darmowy i wystarczający.
- **SvelteKit / Solid zamiast React** — odrzucone: wybór interesariusza; największy ekosystem, komponenty i wsparcie AI = szybsze „dopracowanie każdego widoku".
- **MVP z cięciem zakresu** — odrzucone: interesariusz chce pełnej repliki z dopracowanym każdym widokiem.
- **Cisza nocna powiadomień** — odrzucona: interesariusz woli powiadamiać zawsze od razu.
- **Szczęśliwy los w push** — odrzucone: brak endpointu w audycie; nie da się wykryć.
- **Oddawanie prac domowych / składanie usprawiedliwień / zapisy ocen i frekwencji** — poza zakresem: brak kontraktów w audycie (explicit „nie ustalono").

## Validation Strategy

### Testy automatyczne (próg jakości: `pnpm run types && pnpm run test && pnpm run lint && pnpm run check:docs && pnpm run check:runtime-types` — wszystko zielone)

- **librus-client** (unit, mock HTTP na granicy): taniec logowania end-to-end (portal→OAuth→goTo→Synergia; osobno sesja M), poprawność `x-baner` (znane wejście→znane wyjście), słoiki cookies per domena, taksonomia błędów (błędne hasło→403+errors, 401→„sesja wygasła", 403→„brak uprawnień", 404→pusta lista podpisów), Base64 topic/content, normalizacja G vs M.
- **data-service** (integracyjne przez `app.request()`): proxy wymaga tokenu urządzenia, 401→propagacja „odnów sesję", zapis KV słoika po logowaniu, endpointy diff/state dla crona, readiness bez bazy.
- **push-engine** (unit): diff stanów (nowa ocena/wiadomość/ogłoszenie/nieobecność/zadanie/uwaga/zmiana planu/zebranie → poprawne powiadomienie), przełączniki per typ respektowane, brak duplikatów przy drugim pollu, push „sesja wygasła" przy 401.

### WALIDACJA HITL (rzeczy nie do przetestowania automatycznie — wykonuje interesariusz po checkliście)

- **Wysyłka wiadomości (historia 16)**: checklista krok-po-kroku — send do samych siebie/testowego odbiorcy, weryfikacja w oryginalnym Librusie; raport rozbieżności.
- **Załączniki (19), podpisy (20), etykiety (21), kosz (22), odpowiedź/przekazanie (18)**: checklista HITL per operacja.
- **Push (28–31)**: instalacja na fizycznym Androidzie i iPhonie; ocena testowa wpisana w Librusie przez rodzica→push ≤ 5 min; tapnięcie otwiera właściwy widok; przełącznik „off" faktycznie wycisza.
- **PWA (33)**: Lighthouse „installable" = yes; instalacja na obu platformach; ikona/splash.
- **Offline (32)**: tryb samolotowy — ostatnie dane widoczne, baner offline, brak crashy.
- **Sesja (2, 3)**: wymuszone wygaśnięcie (kasacja słoika w KV) → ciche odnowienie + baner „Zalogowano jako…".
- **Konta (4)**: dodanie 4 par z audytu, przełączanie, poprawność danych per konto.

### Kryteria „done" per komponent

- `librus-client`: wszystkie zasoby z tabel audytu mają typowaną funkcję i test; brak `any`.
- `data-service`: brak SQL; readiness przechodzi w CI; rate limit na logowaniu.
- `apps/web`: każdy widok z listy implementacji istnieje, obsługuje stany: ładowanie / błąd / pusto / offline; Lighthouse PWA + a11y ≥ 90.
- Push: latencja zdarzenie→push ≤ 5 min (interwał crona); zero duplikatów.
- MCP (plan 2): `claude mcp add` → narzędzia odpowiadają na 3 przykładowe pytania o dane.

## Out of Scope

- Szczęśliwy los (brak endpointu), oddawanie prac domowych, składanie usprawiedliwień, jakiekolwiek zapisy ocen/frekwencji — brak kontraktów w audycie.
- Rejestracja obcych użytkowników, płatności, subskrypcje.
- Angielski interfejs, natywne apki mobilne, multi-region, SLA.
- Integracja dysku chmurowego (`cloudStorageIsConfigured: false` w audycie).
- Plan 2 (MCP) — osobny kamień milowy, nie blokuje Planu 1.

## Further Notes

- Cała wiedza o protokole: `librus-api-audit.md` (protokół logowania, `x-baner`, tabele uprawnień, kontrakty szkiców, źródła kontraktów nieprzetestowanych operacji) — traktować jako jedyną wyjściową specyfikację; audyt to obserwacje, nie gwarancja.
- Bezpieczeństwo: skoro URL jest publiczny, login musi mieć rate limiting; nagłówki `x-baner`/cookies nigdy nie trafiają do logów; token urządzenia (KV) do autoryzacji proxy.
- Zasada z audytu: **żadnych automatycznych retry wysyłki** przy niejednoznacznym wyniku; operacje zapisu tylko na wyraźną akcję użytkownika.
- Zgodnie z decyzją interesariusza praca odbywa się w tym folderze, bez worktree/PR; commit/push wyłącznie na jego polecenie (`/ship`).

— PRD: GLM na podstawie discovery `/ask` (synteza decyzji 1–14) i audytu API z 11.10.2026.

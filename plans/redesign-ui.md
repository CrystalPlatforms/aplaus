# Plan: Redesign UI — shadcn/tweakcn, desktop, animacje

> Source PRD: https://github.com/CrystalPlatforms/aplaus/issues/17 (Plan 3; poprzednie: Plan 1 w `plans/aplaus-plan.md` — zamknięty, Plan 2 / serwer MCP — osobny tor)

## Architectural decisions

Durable decisions that apply across all phases:

- **Architektura**: redesign wyłącznie warstwy prezentacji aplikacji web (React 19 + Tailwind v4 CSS-first + Vite). PWA (instalacja, offline-cache, push) bez zmian funkcjonalnych; desktop = ten sam kod, inny layout od breakpointu md.
- **Tokeny**: pełny zestaw zmiennych shadcn (`:root` + `.dark`) w formacie tweakcn; mapowanie w `@theme inline` nigdy nie edytowane ręcznie — personalizacja = wklejenie bloków zmiennych z tweakcn.com. Paleta domyślna: CRS-Theme właściciela (oba bloki; tylko kolory + `--radius: 0.8rem`). Stara warstwa tokenów aplikacji zostaje usunięta wraz z ostatnim konsumentem.
- **Komponenty**: port ręczny shadcn (bez CLI) do katalogu `ui/` aplikacji web; `cn()` (clsx + tailwind-merge), warianty przez cva. Fonty, cienie, tracking i spacing z eksportu CRS pomijamy.
- **Nakładki**: jeden responsywny DetailOverlay na Radix Dialog (mobile = dolny sheet, md+ = wycentrowany podgląd ~90vw/~85dvh); decyzja wyłącznie w CSS. Wybieraki konta = wycentrowany dialog na obu szerokościach. Testy `role="dialog"` (4 pliki) pozostają bramką.
- **Animacje**: wyłącznie CSS — utilities animacyjne dla Tailwind v4 sterujące stanami `data-state` Radixa + animacja montowania widoku po zmianie ścieżki; bez bibliotek JS (framer-motion odrzucony). Globalny wyłącznik `prefers-reduced-motion` (istniejący) objmuje wszystko.
- **Ikony**: react-icons, zestaw `lu` (styl Lucide), importy per-ikona; zastępują ręczne SVG chevronów/X i wchodzą do nawigacji.
- **Skala**: bazowy font-size dokumentu podbity na wąskich ekranach (~106–112%), standardowy na md+; Tailwind rem-based skaluje całość; wyjątki px przeliczane na rem.
- **Testy**: role/etykiety/testidy; stub ResizeObserver w setupie; jedyna asercja klasy (pogrubienie nieprzeczytanej) zachowana. Natywne `select` zostają.
- **Braki po fazach** mogą współistnieć: ekrany poza daną fazą działają na starym wyglądzie do czasu migracji.
- **Bramki stałe**: `pnpm run types && pnpm test && pnpm run lint:ci` + `knip` + `check:docs`; Lighthouse a11y ≥ 90 w obu motywach; limit 500 linii/plik; pre-existing ostrzeżenia złożoności biome NIE są naprawiane w tym planie (osobny task).

---

## Phase 1: Fundament tokenów CRS-Theme + tracer na ekranie logowania

> **Status: ✅ zaimplementowana** (sesja /tdd 19,20 — 2026-10-19; fundament dokończony, bo #18 było zamknięte bez implementacji). 2026-10-20: właściciel wkleił DOKŁADNY eksport CRS-Theme (oklch) — rekonstrukcja z tej fazy zastąpiona eksportem (kolory + `--radius`); ciemny primary = `#167c51` (zieleń z loadera CRS), jasny = `#2bc585`; ciemne `destructive` wróciło do czerwieni (rekonstrukcja miała pomarańcz). Uwaga: przy fazie 5 (HITL) właściciel może wkleić nowszy eksport tweakcn, mapowanie @theme inline bez zmian.

**User stories**: 1, 2, 3, 14, 18

### What to build

End-to-end tracer nowego systemu: zależności (Radix Dialog/Slot/Label, cva, clsx, tailwind-merge, react-icons, tw-animate-css), `cn()`, warstwa tokenów CRS-Theme (jasny + ciemny blok, `--radius 0.8rem`) z mapowaniem `@theme inline`, stub ResizeObserver, komponenty Button / Card / Input / Label, kropki Loadera i ButtonSpinner przeniesione za `--primary` (koniec stałego niebieskiego), i migrowany ekran logowania jako pierwsza pełna ścieżka widoczna użytkownikowi. Efekt: logowanie wygląda już w CRS-Theme w obu motywach, reszta apki działa dalej po staremu.

### Assumptions carried in

- Nazwy zmiennych eksportu tweakcn = zestaw shadcn 1:1 (zweryfikowane na CRS-Theme).
- Radix Dialog/Slot/Label kompatybilne z React 19.
- Przełącznik motywów (jasny/ciemny/system) działa bez zmian — tylko paleta się zmienia.

### Out of scope for this phase

- Migracja jakichkolwiek ekranów poza logowaniem; sidebar; nakładki; animacje; skala mobilna.
- Fonty/cienie/spacing z eksportu CRS; `theme_color` manifestu.

### Acceptance criteria

- [ ] Ekran logowania renderuje się na Button/Input/Label i tokenach (zero surowych `blue-*`/`neutral-*` jako kolory w tym widoku) — [test: istniejący test logowania zielony + grep na plik widoku]
- [ ] Kropki Loadera/ButtonSpinner mają kolor `--primary` w obu motywach; test statusu (`role="status"`) przechodzi — [test: istniejący + observable]
- [ ] Wklejenie innego motywu tweakcn (podmiana bloków `:root`/`.dark`) przebarwia Button/Input/Loader bez zmian w komponentach — [observable: HITL przy fazie 5, mechanizm gotowy tu]
- [ ] `pnpm run types && pnpm test && pnpm run lint:ci && knip` zielone; ResizeObserver w setupie — [command]
- [ ] Brak flag knip na nowe zależności (wszystkie skonsumowane) — [command: `pnpm knip`]

---

## Phase 2: DetailOverlay — sheet na mobile, prawie pełnoekranowy preview na desktop

> **Status: ✅ zaimplementowana** (sesja /tdd 19,20 — 2026-10-19). DetailOverlay (`components/DetailOverlay.tsx`) na Radix Dialog; pierwszy konsument: szczegóły oceny (Badge na flagach, tokeny na tekstach). Test: `DetailOverlay.test.tsx`. Aktualizacja 2026-10-20 (decyzja właściciela): overlay WYŚRODKOWANY na każdym breakpointcie (~92vw × 85dvh < md, ~90vw × 85dvh md+) — tło (przyciemnione + `backdrop-blur-md`) zostaje widoczne wokół; koniec z pełnym ekranem na mobile i z dolnym sheetem.

**User stories**: 5, 6, 18

### What to build

Responsywna nakładka szczegółów na Radix Dialog: sticky nagłówek z tytułem (nazwa accessible), akcją opcjonalną i X; mobile = dolny sheet z zaokrągloną górą i ograniczoną wysokością; md+ = wycentrowany podgląd ~90vw/~85dvh; animacje wejścia/wyjścia po `data-state`; Escape / backdrop / X zamykają; pułapka focusu. Migracja pierwszego konsumenta: szczegóły oceny (ekran ocen), z Badge po fladze i tokenami tekstu. Formalna walidacja (scenariusze z PRD) ląduje tu jako testy.

### Assumptions carried in

- Tokeny i Button/Badge z fazy 1; Radix Dialog stabilny w jsdom (portale do body, RTL znajduje).
- Istniejące testy `role="dialog"` przechodzą na nazwie z tytułu (Radix ustawia aria-labelledby).

### Out of scope for this phase

- Pozostałe nakładki (lekcja, zadanie, konto) — kolejne fazy; przycisk Switch; natywne selecty.

### Acceptance criteria

- [ ] Poniżej md: treść przyklejona do dołu z zaokrągleniem góry; powyżej: wycentrowana, ~90vw/~85dvh — [test: komponentowy DetailOverlay (2 przypadki breakpointów)]
- [ ] Escape, klik w tło i X wywołują zamknięcie (onOpenChange(false)) — [test]
- [ ] `role="dialog"` z dostępną nazwą z widocznego tytułu; pułapka focusu aktywna — [test]
- [ ] Szczegóły oceny otwierają się w DetailOverlay; test ekranu ocen (`role="dialog"`) zielony — [test: istniejący]
- [ ] Animacje wejścia/wyjścia po data-state; przy `prefers-reduced-motion` zastygają — [test-setup: globalny wyłącznik + observable HITL]

---

## Phase 3: Powłoka — sidebar (desktop), dolny bar z ikonami (mobile), skala mobilna

> **Status: ✅ zaimplementowana** (sesja /tdd 19,20 — 2026-10-19). Sidebar md+ (pełna nawigacja + blok konta), BottomBar < md z ikonami react-icons/lu i tokenem primary, TopBar (mobile: konto/wyloguj; desktop: Odśwież z spin), skala mobilna 106.25% < md (px→rem w Loader/Notifications/MessagesSettings), animacja montowania widoku `.animate-view-in`, AccountSwitcher and a centered Radix Dialog. Pliki powłoki ≤ 165 linii. Aktualizacja 2026-10-20: StickyBack usunięty — jeden przycisk „Wróć" żyje w TopBar (cel z `features/shell/back-target.ts`), widoczny na każdym breakpointcie.

**User stories**: 4, 7, 8, 9, 13, 18

### What to build

Nowa powłoka: AppShell podzielony (limit 500 linii) — Sidebar na md+ z PEŁNĄ nawigacją (wszystkie sekcje, badge nieprzeczytanych, blok konta z przełącznikiem i wylogowaniem; stare tokeny powłoki przeniesione na nowe), dolny bar na mobile z ikonami (react-icons/lu) i aktywnymi stanami, TopBar (mobilny: konto/wyloguj; desktopowy: Odśwież z animacją spin), wyodrębnione trasy „Więcej", StickyBack wystylizowany na tokeny, skala mobilna (font-size < md, przeliczenie wyjątków px), animacja montowania widoku po zmianie ścieżki, wybierak konta + dodawanie konta na centered Dialog. Wszystkie sekcje w sidebarze nawigują do istniejących tras (bez nowych funkcji).

### Assumptions carried in

- Tokeny/komponenty z fazy 1; trasy i `activeTabOf` bez zmian semantycznych; test AppShell (dialog „Konta", login-banner testid) jako bramka.
- Pull-to-refresh dotyk-only (desktop dostaje Odśwież); OfflineBanner bez zmian funkcjonalnych.

### Out of scope for this phase

- Migracja widoków poza powłoką (kokpit/plan/wiadomości — faza 4); Radix Switch; usunięcie zakładki „Więcej" z mobile (zostaje — mobile ma pełną listę tam).

### Acceptance criteria

- [ ] md+: sidebar widoczny z pełną nawigacją (wszystkie sekcje prowadzą do istniejących tras), dolny bar ukryty; poniżej md: odwrotnie — [test: render per breakpoint + observable HITL]
- [ ] Dolny bar renderuje ikonę + etykietę per zakładka; aktywna pozycja wyróżniona tokenem primary; badge nieprzeczytanych działa — [test: istniejący AppShell + test ikon/badge]
- [ ] Nazwa accessible przełącznika konta zawiera widoczny tekst (WCAG 2.5.3, wzorzec sr-only zachowany) — [test: istniejący AppShell]
- [ ] Skala: poniżej md bazowy font-size podbity (elementy dotykowe większe), od md standardowy; breakpoint md nie przesuwa się — [observable: HITL 390px vs 1280px + computed-style test]
- [ ] Zmiana ścieżki animuje montowanie widoku (fade + przesuw); reduced-motion zamyka — [observable + globalny wyłącznik]
- [ ] `role="dialog"` „Konta" i login-banner testid przechodzą bez zmian — [test: istniejący AppShell]
- [ ] Pliki powłoki każdy < 500 linii; `types && test && lint:ci && knip` zielone — [command]

---

## Phase 4: Kluczowe ekrany — kokpit (2 kolumny na desktop), plan, wiadomości

> **Status: ✅ zaimplementowana** (sesja /tdd 21,22 — 2026-10-20). Kokpit na `Card` w siatce `md:grid-cols-2`; plan: szczegóły lekcji w DetailOverlay (akcja „Oceny" w nagłówku), strzałki tygodnia na `Button size="icon"` z ikonami lu/Chevron i zachowanymi aria-labelami; wiadomości: „Nowa wiadomość"/„Szkice" na Button (zieleń → primary), segmenty folderów na tokenach (tor muted / aktywny card+cień), kropka nieprzeczytanej `bg-primary`, akcje kosza na Button ghost z niezmienionymi etykietami. Grep migrowanych plików: zero surowych `blue-*`/`neutral-*`.

**User stories**: 5, 6, 12, 14, 15, 18

### What to build

Migracja pozostałych ekranów codziennego użycia: kokpit (karty na Card, 2 kolumny na md+), plan lekcji (szczegóły lekcji → DetailOverlay z akcją w nagłówku, strzałki tygodnia → Button icon), lista wiadomości (foldery na tokenach segmentów, „Nowa wiadomość"/„Szkice" na Button, nieprzeczytana: kropka za primary + zachowane pogrubienie, akcje kosza z niezmienionymi etykietami). Po tej fazie cały codzienny obieg użytkownika wygląda nowym systemem.

### Assumptions carried in

- DetailOverlay z fazy 2; powłoka z fazy 3; tokeny segmentów (tor muted / aktywny card+cień) ustandaryzowane.
- Testy: etykiety kosza, `font-bold` nieprzeczytanej, dialog planu (nazwa z tytułu zamiast aria-label) — bramki.

### Out of scope for this phase

- Kompozycja/szkice/szczegóły wiadomości, frekwencja, zadania i pozostałe ekrany — faza 6.

### Acceptance criteria

- [ ] Kokpit: karty na Card, md+ siatka 2-kolumnowa, jedna kolumna poniżej — [test: render per breakpoint + observable]
- [ ] Szczegóły lekcji w DetailOverlay; test planu przechodzi z nazwą dialogu z tytułu — [test: zaktualizowany istniejący]
- [ ] Wiadomości: foldery/akcje na Button/tokenach, nieprzeczytana = kropka primary + `font-bold` zachowane, etykiety kosza bez zmian — [test: istniejący MessagesScreen]
- [ ] Grep na migrowanych plikach: zero surowych `blue-*`/`neutral-*` jako kolory — [command]
- [ ] `types && test && lint:ci` zielone — [command]

---

## Phase 5: Polish Fazy A — animacje, manifest, dokumentacja, bramki jakości

> **Status: 🟡 kod zaimplementowany** (sesja /tdd 21,22 — 2026-10-20); bramki Lighthouse i checklista HITL zostały u właściciela. Zrobione: klik-feedback (`active:scale-[0.98]` na Button i wierszach sidebara, `group-active:scale-90` na ikonach BottomBar, tap-highlight przezroczysty globalnie + na komponentach), `theme_color` manifestu → `#167c51` (zieleń CRS; ciemny primary eksportu), Loader → kropki za `var(--primary)`, box logowania = czarny z zakresem `dark` (dokładne tokeny ciemnego bloku CRS), niebieski `--loader-login` usunięty, konwencje UI w AGENTS.md/CLAUDE.md nadpisane (loader za akcentem), notka theming (tweakcn) dodana.

**User stories**: 1, 9, 10, 11, 16, 17

### What to build

Dokręcenie Fazy A: pełny zestaw animacji (overlaye już są; klik-feedback na przyciskach/ikonach: skala 0.98/0.90; transparent tap-highlight), `theme_color` manifestu PWA → zieleń z palety, aktualizacja konwencji UI w CLAUDE.md (loader za akcentem — nadpisuje r.21) i notki o themingu (jak wkleić motyw tweakcn) w dokumentacji zgodnej z check:docs, pełne bramki: Lighthouse a11y CLI na 6 widokach w obu motywach, checklista HITL Fazy A (wklejenie motywu, skala, animacje + reduced-motion, stany ładowanie/pusto/błąd/offline na migrowanych widokach).

### Assumptions carried in

- Wszystkie fazy 1–4 zakończone; login-banner sr-only wzorzec nietknięty (a11y 100/100 jako punkt odniesienia).

### Out of scope for this phase

- Faza B (ekran poza A); naprawa pre-existing ostrzeżeń złożoności (osobny task).

### Acceptance criteria

- [ ] Klik-feedback: Button/ikony nawigacji mają aktywną skalę i przejście; tap-highlight przezroczysty — [test: klasy w komponentach + observable]
- [ ] `theme_color` manifestu = zieleń z palety (nie #0a84ff) — [observable: zbudowany manifest]
- [ ] Lighthouse a11y ≥ 90 (cel 100): logowanie + /start, /grades, /timetable, /messages, /more, w obu motywach — [command: Lighthouse CLI przy sesji]
- [ ] CLAUDE.md (konwencje UI: loader za akcentem) i notka theming aktualne; `pnpm run check:docs` zielone — [command]
- [ ] HITL: wklejenie alternatywnego motyvu tweakcn przebarwia całość (w tym sidebar i loader); skala 390px vs 1280px; animacje + reduced-motion; stany widoków Fazy A — [observable: checklista właściciela]

---

## Phase 6: Faza B — pozostałe ekrany jednym przepisem

**User stories**: 14, 15

### What to build

Migracja pozostałych ~15 ekranów przepisem mapowania (karta → Card, przyciski → Button warianty, miękkie teksty → muted-foreground, błędy → destructive, flagi → Badge, sheety → DetailOverlay): frekwencja (+statystyki), oceny przedmiotu, zadania (+sheet szczegółów → DetailOverlay), ogłoszenia + szczegół, uwagi, zebrania + szczegół, szkoła i klasa, usprawiedliwienia, instalacja, kompozycja, szkice, szczegół wiadomości (potwierdzenie kosza zostaje inline), powiadomienia (8 ręcznych przełączników → Radix Switch — nowy komponent ui), ustawienia wiadomości (podział pliku przekraczającego 500 linii na poddomeny: podpisy / etykiety / grupy).

### Assumptions carried in

- Przepis mapowania z faz 1–4; DetailOverlay; Radix Switch kompatybilny z React 19/jsdom (ResizeObserver stub już jest).

### Out of scope for this phase

- Nowe funkcje; zmiany treści/kopii poza klasami; naprawa ostrzeżeń złożoności.

### Acceptance criteria

- [ ] Wszystkie wymienione ekrany na komponentach/tokenach; grep całego `src`: zero surowych `blue-*`/`neutral-*` jako kolory (poza loader-niebieskim usuniętym wcześniej i danymi colorHex) — [command]
- [ ] Przełączniki powiadomień: `role="switch"` + aria-checked działają jak dotychczas (preferencje zapisują się) — [test: nowy, wg schematu istniejących]
- [ ] Ustawienia wiadomości podzielone, każdy plik < 500 linii — [command: `wc -l` / lint]
- [ ] Wszystkie istniejące testy ekranów zielone (role/etykiety bez zmian) — [command]
- [ ] `types && test && lint:ci && knip` zielone — [command]

---

## Phase 7: Zamknięcie Planu 3 — pełny sweep jakości

**User stories**: 16, 17

### What to build

Finałowe bramki i sprzątanie: Lighthouse a11y na wszystkich głównych widokach w obu motywach (A + B), przebudowa HITL wszystkich widoków w obu motywach wg checklisty stanów, przełączenie motywu jasny/ciemny/system na nowej palecie (przetrwanie wyboru po restarcie), pushe PWA/deploy stagingowy zielony, aktualizacja planu (statusy faz) i zamknięcie PRD #17 po akceptacji właściciela. Ewentualny osobny task na pre-existing ostrzeżenia złożoności wystawiony przy /dispatch.

### Assumptions carried in

- Fazy 1–6 zakończone; brak surowych kolorów palety w `src`.

### Out of scope for this phase

- Plan 2 (serwer MCP); cokolwiek poza weryfikacją i dokumentacją.

### Acceptance criteria

- [ ] Lighthouse a11y ≥ 90 na głównych widokach, oba motywy — [command]
- [ ] HITL: wszystkie widoki, oba motywy, stany ładowanie/pusto/błąd/offline — akceptacja właściciela — [observable]
- [ ] Motyw: wybór przeżywa restart; system podąża za OS — [test: istniejący theme.test]
- [ ] `pnpm run types && pnpm test && pnpm run lint:ci && knip && check:docs` + deploy CI zielone — [command]
- [ ] PRD #17 zamknięty po akceptacji — [observable]

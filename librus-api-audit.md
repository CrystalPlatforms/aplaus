# Audyt odczytu i zapisu API Librusa

Stan na 11 października 2026. Wszystkie cztery pary danych uwierzytelniających umożliwiają odczyt JSON z API Gateway Synergii i API wiadomości oraz rzeczywisty zapis, edycję i usuwanie szkiców. Próba dostępu do `api.librus.pl/3.0` przy użyciu samych cookies zwraca 401 na każdym z czterech kont.

Zakres obejmuje wskazane poniżej endpointy i aktualne ustawienia tych kont. Nie jest to pełna specyfikacja wszystkich API Librusa. „Potwierdzony zapis” oznacza przetestowane szkice; możliwość wysłania wiadomości lub zmiany danych szkolnych nie wynika automatycznie z działania szkiców.

## Wyniki dla czterech par

| Konto | Zmienna loginu | Zmienna hasła | Logowanie | READ | WRITE |
|---|---|---|---|---|---|
| Uczeń Adam | `LIBRUS_STUDENT_ADAM_USER` | `LIBRUS_STUDENT_ADAM_PASSWORD` | OK, rola 8 | Gateway i wiadomości; usprawiedliwienia 403 | Szkice POST, PUT, DELETE potwierdzone |
| Rodzic Adam | `LIBRUS_PARENT_ADAM_USER` | `LIBRUS_PARENT_ADAM_PASSWORD` | OK, rola 5 | Gateway, wiadomości i usprawiedliwienia | Szkice POST, PUT, DELETE potwierdzone |
| Uczeń Filip | `LIBRUS_STUDENT_FILIP_USER` | `LIBRUS_STUDENT_FILIP_PASSWORD` | OK, rola 8 | Gateway i wiadomości; usprawiedliwienia 403 | Szkice POST, PUT, DELETE potwierdzone |
| Rodzic Filip | `LIBRUS_PARENT_FILIP_USER` | `LIBRUS_PARENT_FILIP_PASSWORD` | OK, rola 5 | Gateway, wiadomości i usprawiedliwienia | Szkice POST, PUT, DELETE potwierdzone |

Nazwy Adam i Filip są etykietami par z `.env`. Rola została sprawdzona przez `Auth/TokenInfo.UserType` i `/api/me.groupId`; 8 oznacza ucznia, 5 rodzica. Nie opublikowano loginów, haseł, identyfikatorów kont, tokenów ani treści danych szkolnych.

Aktualne dane wszystkich czterech par pozwalają ustanowić osobne sesje Synergii i modułu wiadomości. Wyniki poniżej opisują ostatnie skuteczne testy tych par.

## Adresy i sposób autoryzacji

| Skrót | Adres bazowy | Uwierzytelnienie i wynik |
|---|---|---|
| G | `https://synergia.librus.pl/gateway/api/2.0` | Cookies po zalogowaniu przez OAuth; działa |
| M | `https://wiadomosci.librus.pl/api` | Osobna sesja modułu wiadomości ustanowiona przez przekierowanie z Synergii; działa |
| A3 | `https://api.librus.pl/3.0` | Test z cookies: 401. Nie uzyskano i nie testowano osobnego tokenu Bearer |

Wszystkie skuteczne testy odczytu i zapisu używały `User-Agent: librus-api-verification/1.0`. Do operacji na G i M wystarczyły sesja cookies i nagłówki HTTP opisane niżej. Nie uruchamiano przeglądarki ani nie parsowano tabel HTML.

Logowanie nadal odtwarza protokół strony. Schemat, wspólny dla działających par:

1. `GET https://synergia.librus.pl/loguj/portalRodzina`, zapamiętywanie cookies, ręczne śledzenie przekierowania 302 do OAuth z parametrem stanu.
2. `GET` pod adresami zwróconymi przez OAuth, aż do formularza logowania. Adresu z parametrami stanu nie należy wpisywać na stałe.
3. `POST` do uzyskanego adresu na `https://api.librus.pl/OAuth/Authorization…`.
4. Odczyt `goTo` z JSON i śledzenie ograniczonego łańcucha przekierowań do Synergii.
5. Dla M dodatkowo `GET https://synergia.librus.pl/wiadomosci3` i przejście pod zwrócony adres `MultiDomainLogon` w domenie `wiadomosci.librus.pl`. Token i zakodowany login w tym adresie są poufne.

Żądanie logowania:

```http
POST /OAuth/Authorization… HTTP/1.1
Host: api.librus.pl
User-Agent: librus-api-verification/1.0
Accept: application/json
Content-Type: application/x-www-form-urlencoded
X-Requested-With: XMLHttpRequest
Origin: https://api.librus.pl
Referer: <adres formularza>
x-baner: <wyliczona wartość>
Cookie: <cookies odpowiedniej domeny>

action=login&login=<URL-encoded login>&pass=<URL-encoded hasło>
```

`x-baner` w teście składa się z losowej wartości i czasu Unix w milisekundach, rozdzielonych `_`. Każdy znak obu wartości ma kod Unicode zwiększony o 20. To element odtwarzania logowania, mimo braku przeglądarkowego User-Agent.

Sukces logowania ma kształt `{ "status": "<string>", "goTo": "<URL kontynuacji>" }`. Zaobserwowany wcześniej błąd nieprawidłowych danych logowania miał HTTP 403 i `{ "status": "<string>", "errors": [{ "code": "<integer>", "message": "<string>" }] }`. Cookies należy przechowywać osobno dla każdej pary i według domeny/ścieżki.

## Potwierdzony zakres odczytu

W tabelach komórki oznaczają status HTTP. Odczyty wykonano na wszystkich czterech kontach. W każdym wierszu użyto GET bez body, `Accept: application/json` i cookies danej sesji.

**Gateway G**

| Zasób i ścieżka | Uczeń Adam | Rodzic Adam | Uczeń Filip | Rodzic Filip |
|---|---|---|---|---|
| Informacje o sesji i scopes — `/Auth/TokenInfo` | 200 | 200 | 200 | 200 |
| Dane konta — `/Me` | 200 | 200 | 200 | 200 |
| Oceny — `/Grades` | 200 | 200 | 200 | 200 |
| Kategorie ocen — `/Grades/Categories` | 200 | 200 | 200 | 200 |
| Komentarze ocen — `/Grades/Comments` | 200 | 200 | 200 | 200 |
| Frekwencja — `/Attendances` | 200 | 200 | 200 | 200 |
| Typy obecności — `/Attendances/Types` | 200 | 200 | 200 | 200 |
| Plan lekcji dla tygodnia — `/Timetables?weekStart=2026-10-12` | 200 | 200 | 200 | 200 |
| Kalendarze — `/Calendars` | 200 | 200 | 200 | 200 |
| Dni wolne klasy — `/Calendars/ClassFreeDays` | 200 | 200 | 200 | 200 |
| Wpisy zadaniowe w terminarzu — `/HomeWorks` | 200 | 200 | 200 | 200 |
| Prace domowe — `/HomeWorkAssignments` | 200 | 200 | 200 | 200 |
| Ogłoszenia — `/SchoolNotices` | 200 | 200 | 200 | 200 |
| Uwagi — `/Notes` | 200 | 200 | 200 | 200 |
| Przedmioty — `/Subjects` | 200 | 200 | 200 | 200 |
| Szkoła — `/Schools` | 200 | 200 | 200 | 200 |
| Klasa — `/Classes` | 200 | 200 | 200 | 200 |
| Lekcje — `/Lessons` | 200 | 200 | 200 | 200 |
| Usprawiedliwienia — `/Justifications` | 403 | 200 | 403 | 200 |
| Zebrania — `/ParentTeacherConferences` | 200 | 200 | 200 | 200 |

**Wiadomości M**

| Zasób i ścieżka | Uczeń Adam | Rodzic Adam | Uczeń Filip | Rodzic Filip |
|---|---|---|---|---|
| Dane konta wiadomości — `/me` | 200 | 200 | 200 | 200 |
| Typy odbiorców — `/receivers/types` | 200 | 200 | 200 | 200 |
| Lista odebranych — `/inbox/messages?page=1&limit=1` | 200 | 200 | 200 | 200 |
| Lista wysłanych — `/outbox/messages?page=1&limit=1` | 200 | 200 | 200 | 200 |
| Liczniki nieprzeczytanych — `/inbox/unreadMessagesCount` | 200 | 200 | 200 | 200 |
| Lista szkiców — `/drafts?page=1&limit=1` | 200 | 200 | 200 | 200 |
| Podpisy — `/signatures` | 404 | 404 | 404 | 200 |
| Etykiety — `/tags` | 200 | 200 | 200 | 200 |
| Grupy odbiorców — `/receivers/custom-groups` | 200 | 200 | 200 | 200 |

**API 3.0 A3**

| Zasób i ścieżka | Uczeń Adam | Rodzic Adam | Uczeń Filip | Rodzic Filip |
|---|---|---|---|---|
| `/Me` z cookies, bez Bearer | 401 | 401 | 401 | 401 |

`HomeWorkAssignments` zawiera duże `W`. Wstępny odczyt błędnie zapisanego `/HomeworkAssignments` zwrócił 404; poprawna ścieżka została sprawdzona osobno i działa. Pusta tablica z HTTP 200 oznacza dostępny odczyt bez rekordów w odpowiedzi, a nie brak uprawnień.

404 na `M /signatures` na kontach Adama i ucznia Filipa nie rozstrzyga, czy konto nie ma jeszcze podpisu, czy funkcja jest ograniczona. Frontend traktuje 404 tej listy jako pustą listę podpisów. Na koncie rodzica Filipa lista odpowiedziała 200. Nie testowano tworzenia podpisów.

Nie odczytywano treści istniejących wiadomości przez `/inbox/messages/{id}`, ponieważ taka operacja może oznaczyć wiadomość jako przeczytaną. Testowano wyłącznie listy skrzynek, liczniki oraz szczegóły własnych szkiców testowych.

## Uprawnienia i ograniczenia kont

Na wszystkich czterech kontach:

- `accessToAttachments: true` — API konta deklaruje dostęp do załączników. Nie testowano uploadu.
- `cloudStorageIsConfigured: false` i `schoolCloudStorageVariant: "external_drive"` — integracja dysku sieciowego nie jest skonfigurowana według odpowiedzi konta.
- API zwraca te same 15 typów odbiorców: wychowawcy, nauczyciele, dyrektorzy, rada rodziców, szkolna rada rodziców, pracownik biblioteki, inny specjalista, administrator szkoły, własne grupy odbiorców, sekretariat, logopeda, pedagog, pedagog specjalny, psycholog i pomoc techniczna Librusa. Jest to katalog kategorii, a nie dowód, że każda zawiera odbiorców lub że wysyłka do wszystkich jest dozwolona.
- `Auth/TokenInfo.Scopes` zawiera m.in. `grades`, `attendances`, `home_works`, `home_work_assignments`, `justifications`, `mydata`, `timetable`. Pełne listy są w załączniku JSON.

**Scopes nie są macierzą uprawnień GET/POST/PUT/DELETE.** Oba konta uczniowskie mają w nich `justifications`, lecz GET `/Justifications` zwraca 403. Nie wolno na tej podstawie wnioskować o prawie do zmiany ocen, frekwencji lub wysyłania usprawiedliwień. Identyczne nazwy scopes na kontach nie oznaczają identycznych uprawnień.

## Potwierdzony zakres zapisu

Na każdym działającym koncie utworzono dokładnie jeden nowy szkic z pustą listą odbiorców, sprawdzono jego treść, zmieniono treść i ponownie odczytano, następnie usunięto. Końcowy GET zwrócił 404. Nie modyfikowano istniejących szkiców i nie wysłano wiadomości.

| Operacja w M | Uczeń Adam | Rodzic Adam | Uczeń Filip | Rodzic Filip |
|---|---|---|---|---|
| POST `/drafts/newOne` | 201 | 201 | 201 | 201 |
| GET `/drafts/{id}` — kontrola utworzenia | 200, treść zgodna | 200, treść zgodna | 200, treść zgodna | 200, treść zgodna |
| PUT `/drafts/newOne/{id}` | 200 | 200 | 200 | 200 |
| GET `/drafts/{id}` — kontrola zmiany | 200, treść zmieniona | 200, treść zmieniona | 200, treść zmieniona | 200, treść zmieniona |
| DELETE `/drafts/{id}` | 200 | 200 | 200 | 200 |
| GET `/drafts/{id}` — kontrola usunięcia | 404 | 404 | 404 | 404 |

Przykład requestu tworzącego szkic. Wartości są syntetyczne; nie jest to polecenie do automatycznego wykonania:

```http
POST /api/drafts/newOne HTTP/1.1
Host: wiadomosci.librus.pl
User-Agent: librus-api-verification/1.0
Accept: application/json
Content-Type: application/json
Cookie: <cookies sesji wiadomości>

{
  "receivers": { "schoolReceivers": [] },
  "topic": "VGVzdA==",
  "content": "VHJlc2MgdGVzdG93YQ==",
  "storageId": null
}
```

`topic` i `content` to Base64 bajtów UTF-8, nie szyfrowanie. Powyżej kodują odpowiednio „Test” i „Tresc testowa”. Kod aplikacji używa HTML dla treści wiadomości; wysyłając zwykły tekst, należy odpowiednio zakodować znaki HTML. `storageId` identyfikuje przygotowany magazyn załączników; `null` oznacza brak magazynu w tym teście.

Zaobserwowany response POST 201 oraz PUT 200 — wartości zastąpiono opisami typów:

```json
{
  "data": {
    "identifier": "<integer>",
    "topic": "<string>",
    "body": "<string>",
    "receivers": [],
    "isAnyFileAttached": false,
    "ownerIdentifier": "<integer>",
    "type": "<string>",
    "deleted": false,
    "dateAdded": {
      "date": "<string>",
      "timezone_type": "<integer>",
      "timezone": "<string>"
    },
    "parentMessageIdentifier": null
  }
}
```

PUT `/drafts/newOne/{identifier}` przyjmuje ten sam zestaw pól co POST, z nową treścią. Zwróć uwagę na różnicę nazewnictwa: request ma `content`, a response powyżej ma `body`. DELETE `/drafts/{identifier}` wysłano bez body; odpowiedź 200 miała kształt `{ "data": "<string>" }`. Nazwy pól i typy odpowiedzi z kolejnych GET znajdują się w załączniku.

## Pozostałe operacje zapisu obecne w aplikacji

Poniższe endpointy zostały ustalone z aktualnego kodu JavaScript aplikacji Librusa. **Nie wykonano ich na żadnej z czterech par.** Potwierdzenie sesji i działania szkiców nie potwierdza automatycznie uprawnień do tych operacji. Wszystkie ścieżki są względem M.

| Metoda i ścieżka | Operacja | Struktura requestu |
|---|---|---|
| POST `/messages` | Wysłanie wiadomości | JSON `receivers`, `topic`, `content`, `storageId`, `category`; temat i treść Base64 |
| POST `/messages/reply` | Odpowiedź | JSON wiadomości z kontekstem odpowiedzi; pełny kontrakt nieprzetestowany |
| POST `/messages/forwarding` | Przekazanie | JSON wiadomości z kontekstem przekazywania; pełny kontrakt nieprzetestowany |
| DELETE `/messages/{id}` | Przeniesienie do kosza | Bez body |
| DELETE `/messages/{id}/permanent` | Trwałe usunięcie | Bez body |
| PUT `/trash-bin/messages/{id}/restore` | Przywrócenie | JSON `{}` |
| PUT `/messages/{id}/withdrawal` | Wycofanie wiadomości | Operacja obecna w kliencie; warunki i body wymagają osobnej weryfikacji |
| POST `/drafts/reply` | Szkic odpowiedzi | JSON szkicu + `repliedToMessageId` jako string |
| POST `/drafts/forward` | Szkic przekazania | JSON szkicu + `forwardedMessageId` jako string |
| PUT `/drafts/reply/{id}` | Edycja szkicu odpowiedzi | Jak POST `/drafts/reply` |
| PUT `/drafts/forward/{id}` | Edycja szkicu przekazania | Jak POST `/drafts/forward` |
| POST `/files-storage/attachments` | Utworzenie magazynu załączników | Bez body; klient odczytuje `data.storageId` |
| POST `/attachments` | Upload pliku | multipart: `storageId`, `fileToStore`, `temporaryFileId` |
| DELETE `/attachments/{fileId}/storage/{storageId}` | Usunięcie pliku z magazynu | Bez body |
| POST `/signatures/create` | Utworzenie podpisu | JSON `name`, `content`, `defaultForNewThreads`, `defaultForReplies` |
| PUT `/signatures/modify/{id}` | Zmiana podpisu | Te same pola co utworzenie |
| DELETE `/signatures/delete/{id}` | Usunięcie podpisu | Bez body |
| POST `/tags` | Utworzenie etykiety | JSON z polami formularza; pełny kontrakt nieprzetestowany |
| PUT `/tags/{id}` | Zmiana etykiety | JSON z polami formularza; pełny kontrakt nieprzetestowany |
| DELETE `/tags/{id}` | Usunięcie etykiety | Bez body |
| POST `/receivers/custom-groups` | Utworzenie grupy odbiorców | JSON `{ "name": "<nazwa>" }` |
| PUT `/receivers/custom-groups/{id}` | Zmiana nazwy grupy | JSON `{ "name": "<nazwa>" }` |
| DELETE `/receivers/custom-groups/{id}` | Usunięcie grupy | Bez body |

Przykładowe body wysyłki według kodu klienta, bez wykonywania:

```json
{
  "receivers": { "schoolReceivers": [{ "accountId": "<ID odbiorcy>" }] },
  "topic": "<Base64 UTF-8>",
  "content": "<Base64 UTF-8 treści HTML>",
  "storageId": null,
  "category": "normal"
}
```

Nie należy używać identyfikatorów z innego konta lub innego typu zasobu jako `accountId` odbiorcy. Nieoficjalny klient opisuje potwierdzenie wysyłki jako HTTP 201 i `{ "data": { "messageId": "<integer>", "status": "sent" } }`; jest to kontrakt z kodu źródłowego, nie wynik testu wysyłki na tych kontach. Statusów i response pozostałych nieprzetestowanych mutacji nie należy traktować jako ustalonych.

OPTIONS dla `/messages`, `/drafts/newOne`, `/attachments`, `/tags`, `/signatures/create` zwracał 404 na wszystkich czterech kontach, bez użytecznej listy metod. **Nie oznacza to braku endpointu:** POST do tego samego `/drafts/newOne` następnie zadziałał. Ta usługa nie daje wiarygodnej macierzy metod przez OPTIONS.

Nie ustalono w tym audycie kontraktów zapisu ocen, frekwencji, usprawiedliwień ani oddawania prac domowych. Dostępny GET i flagi zadania domowego nie potwierdzają prawa ani sposobu wykonania tych mutacji.

## Struktury requestów i response odczytu

Typowe żądanie G:

```http
GET /gateway/api/2.0/Grades HTTP/1.1
Host: synergia.librus.pl
Accept: application/json
User-Agent: librus-api-verification/1.0
Cookie: <cookies sesji Synergii>
```

Większość odpowiedzi G ma obiekt nazwany zasobem oraz `Resources` i `Url`. Wyjątki trzeba obsłużyć osobno, np. usprawiedliwienia używają `status`, `message`, `data`. Typ identyfikatora zależy od zasobu: np. ID oceny jest liczbą, a niektóre ID planu lekcji i wiadomości są stringami.

| Zasób | Zaobserwowany skrót response |
|---|---|
| `Me` | `{ Me: { Account, User, Class, Refresh }, Resources, Url }`; `Account` zawiera m.in. `Id`, `UserId`, `GroupId`, `Login`, `IsActive` |
| `Grades` | `{ Grades: [{ Id, Grade, Date, AddDate, Semester, Subject: {Id,Url}, Student: {Id,Url}, Category: {Id,Url}, AddedBy: {Id,Url}, IsConstituent, IsSemester, IsFinal, ... }], Resources, Url }` |
| `Attendances` | `{ Attendances: [{ Id, Lesson, Student, Date, AddDate, LessonNo, Semester, Type, AddedBy }], Resources, Url }` |
| `Timetables?weekStart=2026-10-12` | `{ Timetable: { [data]: [...slotyLekcji] }, Pages: {Next,Prev}, Resources, Url }`; slot jest tablicą, może być pusty; rekord zawiera m.in. `Subject`, `Teacher`, `HourFrom`, `HourTo`, `IsCanceled`, `IsSubstitutionClass` |
| `HomeWorks` | `{ HomeWorks: [{ Id, Content, Date, Category, LessonNo, TimeFrom, TimeTo, CreatedBy, Class lub VirtualClass, Subject, AddDate, ... }], Resources, Url }` |
| `HomeWorkAssignments` | `{ HomeWorkAssignments: [{ Id, Topic, Text, Date, DueDate, Teacher, Student: [...], StudentsWhoRead, StudentsWhoMarkedAsDone, MustSendAttachFile, SendFilePossible, AddedFiles, HomeworkAssigmentFiles, ... }], Resources, Url }` |
| `Justifications` — rodzic | `{ status, message, data: [{ id, messageFromParent, postDate, justificationStatus, lessons: [{number,date}], attachment, dateFrom, dateTo, justifiedAbsences, notifiedTeachers }], Resources, Url }` |
| `SchoolNotices` | `{ SchoolNotices: [{ Id, StartDate, EndDate, Subject, Content, AddedBy, CreationDate, WasRead }], Resources, Url }` |

`HomeworkAssigmentFiles` zachowuje pisownię z odpowiedzi serwera. Pola pokazane po `...` i różnice między rekordami są rozpisane w załączniku JSON. Typy elementów pustej tablicy pozostają nieustalone z danego odczytu.

Typowe żądanie M:

```http
GET /api/inbox/messages?page=1&limit=1 HTTP/1.1
Host: wiadomosci.librus.pl
Accept: application/json
User-Agent: librus-api-verification/1.0
Cookie: <cookies sesji wiadomości>
```

Struktura listy wiadomości odebranych:

```json
{
  "data": [{
    "messageId": "<string>",
    "senderFirstName": "<string>",
    "senderLastName": "<string>",
    "senderName": "<string>",
    "topic": "<string>",
    "content": "<string>",
    "sendDate": "<string>",
    "readDate": "<string lub null zależnie od rekordu>",
    "tags": [],
    "category": "<string lub null>",
    "otherNodeUuid": null,
    "otherNodeAccountId": null,
    "isAnyFileAttached": "<boolean>"
  }],
  "total": "<integer>"
}
```

`GET M /me` zwraca bezpośredni obiekt z polami m.in. `firstName`, `lastName`, `groupId`, `groupName`, `accountId`, `originSystem`, `accessToAttachments`, `cloudStorageIsConfigured`, `schoolCloudStorageVariant`, `nextWorkStartTime`, `canSetIndividualHours`. `GET /receivers/types` zwraca m.in. `data.list: [{id,name}]`. Pozostałe odczyty M mają własne struktury udokumentowane w załączniku.

Dane z list i szczegółów nie powinny być dekodowane na ślepo według jednej reguły: Base64 jest potwierdzone dla requestu wiadomości/szkicu; format konkretnego pola response trzeba odczytać zgodnie z jego endpointem.

## Załącznik techniczny i źródła

[Wyniki i struktury odpowiedzi w JSON](librus-api-audit-2026-10-11.json) zawierają osobne wpisy dla czterech par, statusy żądań, scopes i flagi funkcji, schematy odpowiedzi oraz wyniki kontroli szkiców. Są to obserwowane struktury typów, nie oficjalny OpenAPI ani kompletna specyfikacja pól wymaganych. Schematy próbkują do 12 elementów tablicy; dynamiczne klucze zastąpiono `<dynamic-key>`. Pusta tablica nie określa typu jej przyszłych elementów. Schemat planu lekcji pochodzi z uzupełniającego odczytu, który łączy warianty dynamicznych kluczy.

Źródła kontraktów nieprzetestowanych operacji:

- [Kod aplikacji wiadomości Librusa](https://wiadomosci.librus.pl/nowy/assets/App-C15M0hxS.js) — ścieżki i metody operacji, requesty JSON, szkice i załączniki.
- [Kod konfiguracji klienta HTTP Librusa](https://wiadomosci.librus.pl/nowy/assets/index-B0bqzhD-.js) — klient z cookies i bazą API `/api`.
- [Kod nieoficjalnego klienta wysyłki](https://github.com/krzysztofbury/librus-python-api/blob/1f59d84799db0191c17f0e173f162feacd95d3a5/src/librus_python_api/config.py#L1199) — body nowej wiadomości.
- [Parser potwierdzenia wysyłki](https://github.com/krzysztofbury/librus-python-api/blob/1f59d84799db0191c17f0e173f162feacd95d3a5/src/librus_python_api/modern_messages.py#L248) — opisany response wysyłki, nieprzetestowany tutaj.
- [Klient odczytów API](https://github.com/andrewkoltsov/librus-sdk/blob/2b6ec88b08870198b53679aea84faf0dc056d82a/src/sdk/synergia/SynergiaApiClient.ts) — nazwy i parametry endpointów porównane z żywymi odpowiedziami.

Najważniejsze dla migracji tego repo: użyć G do danych szkolnych i M do wiadomości; utrzymywać osobne sesje każdego konta i sesję wiadomości; rozróżniać struktury odpowiedzi obu API; zaimplementować obsługę 401, 403, 404 oraz błędu logowania przed parsowaniem danych. Automatycznego ponawiania nie należy stosować do wysyłania wiadomości po niejednoznacznym wyniku. Skuteczny test szkiców nie uzasadnia wykonywania innych mutacji bez określenia konkretnej operacji.

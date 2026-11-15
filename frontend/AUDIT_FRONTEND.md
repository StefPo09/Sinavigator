# Audit pentru rescrierea promptului

Verificare locală: 15 noiembrie 2026. Acest raport descrie sursa inspectată, nu o validare a site-ului public.

## Ce am verificat

- Inventar și scanare structurală a 81 de fișiere text proprii: sursă, rute, logică, teste, configurări, documentație, scripturi și metadate. Nu includ dependențele generate sau lockfile-ul în acest număr.
- Lectură orientată pe ecranele Sistem/Lună/Suprafață, Workspace, navigație, timeline, panouri, comparație, stări de date și stylesheet.
- Inventarul activelor și metadatele JSON ale celor 14 GLB-uri; nu am randat sau validat vizual fiecare mesh.
- Execuție `npm.cmd test` pe Node 26.12.1.
- Nu am instalat dependențe, pornit aplicația, făcut capturi noi sau rulat build/lint/typecheck: `frontend/node_modules` lipsește în această copie. Nu am modificat codul aplicației.

## Context actualizat

1. App Router: intrări în `src/app/`, ecrane în `src/app-pages/{Workspace,Sistem,ZoneAterizare,Suprafata}.tsx`.
2. Nu există `src/pages/` sau `AGENTS.md` în frontendul inspectat. Promptul anterior descria o structură depășită. Verifică din nou la execuție, fiindcă Next poate genera instrucțiuni locale.
3. Rutele de compatibilitate există în `src/app/`: Sistem, ZoneAterizare, Suprafata, moon, surface. Păstrează comportamentul efectiv, nu recrea vechiul Pages Router.
4. `load.ts` încearcă `/api/bundle`, apoi `/data/bundle.json`. Proxy-ul Next apelează `/api/v1/bundle` la backend. Nu mai este corect că backendul este cunoscut drept exclusiv `/health`; implementarea backendului nu a fost auditată în acest scope.
5. Există Bundle static de 119.569 bytes, `provenance: computed`, pentru Apollo 15/17, cu geometrie declarată Horizons DE441 și profiluri locale LROC.
6. Bundle-ul declară explicit `validation.status: not-validated`. Date calculate nu înseamnă verificate independent. Profilurile sunt declarate derivate din mesh-uri simplificate, pe rază de 5 km.
7. Șase scenarii: două locuri × starturi 27, 28 și 30 noiembrie 2026; fiecare 72 h la pas de 10 min. Acoperirea totală ajunge la 3 decembrie. Nu sunt date istorice Apollo în acest Bundle.
8. Sistemul folosește separat funcțiile analitice din `ephemeris.ts`. Suprafața Apollo folosește `siteSkyAt` din `bundleEphemeris.ts`. Păstrează diferența de proveniență explicită.

## Probleme concrete de tratat

- `globals.css` are 757 de linii și mai multe sisteme suprapuse: comparator, aplicație cinematică fullscreen/glass și observatory cu sidebar. Unele selectoare sunt moștenire; determină utilizarea înainte de eliminare.
- Butonul `.glow` pulsează; hover-ul mută butoanele; badge-uri, borduri și carduri sunt repetate. Acestea contribuie la impresia de șablon, fără să dovedească folosirea AI.
- Titlul paginii, titlul scenei și titlul inspectorului repetă informația; datele tehnice și decorația concurează cu scena.
- Comparația este într-un drawer de 90vh, separat de explicația de pe suprafață.
- `SuprafataView` pornește `SurfaceArrival` la intrare. Modalul combină așteptarea activelor cu un transfer estimat din `Date.now()`, separat de timpul analizat. Nu este necesar pentru intrarea pe teren și poate sugera o călătorie reală dacă nu este contextualizat.
- `LandingSurface` calculează vizibilitatea cu modelul teren, indiferent de `ws.model`; verifică consistența când se introduce experimentul idealizat/teren. Relieful vizual poate rămâne real, dar modelul de analiză trebuie etichetat.
- `LandingPanel` descrie orizontul din semnul elevației, nu din profilul local. Distinge orizont ideal de teren.
- `goSunrise` caută primul eșantion viitor vizibil; nu este un răsărit exact sau neapărat o tranziție detectată. Precalculează disponibilitatea și folosește formularea corectă.
- `findOptions` exclude scenariile cu început anterior timpului cerut, deși poate exista o porțiune utilizabilă. Un test cere momentan această excludere; cerința și testul trebuie schimbate împreună dacă se repară.
- Nu am identificat implementarea mini-misiunilor sau a modurilor Elev/Planificator în ecranele citite.

## Active — păstrează investiția existentă

- Luna: 81.505.784 bytes, aproximativ 81,5 MB zecimali; model Blender cu o imagine, fără extensie obligatorie de compresie declarată în GLB.
- Rocile și plăcile folosesc deja Meshopt; nu recomanda „adaugă Meshopt” ca și cum ar lipsi peste tot.
- Apollo 15: trei plăci high aproximativ 10,5 MB; low aproximativ 2,6 MB.
- Apollo 17: trei plăci high aproximativ 16,8 MB; low aproximativ 3,8 MB.
- Aceste sume nu includ texturi externe suplimentare, decodoare sau memorie GPU. Nu confunda dimensiunea fișierelor cu traficul efectiv măsurat.
- Scripturile și instrucțiunile de regenerare sunt în `tools/terrain/`. Metadatele arată ortofoto Apollo 15 apropiată M111571816_50CM și regională M1121209902_120CM: nu le confunda.

## Teste executate

`npm.cmd test` eșuează: șase verificări din `bundleEphemeris.test.ts` trec; celelalte cinci fișiere de test nu se încarcă din cauza aliasului `@/lib` în runnerul Node. Acest rezultat nu demonstrează eșecul celor cinci algoritmi. Nu modifica orbește `type: module`; repară rezolvarea importurilor/runnerul cu impact minim.

Nu mai afirma „15 teste trecute”. Verifică din nou numărul efectiv după repararea runnerului.

## Direcția recomandată

Un **atlas lunar interactiv**, cu tipografie atentă, relief dominant, adnotări geografice și o singură ierarhie de controale. Păstrează identitatea Sinavigator; renunță la efectele și repetițiile care nu ajută lecția. Dovada calității: coerență, detalii, performanță și o mini-misiune completă, nu ascunderea creditelor AI.

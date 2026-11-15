# Progres — redesign „atlas lunar”

Data: 15 noiembrie 2026. Lucrat numai în `frontend/`. Fără commit, push sau deploy. Copia nu are `.git`.

## Verificat efectiv

| Comandă | Rezultat |
|---|---|
| `npm.cmd test` | 33/33 trec (7 fișiere; înainte: 6 trec, 5 fișiere nu se încărcau) |
| `npx.cmd tsc --noEmit -p .` | fără erori, după `next typegen`/`next build` (tipul global `LayoutProps` este generat de Next în `.next/types`; pe o copie curată, fără `.next`, tsc raportează lipsa lui) |
| `npx.cmd eslint src` | 0 erori, 0 avertismente |
| `npm.cmd run build` | reușit; rutele `/`, `/Sistem`, `/ZoneAterizare`, `/Suprafata`, `/moon`, `/surface`, `/api/bundle` prezente |

Verificare în browser (dev, port 3002, backend oprit → `/api/bundle` 503 → fișierul static), la 1440×900, 1366×768 și 375×812:
- Lună: selecție prin marker/listă, inspector, timeline cu benzi și evenimente, relief detaliat la cerere (încărcat și ancorat corect).
- Misiunea: A17 27 nov vs A17 30 nov, predicție „Doar A” → „Corect”, „De ce?” = Soarele la −8,5°, sub orizont; experimentul ideal/teren arată +3 h 48 min la apusul din A17.
- Suprafață: intrare directă, fără modal; la 29 nov 02:24 UTC: „ascuns de teren”, mesaj compact, „Soarele nu mai devine vizibil până la capătul datelor”.
- Sistem, Planificator (comparația completă inline), 375 px fără overflow orizontal al paginii.

Nu am verificat: 200% zoom real (doar lățimea echivalentă de 375 px), cititor de ecran, Safari/Firefox, încărcarea cu backendul pornit, WebGL dezactivat (codul de fallback există, nu l-am forțat), XR.

## Corectitudine (înainte de redesign)

- Runner teste: importurile `@/lib` din teste → căi relative (Node nu cunoaște aliasul TS). Fără `type: module`.
- `assessFit` nu putea întoarce niciodată „Date insuficiente” (variabila nu era setată; semnalat și de lint). Reparat; testul existent trece acum.
- `findOptions` păstrează partea utilizabilă a unei ferestre deja deschise la startul cerut (`clippedStart`); testul nou o acoperă, testul vechi redenumit („ended before”).
- `LandingPanel` (elevație > 0 ⇒ „deasupra orizontului”) înlocuit de `SiteInspector`: starea vine din aceeași analiză ca concluziile și distinge „sub orizont”, „ascuns de teren”, „sub prag”, „necunoscut”.
- `LandingSurface`: concluziile folosesc `ws.model`; scena păstrează terenul real și afișează explicit când experimentul ideal este activ.
- `goSunrise` → `nextSunVisible`: precalculat, „primul moment cu Soarele vizibil (≈, interpolat)” sau „nu mai devine vizibil până la capătul datelor”.
- Încărcare: termen de 10 s în client și 6 s în proxy (504), mesaje cu sursa; „invalid” arată ce sursă a eșuat.

## Design

Vezi `DESIGN.md`. `globals.css`: 757 → 564 linii, rescris o dată ca un singur sistem (tokenuri, compoziție, componente); eliminate topbar/hero/drawer/glass/glow/hover-lift și animațiile de intrare.

## Lecția

`src/lib/logic/lesson.ts` (pur, testat în `tests/lesson.test.ts`) + `components/lesson/Mission.tsx`, `Term.tsx`.
Elev = misiunea; Planificator = misiunea + `Comparison` inline (fără sertar). Ambele folosesc aceleași `selA/selB`, durată, model.

## Performanță / active

- `moon.glb` 81 505 784 bytes nu se mai descarcă implicit (înainte: automat la calitate „ridicată”). Globul pornește cu textura 2k; relieful se încarcă la cerere și rămâne în cache în sesiune.
- Build: `.next/static/chunks` ≈ 1,5 MB pe disc în total; cel mai mare chunk 356 KB (necomprimat). Nu am măsurat trafic HTTP/GPU.

## Limite și restanțe

- Testele de utilizare cu trei persoane nu au fost făcute.
- `src/components/zone/ZonePanel.tsx` nu este importat nicăieri (moștenire); l-am lăsat neatins și fără stiluri.
- `fmtDeg` folosește punct zecimal (convenție existentă), nu virgulă.
- La primele verificări am rulat din greșeală `npx tsc`/`npx eslint` din directorul părinte; npx a descărcat în cache-ul global pachetele `tsc@2.0.4` și `eslint@10.15.0` (nu în proiect). Nu au modificat fișiere din repo.

## Iterația 2 — tablou Sistem, Luna clicabilă, cinematice, logo (15 nov 2026)

Verificat: `npm.cmd test` 33/33, `tsc` curat, `eslint` 0/0, `npm.cmd run build` reușit (include `/icon.svg`). Browser (dev pe 3002, server pornit în afara sesiunii mele, nu l-am oprit) la 1440×900 și 375×812.

- **Sistem = tablou Soare–Pământ–Lună** (`components/sistem/SystemScene.tsx`, rescris): Soarele parțial în cadru la stânga, Pământul în centru, Luna pe orbita schematică la elongația calculată (se mișcă cu timeline-ul), lumină din față-stânga, nota „Reprezentare schematică; nu este la scară.” Rotire limitată ca tabloul să rămână compus; pe ecrane înguste se păstrează lățimea cadrului. `sistem/scale.ts` (nefolosit) a fost șters; opțiunea „Urmărește Pământul” nu mai are sens în tablou și a fost scoasă.
- **Luna clicabilă**: hover → contur lime + eticheta „Luna · clic pentru apropiere” + cursor; clic (nu tragere), Enter sau Space → apropiere. Țintă mai mare la touch.
- **Cinematice refăcute pentru structura nouă**: Sistem→Lună (arc + câmp vizual strâns până Luna umple cadrul, estompare în negru, globul pornește la aceeași scară și se așază); Lună→Suprafață (arc pe glob + coborâre razantă cu câmp îngust, apoi la sol privirea pornește în jos și se ridică spre orizont, o singură dată); Suprafață→Lună și Lună→Sistem (retragere inversă). În timpul zborului: benzi de cadru, interfața din jur se estompează, pagina urcă la scenă. `prefers-reduced-motion` reduce totul la tăieturi.
- **Logo și iconiță**: PDF-urile primite (SVG tipărite de Chromium) au fost reconvertite vectorial în `public/brand/` (original + variante fără fundal); logo-ul fără fundal în navigație, iconița ca `src/app/icon.svg` (înlocuiește `favicon.ico`-ul implicit, șters).
- `AGENTS.md` din `frontend/` a fost generat automat de `next dev`, nu de mine.

Nu am verificat: cinematicele pe un dispozitiv real/GPU slab, Safari/Firefox, cititor de ecran pe tablou (are `role="button"` și etichetă).

## Iterația 3 — doar relief detaliat, marcaje la zoom, cinematice fără benzi (15 nov 2026)

Verificat: `npm.cmd test` 33/33, `tsc` curat, `eslint` 0/0, `npm.cmd run build` reușit (rulat înainte de ultima corecție, care doar elimină un import nefolosit; tsc și eslint au fost rulate din nou după ea). Browser la 1440×900 (dev pe 3002, server care nu e pornit de mine).

- **Globul arată doar modelul LRO detaliat** (`moon.glb`, 81 505 784 bytes): butonul „Încarcă relieful detaliat” și sfera simplă au fost scoase. Până la încărcare apare pe scenă „Se încarcă relieful lunar LRO” cu bara de progres reală (bytes primiți/total). Sfera simplă apare doar dacă modelul lipsește sau nu se poate încărca, cu mesaj. Încărcătorul e în `components/shared/moonModel.ts`; tabloul Sistem îl preîncarcă după 1,2 s, ca globul să fie gata la sosire. Consecință: deschiderea perspectivei Sistem sau Lună descarcă 81,5 MB (o dată pe sesiune).
- **Marcajele nu mai cresc la zoom**: punctul și inelul se scalează cu distanța camerei (aceeași mărime pe ecran), sunt mai fine și dispar în coborâre și până la încărcarea reliefului.
- **Cinematice fără benzi negre și fără ecran negru**:
  - Sistem → Lună: traiectorie curbă (Bézier) pe lângă Pământ, privire care anticipează Luna, înclinare ușoară în viraj, Soarele și orbita se estompează, câmpul vizual se strânge, expunerea crește la final.
  - Schimbarea perspectivei: scena veche se dizolvă (estompare + supraexpunere + mărire ușoară), cea nouă apare din aceeași stare și se clarifică; coloana din dreapta și timeline-ul revin cu întârziere.
  - Lună: din tablou, globul se așază cu o rotire și o înclinare care se stabilizează.
  - Lună → sol: arc deasupra globului până la sit, apropiere razantă, privirea se ridică spre orizontul curbat al Lunii; la sol camera coboară de la ~600 m la 1,7 m, cu rotire și privire care se ridică spre orizont (3,2 s; un drag o întrerupe).
  - Înapoi: aceleași trasee, inversate.

Nu am verificat: fluiditatea pe un GPU slab sau pe telefon real, timpul de încărcare a celor 81,5 MB pe o conexiune lentă.

## Iterația 4 — engleză, tutorial, quiz, preîncărcare, Planificator vizibil (15 nov 2026)

Verificat: `npm.cmd test` 35/35 (nou: `tests/quiz.test.ts`), `tsc` curat, `eslint` 0/0, `npm.cmd run build` reușit. Browser la 1440×900 și 375×812 (dev pe 3002, server care nu e pornit de mine).

- **Interfața este în engleză** (toate textele vizibile, aria-label-uri, formate de dată „27 Nov 2026”, puncte cardinale N/E/S/W, export, metadate, `lang="en"`). Comentariile din cod au rămas parțial în română. Textele care vin din fișierul de date (`public/data/bundle.json`: notă, descrierile straturilor, ipoteze) sunt generate de backend și apar în continuare în română în „About, sources”.
- **„Now”**: azi (15 nov) este înaintea datelor (27 nov – 3 dec), deci butonul se numește „Data start” și duce la primul moment, cu mesaj explicit; „Now” real doar când azi e în interval. Nicio extrapolare.
- **Soarele mai departe** în tabloul Sistem (x −25,5, rază 11,5).
- **Tutorial** la prima vizită (9 pași, spotlight pe interfața reală, butoane care zboară la pagina potrivită, Skip/Back/Next, Esc); se poate relua din „Tutorial”; `?tour=0` îl oprește. La final pornește quiz-ul.
- **Lunar Quiz** (mecanică cu timp, nu o copie a unui produs anume): 7 întrebări, 20 s, 500–1000 puncte după viteză, bonus de serie, explicație după fiecare răspuns, tastatură 1–4/A–D. Întrebările de date sunt calculate din Bundle (`lib/logic/quiz.ts`, testat), cele de concept verifică ideile lecției.
- **„Prepare for presentation”** (stânga jos): descarcă și decodează înainte modelul Lunii, terenurile Apollo 15/17 la calitatea curentă, rocile și texturile, cu progres; apoi „✓ Ready for presentation”.
- **Planificatorul**: comutatorul aduce în cadru secțiunea „Compare two plans in detail”, cu explicație; e disponibil pe toate paginile.
- **Misiunea** e vizibilă pe toate paginile, are intrare în meniu („4 Mission”) și buton „Start the mission ↓” în inspector.
- `ZonePanel.tsx` (nefolosit) a fost șters.

Nu am verificat: testul cu utilizatori, cititor de ecran pe tutorial/quiz, Safari/Firefox.

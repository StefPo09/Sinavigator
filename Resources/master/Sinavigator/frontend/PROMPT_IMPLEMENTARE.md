# Prompt actualizat — Sinavigator, atlas lunar educațional

Copiază textul de mai jos în agentul de programare. Este rescris după sursa verificată la 15 noiembrie 2026, nu după vechea structură din conversație. Citește și `AUDIT_FRONTEND.md`. Capturile vechi sunt referință vizuală; verifică starea actuală înainte să atribui o problemă codului.

---

Lucrezi la **Sinavigator**, proiect NASA Space Apps 2026, provocarea Lunar Landing Site Navigator. Răspunde-mi în română și lucrează ca un inginer frontend senior cu judecată de product designer și director artistic.

Vreau un produs memorabil și atent lucrat. În prezent, anumite repetiții vizuale și organizarea informației îl fac să semene cu un șablon de dashboard. Nu rezolva asta adăugând încă un gradient, o animație sau schimbând fontul. Construiește o identitate coerentă, bazată pe Luna reală, pe informații editate atent și pe interacțiuni care au un motiv.

Ținta este o calitate care arată timp și grijă investite. **Nu promite că poți demonstra autoratul din aspect și nu ascunde folosirea AI.** Păstrează declarațiile, creditele și limitările reale. Schimbăm produsul și execuția, nu istoricul proiectului.

## A. Unde lucrezi și ce păstrezi

Repo: `C:\Users\dariuschdev\Documents\ClaudeCode\SpaceArrmyGit\Sinavigator`.

**Scrie/modifică exclusiv în `frontend/`.** Nu modifica backendul, Resources, configurația Git sau vechiul SpaceArrmy. Fără reset, ștergeri globale, commit, push, deploy sau descărcări mari necerute. Păstrează schimbările colegilor. Copia auditată nu conține `.git`; nu presupune că poți crea un checkpoint Git acolo.

Tehnologie actuală: Next.js 16.4.6, React 19.3, TypeScript și Three.js 0.187. Inspectează versiunile înainte să lucrezi. Citește instrucțiunile locale aplicabile și documentația Next instalată pentru API-urile pe care le modifici. `AGENTS.md` lipsea la audit; dacă apare, citește-l. Nu reinventa unul doar fiindcă îl menționa promptul vechi.

Structura actuală obligatorie:

```text
src/app/                         # App Router, layout, globals.css, rute și API proxy
src/app-pages/Workspace.tsx      # orchestrare și stare comună
src/app-pages/Sistem.tsx
src/app-pages/ZoneAterizare.tsx
src/app-pages/Suprafata.tsx
src/components/shared/
src/components/sistem/
src/components/zone/
src/components/suprafata/
src/lib/data/
src/lib/logic/
public/3d-models/
public/textures/
public/data/bundle.json
tools/terrain/
tests/
```

Nu există vechiul `src/pages/`: nu-l recrea. Păstrează intrările și redirecturile App Router existente, inclusiv aliasurile `/Sistem`, `/ZoneAterizare`, `/Suprafata`, `/moon`, `/surface` și selecția prin `?p=...` conform comportamentului verificat. Nu introduce client router suplimentar.

Păstrează numele, tema întunecată, accentul lime recognoscibil, cele trei perspective și terenul Apollo 15/17. Poți rafina geometria UI-ului, dimensiunile, compoziția, copy-ul și prezentarea. Nu rescrie motorul 3D sau datele pentru un redesign.

## B. Înțelege datele reale înainte să desenezi rezultate

Context verificat:
- `src/lib/data/load.ts` încearcă `/api/bundle`, apoi `/data/bundle.json`; fixtures numai când sursele nu sunt utilizabile conform logicii existente.
- `src/app/api/bundle/route.ts` face proxy către `/api/v1/bundle` la backend. Păstrează contractul, fără modificări backend.
- Există Bundle static calculat pentru Apollo 15 și Apollo 17: șase scenarii de câte 72 h, starturi 27/28/30 noiembrie 2026, pas de 10 min, acoperire totală până la 3 decembrie.
- Metadatele declară Horizons DE441 și profiluri LROC locale pe 5 km, derivate din mesh-uri simplificate. `validation.status` este `not-validated`.
- Sistemul folosește separat modelul analitic din `ephemeris.ts`; suprafața Apollo folosește `bundleEphemeris.ts`. Nu pune aceeași etichetă NASA pe ambele.
- Nu există date istorice Apollo în Bundle-ul inspectat. Un mod istoric trebuie tratat separat și explicit, nu iluminat cu date moderne mascate.
- Datele actuale pot fi schimbate de colegi: recitește fișierul și sursa, nu fixa în UI acest inventar.

Nu hardcoda valori pentru a obține un demo spectaculos. Nu numi datele calculate „validate independent”. Un profil de 5 km nu garantează orizont complet. Diferențiază înălțimea DTM, rezoluția texturii, mesh-ul simplificat și detaliul ilustrativ al regolitului.

## C. Direcție artistică unică: atlas lunar interactiv

Imaginează o expoziție de muzeu și un atlas de teren, executate cu precizia unui instrument științific. Scena și geografia sunt identitatea vizuală; interfața este rama lor.

### Compoziție

- Un singur spațiu de lucru cu Sistem / Lună / Suprafață. Păstrează orientarea în aplicație și starea între perspective.
- Desktop: navigație discretă în stânga, scenă dominantă în centru, coloană editorială de informații în dreapta. Folosește proporții testate, nu trei carduri egale dintr-un template.
- Punct de pornire la 1440 px: navigație circa 168–192 px, inspector circa 300–340 px; ajustează după conținut. Scena primește spațiul rămas și timeline apropiat, vizibil.
- O singură identitate principală a paginii. Nu repeta aceeași denumire în H1, header de scenă și titlu mare al inspectorului.
- Folosește suprafețe și separatoare discrete. Nu încadra fiecare paragraf într-un card și apoi într-un alt card.
- Mobil: scenă, rezultat scurt, acțiune principală și detalii în flux vertical; navigație textuală compactă, nu un dashboard micșorat. Nu impune totul într-un viewport și nu ascunde informația necesară pentru a evita scrollul.

### Tipografie și culoare

- Refolosește inițial Space Grotesk și JetBrains Mono; rafinează ierarhia înainte de a adăuga fonturi. Mono pentru UTC, coordonate și valori; nu pentru toate subtitlurile.
- Titlu principal aproximativ 28–32 px desktop, subtitluri 16–20 px, corp 14–16 px; etichete mici numai pentru metadate secundare. Testează lizibilitatea și zoomul.
- Păstrează charcoal, alb cald și lime ca identitate. Lime pentru selecția principală și cel mult o acțiune dominantă pe context, nu pentru fiecare buton, titlu, slider și insignă simultan.
- Soarele are culoarea lui, Pământul albastrul lui. Stările folosesc text/simbol, nu doar culoare.
- Borduri fine, colțuri consecvente și mai puțin rotunjite pentru panouri. Forma unei pastile trebuie să semnifice o stare sau o alegere, nu să fie stilul universal.

### Detalii care arată lucru atent

- Markerele Apollo sunt ancorate geografic, cu punct, etichetă și leader line când este necesar. Nu se suprapun și nu par lipite arbitrar pe glob. Oferă echivalent textual accesibil.
- Coordonatele, scara, direcțiile cardinale și marcajele evenimentelor folosesc o gramatică vizuală comună.
- Timeline-ul arată selecția, intervalele și evenimentele; nu este doar un slider generic sub canvas. Nu adăuga markere fără date.
- Terenul ocupă spațiu util în vederea de la sol. Respectă camera reală; permite schimbarea privirii fără un cadru implicit dominat inutil de cer negru.
- Definițiile cu desene SVG proprii pentru azimut/elevație au aceeași linie grafică precum charturile, nu clipart fără legătură.
- Loading-ul menține compoziția și explică ce strat se încarcă. Fără procente false sau întârzieri intenționate pentru „cinematografie”.

### Ce elimini sau temperezi

Fără hero de landing page, bento grid decorativ, pereți de badge-uri, glassmorphism peste tot, glow pulsant pe CTA, hover care ridică toate controalele, zgomot/grain aplicat global, text de marketing vag sau animații la fiecare bloc. Nu adăuga imperfecțiuni, greșeli sau efecte „manuale” pentru a simula autorat uman. Nu înlocui acest template cu alt template.

În `globals.css` există stiluri istorice suprapuse: comparator, fullscreen/glass și observatory. Identifică selectoarele utilizate, consolidează într-un singur sistem și verifică regresiile. Nu mai adăuga un nou strat de override-uri la sfârșit. Împarte în CSS Modules pe feature doar unde clarifică responsabilitățile.

## D. Experiența de bază

### Sistem
- Păstrează orbitele și controlul timpului. Vizualizarea este schematică și comprimată; arată limita discret, dar accesibil.
- Studentul înțelege ce se mișcă și de ce schimbarea timpului contează. Nu trebuie să învețe un panou de comandă.
- Faza observată de pe Pământ nu este iluminarea locală la punctul de aterizare. Explică diferența.
- Comenzile de cameră sunt discrete. „Explorează Luna” este acțiunea principală.

### Lună
- Selectarea unui marker evidențiază situl și informația; intrarea pe suprafață este o acțiune explicită. Păstrează zborul existent ca tranziție scurtă, nu ca obstacol.
- Inspectorul: unde suntem, de ce merită explorat, ce date avem, concluzia utilă și acțiunea următoare. Metadatele lungi se extind inline.
- Păstrează accesul la comparație, dar nu ascunde rezultatul educațional într-un drawer de 90vh. Rezumatul și mini-misiunea rămân în context. Tabelul avansat poate fi într-o zonă extinsă, cu focus/închidere corecte.

### Suprafață
- Păstrează investiția în plăcile close/near/far, roci, iluminare, privirea spre Soare/Pământ și alternativa 2D/text.
- „Înapoi la Lună” păstrează situl și timpul. Arată clar situl și momentul activ.
- Un mesaj nocturn compact nu acoperă relieful. Separă „corp în afara privirii” de „ascuns de teren”.
- Fără transfer obligatoriu la fiecare intrare. `SurfaceArrival` devine replay educațional opțional, cu Skip disponibil imediat. Dacă suprafața este gata, utilizatorul intră direct.
- Transferul estimat din `Date.now()` nu este zborul istoric Apollo, o dată de aterizare la sit sau o fereastră de lansare validată. Etichetează-l și păstrează-l separat de timpul analizei.
- Iluminarea de inspectare, umplerea și detaliul ilustrativ sunt explicate fără a pretinde realism fizic integral. Texturile cu umbre imprimate nu devin simulări dinamice ale umbrei.

## E. Mod Elev / Planificator și lecția completă

Două butoane discrete, nu două aplicații. **Elev** implicit; **Planificator** este analiză educațională detaliată. Ambele folosesc aceleași date, timp, reguli și alegeri.

Elev: întrebare, indicii, rezultat scurt, „De ce?”, suprafață și retry. Planificator: tabel, unghiuri, praguri, pas, surse și export. Nu ascunde datele lipsă/limitele doar în modul avansat.

Prima mini-misiune:

> „O activitate a roverului are nevoie de două ore continue cu Soarele și Pământul vizibile. Găsește un loc și o dată potrivite în perioada analizată.”

1. Durată cu butoane: 30 min / 1 h / 2 h / 4 h.
2. Studentul alege A/B sau același sit la două date.
3. Prezice A / B / Ambele / Niciuna / Date insuficiente.
4. Indicii opționale: verifică Soarele → verifică Pământul → caută suprapunerea continuă.
5. „Verifică” oferă feedback calculat, nu o poveste cu câștigător prestabilit.
6. „Vezi cauza” selectează scenariul/evenimentul și explică direcția limitativă pe suprafață.
7. „Încearcă altă dată” păstrează contextul; intrările schimbate invalidează răspunsul vechi, nu simpla explorare a cursorului pentru un exercițiu fix.
8. Întreabă „Ce s-a schimbat și de ce?”. Fără LLM obligatoriu sau cont.

Nu crea încă zece misiuni sau un sistem de puncte. O lecție bună și completă are prioritate.

## F. Rezultate și explicații în cuvinte

O concluzie înaintea charturilor:
„Soarele și Pământul sunt vizibile împreună [durată]. Activitatea de [durată cerută] încape, cu [rezervă].”

Valorile sunt generate din date. Distinge Încape / Nu încape în perioada cunoscută / Date insuficiente. Afișează UTC, domeniul și aproximarea evenimentelor. Nu extrapola un interval trunchiat.

„De ce?”:
„Terenul din această direcție ajunge la [H]°, iar Pământul este la [El]°. În acest model, terenul îl ascunde.”

Nu inventa „dealul din vest” dacă azimutul nu confirmă direcția. Dacă locul și data se schimbă simultan, nu izola o cauză fără verificare.

Experiment Idealizat 0° / Teren: păstrează aceleași intrări și descrie efectul real. Dacă nu schimbă rezultatul, spune asta; dacă lipsesc date, nu îl simula ca real.

Termenii „?” au explicații de 1–2 propoziții și, pentru azimut/elevație, desen mic SVG. Acces la clic/tastatură, nu numai hover.

## G. Probleme tehnice concrete — verifică înainte de redesign

- `npm test` eșuează acum la încărcarea a cinci fișiere din cauza aliasului `@/lib` în Node. Șase verificări din `bundleEphemeris.test.ts` trec. Repară minimal runnerul/importurile, nu algoritmii doar ca să dispară eroarea. Nu adăuga orbește `type: module` cu efecte asupra Next/config.
- `LandingPanel.tsx` deduce „deasupra orizontului” din semnul elevației; distinge orizont ideal de profil local. Nu declara corpul vizibil numai din elevație >0.
- `LandingSurface.tsx` folosește orizontul terenului indiferent de `ws.model`; fă explicit experimentul/modelul activ. Terenul vizual poate rămâne real, însă concluziile nu se contrazic.
- `goSunrise` caută primul eșantion viitor cu Soarele vizibil, nu un răsărit exact. Calculează disponibilitatea înainte de clic și formulează precis rezultatul, inclusiv lipsa datelor.
- `recommend.ts` exclude scenariile începute mai devreme decât `readyFromMs`. Păstrează partea utilizabilă a unei ferestre deja deschise; actualizează și testul care cere actualmente excluderea.
- Auditează efectele de încărcare, erorile și timpul de răspuns al proxy-ului. Nu lăsa „Se încarcă…” fără ieșire, nu ascunde prin refresh automat și nu masca un Bundle invalid cu fixtures fără explicație.
- Verifică actualizarea timpului/valorilor, unghiurile circulare, lipsa datelor și selectarea sitului. Unele probleme din capturi pot fi deja reparate: nu le recrea.
- Dacă se reproduce fâșia de teren îndepărtat plutitor, verifică originile, unitățile, datum-ul, curbura, no-data și cusăturile close/near/far. Fără relief fabricat care ascunde eroarea.

## H. Onestitate și limite

- Un singur timp de analiză, separat de modul istoric/replay. Fără extrapolare dincolo de coverage sau transformarea valorilor necunoscute în zero.
- Pentru comparații la date diferite, afișează A UTC și B UTC și explică sincronizarea pe timp scurs. Suprafața spune cărui scenariu îi aparține.
- Vizibilitatea Soare/Pământ se calculează cu aceeași regulă și aceleași date ca în explicație. Intersectează intervalele corpurilor separat; păstrează necunoscutul și evenimentele aproximative.
- Recomandare: „cea mai potrivită variantă dintre cele analizate pentru această activitate”. Regula: încape durata, apoi cel mai devreme UTC; la egalitate, interval utilizabil mai lung. Nu „cel mai sigur sit”.
- Vederea Pământului nu garantează RF; Soarele vizibil nu garantează energia sau siguranța termică. Nu genera scoruri de aterizare/temperatură fără model.
- AI, sursele și limitările rămân declarate corect în locuri accesibile și export. Nu ascunde informația de jurizare pentru a părea lucru manual.
- Fiecare loc are un text scurt, coordonate și sursă reală. Denumirea geografică nu este automat punct de aterizare aprobat.

## I. Active, performanță și suprafață

Inventarul actual: Luna circa 81,5 MB zecimali; roci circa 1,63 MB. Plăcile Apollo 15 high însumează circa 10,5 MB, low 2,6 MB; Apollo 17 high circa 16,8 MB, low 3,8 MB. Sunt fișiere, nu trafic HTTP sau memorie GPU măsurate.

Rocile și terenurile folosesc deja Meshopt; păstrează decodorul. Nu recomanda generic „comprimă tot cu Meshopt” fără inspecție. Globul are alt profil; începe cu textura/sfera lightweight existentă și încarcă high detail numai dacă aduce beneficii la distanța de vizualizare.

Nu schimba un asset care funcționează doar ca să adaugi „calitate”. Optimizează traseul: overview rapid → sit selectat → terenul acelui sit. Cache și eliberarea resurselor trebuie să fie compatibile; nu distruge materiale/texturi comune încă folosite.

`tools/terrain` există și are README/metadate. Nu regenera și nu descărca date mari pentru o rafinare UI. Păstrează terenul analitic separat de mesh-ul decorativ și orice simplificare vizuală.

## J. Referințe — folosește principii, nu stiluri copiate

NASA Eyes https://eyes.nasa.gov/apps/solar-system/ — context și timp.
NASA CMS https://celestial.arc.nasa.gov/ — sit și suprafață.
Lunar Planner https://www.its.ohio.edu/foundations/lunar/docs.html — orizont și ceas comun.
Moon Trek https://trek.nasa.gov/moon/ și QuickMap https://quickmap.lroc.asu.edu/ — geografie și surse.
GenLab https://genlab.studio/lunar-sim/ — feedback, indicii și retry.
Apollo 17 https://apolloinrealtime.org/17/ — context istoric.
ESA Apollo 15 https://www.esa.int/ESA_Multimedia/Videos/2020/04/Apollo_15_landing_site_in_VR — compoziție la sol, nu asset GLB liber.
NASA lesson https://science.nasa.gov/wp-content/uploads/2024/01/exploring-the-moon-teachers-guide.pdf — alegere justificată, pagina tipărită 83.

Surse de păstrat în credite: Horizons/NAIF unde folosite; LROC/PGDA pentru teren; Solar System Scope CC BY 4.0; Poly Haven conform activelor; fonturi și biblioteci. Nu copia media/cod fără permisiuni. Pentru extensie polară: PGDA 78/90/104 numai cu date compatibile; nu pune un marker polar cu teren Apollo. Termină lecția actuală înainte de a mări catalogul.

## K. Cum lucrezi — fără să mă întrebi din nou ce vreau

Direcția este deja aleasă. Inspectează starea actuală, arată pe scurt diagnosticul și începe implementarea în frontend; nu te opri după o propunere sau o machetă statică. Cere clarificare numai pentru un blocaj real, continuând munca independentă.

1. **Bază:** citește auditul și sursa actuală. Dependențele lipseau la audit: instalează local în frontend din lockfile dacă mediul permite. Folosește serverul corect dacă rulează deja. Capturează starea desktop/mobil dacă ai browser; declară limitele verificării.
2. **Direcție vizuală:** scrie o fișă scurtă de design în frontend: compoziție, tokenuri, ierarhie, ce elimini, un wireframe. Apoi implementează, nu aștepta aprobări repetate pentru decizii reversibile deja autorizate.
3. **Prima perspectivă completă:** rafinează Lună — navigație, scenă, inspector, timeline, selecție și loading. Folosește-o pentru a verifica noul sistem. Nu trimite o pagină statică și nu lăsa butoane false.
4. **Consecvență:** aplică aceeași gramatică la Sistem și Suprafață, adaptată scopului lor. Repară problemele de stare/corectitudine înainte să folosești rezultatele în lecție.
5. **Lecția:** concluzie, „De ce?”, ajutor, experiment, Elev/Planificator și o mini-misiune completă. Refolosește calculele existente, cu testele afectate actualizate.
6. **Finisare:** mobile, tastatură, WebGL fallback, reduced motion, încărcare cold/cache, refresh/deep links, export și verificări.

După fiecare brick păstrează o aplicație utilizabilă și notează ce ai verificat în `frontend/PROGRESS.md`. Nu marchezi o funcție gata numai pentru că există componenta. Nu modifica backendul pentru a debloca UI-ul; arată starea corectă și raportează dependența.

## L. Criterii de acceptare

- Pagina are o compoziție clară la 1440×900 și 1366×768, nu carduri egale repetate. La 375 px și 200% zoom nu există overflow general sau controale acoperite.
- Nicio funcție principală nu cere un dropdown, modal sau replay obligatoriu. Un inspector detaliat poate fi extins, dar concluzia rămâne vizibilă.
- Stările selectat/hover/focus/disabled/loading/error sunt consecvente. Țintele touch sunt utilizabile; controalele fine desktop au zonă de apăsare suficientă. Graficele și canvasul au alternative accesibile.
- Fără animație de puls pe acțiunea principală; mișcarea explică o tranziție sau schimbare de stare. Respectă reduced motion și nu autoplay timpul.
- Studentul poate explica o alegere după mini-misiune. Dacă testele cu trei persoane nu se pot face, livrează fișa și marchează-le neefectuate, fără rezultate inventate.
- Pentru „mai ușor decât X”, compară sarcini și date echivalente. Nu pretinde superioritate sau autorat uman din impresie.
- Brandingul/textele nu afirmă afiliere NASA. Proveniența și disclosure-ul AI sunt corecte și ușor de găsit.

Verifică din frontend, cu comenzile efective ale proiectului:

```powershell
npm.cmd test
npx.cmd tsc --noEmit -p .
npx.cmd eslint src
npm.cmd run build
```

Pentru dev: `npm.cmd run dev`, port 3002. Gestionează doar procesele proprii; evită ca dev/build să corupă ieșirile comune. Nu ascunde erorile cu disable-uri globale sau ștergerea testelor.

La final raportează: schimbările de design cu motiv, fișierele modificate, ce a rămas funcțional, capturi desktop/mobil dacă efectuate, verificări reale, dimensiuni/performanță măsurate și limite. Niciun rezultat presupus sau „arată premium” fără dovezi concrete.

**Rezultatul dorit:** Sinavigator să arate ca un atlas lunar conceput pentru această lecție, cu execuție atentă în fiecare detaliu. Scena impresionează, informația este clară, iar produsul își câștigă credibilitatea prin ce face și poate demonstra.

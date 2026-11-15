# Fișă de design — Sinavigator, atlas lunar

Data: 15 noiembrie 2026. Direcție aleasă în `PROMPT_IMPLEMENTARE.md`; aici sunt deciziile concrete.

## Idee

O planșă de atlas care se poate folosi: scena (globul, sistemul, terenul) ocupă centrul; o coloană
editorială din dreapta spune unde suntem, ce date avem și ce rezultă; navigația din stânga este un
cuprins, nu un meniu de dashboard. Gramatica vizuală vine din cartografie: linii de 1 px, etichete
cu linie de reper, coordonate în mono, scări și puncte cardinale scrise la fel peste tot.

## Compoziție

```text
1440 px
┌──────────┬─────────────────────────────────────────┬──────────────┐
│ 184 px   │ H1 perspectivă · loc · UTC   Elev|Plan. │              │
│ cuprins  ├─────────────────────────────────────────┤ 328 px       │
│          │                                         │ inspector:   │
│ Sistem   │            scenă (WebGL)                │ unde suntem  │
│ Lună     │     legenda / sursa stratului jos       │ concluzia    │
│ Suprafață│                                         │ acțiunea     │
│          ├─────────────────────────────────────────┤ date (inline)│
│ Locuri   │ timeline: benzi Soare+Pământ, evenimente│              │
│ A15  A17 ├─────────────────────────────────────────┴──────────────┤
│          │ Misiunea (Elev) / Analiză detaliată (Planificator)      │
│ Despre   │                                                         │
└──────────┴─────────────────────────────────────────────────────────┘
```

- Sub 1100 px inspectorul trece sub scenă; sub 768 px navigația devine o bandă textuală.
- O singură identitate: H1 este numele perspectivei/locului; scena nu mai are titlu propriu, iar
  inspectorul începe direct cu conținut.

## Tokenuri

| rol | valoare | folosire |
|---|---|---|
| `--bg` | `#0b0e12` | fundal |
| `--surface` / `--surface-2` | `#11161c` / `#171e26` | coloane, câmpuri |
| `--rule` / `--rule-2` | `#222b35` / `#333f4c` | separatoare, borduri |
| `--text` / `--muted` / `--faint` | `#eef1ec` / `#a2adb8` / `#7d8996` | alb cald, text secundar |
| `--accent` | `#d8f479` | selecția principală și o singură acțiune dominantă |
| `--sun` / `--earth` | `#f2c14e` / `#7ab8f5` | doar pentru corpurile cerești |
| `--ok` / `--bad` | `#7fd1a6` / `#ff8a7a` | verdicte, mereu cu simbol și text |
| raze | 4 px panouri/butoane, 999 px numai pentru stări (pastile) | |

Tipografie: Space Grotesk pentru text (H1 30 px, H2 18 px, corp 15 px), JetBrains Mono numai pentru
UTC, coordonate, unghiuri și valori. Etichetele mici (12 px, majuscule) doar pentru metadate.

## Ce am eliminat

- Butonul cu puls (`.glow`), hover care ridică butoanele, glassmorphism, animațiile de intrare pe
  fiecare bloc, sertarul de 90vh pentru comparație, titlul repetat de trei ori.
- Stilurile istorice nefolosite din `globals.css` (aplicația fullscreen, topbar, hero, drawer,
  stage/persp): fișierul a fost rescris o dată, ca un singur sistem.
- Intrarea obligatorie prin „transfer orbital”: acum este un replay opțional, etichetat ca estimare.
- Încărcarea automată a modelului lunar de 81,5 MB: globul pornește cu harta ușoară; relieful
  detaliat se încarcă la cerere, cu dimensiunea afișată.

## Sistem: tablou

Soare (stânga, parțial în cadru) – Pământ (centru) – Lună (pe orbita ei, la elongația calculată). Compoziție de manual, schematică și etichetată ca atare; Luna este singura țintă interactivă a scenei.

## Interacțiuni cu motiv

- Clic pe un marker = selectează locul (inspector + timeline); intrarea pe suprafață e un buton.
- Timeline-ul arată benzile reale (ambele / doar Soare / doar Pământ / niciunul / necunoscut) și
  evenimentele calculate (≈ răsărit/apus); evenimentele sunt butoane.
- Mișcarea există doar pentru zborurile de cameră care leagă perspectivele (Sistem → Lună → sol și înapoi), cu benzi de cadru și estompare; `prefers-reduced-motion`
  le scurtează la zero.

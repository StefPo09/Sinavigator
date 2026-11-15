# Generarea terenului 3D (Apollo 15, Apollo 17)

Scripturile care produc `public/3d-models/terrain/<loc>/*.glb` din date publice NASA LROC.
Nu fac parte din aplicație; rulează offline, doar când vrei să regenerezi terenul.

| Script | Rol |
|---|---|
| `ortho_build.py` | Citește de la distanță (GDAL `/vsicurl`) o fereastră din ortofoto NAC, la rezoluție nativă, și salvează `ortho_<px>.jpg` + `ortho.json` |
| `glb_build.py` | Din DTM-uri (fișiere locale) construiește plăcile close / near / far ca GLB brute, cu curbura Lunii și (opțional) imaginea NAC regională |
| `which.py` | Verifică ce DTM / ortofoto conține un punct (lat, lon) și ce dimensiuni are |
| `glbinfo.py` | Rezumatul unui fișier GLB (noduri, mesh-uri, texturi) |
| `ph_dl.py` | Descarcă modele/texturi Poly Haven (CC0) prin API-ul public (rocile și solul lunar) |

## Pregătire (o singură dată)

Folosește un mediu virtual separat, ca să nu modifici Python-ul global:

```bash
python -m venv .venv-terrain
```

```bash
.venv-terrain/Scripts/python -m pip install -r requirements.txt
```

Pentru compresie: `gltfpack` (meshoptimizer), de exemplu într-un folder de lucru:

```bash
npm install gltfpack@0.24.0
```

## Date sursă (LROC, NASA/GSFC/ASU, domeniu public)

Bază URL: `https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/`

| Loc | DTM apropiat (2 m) | DTM regional (5 m) | Ortofoto close/near | Ortofoto regional |
|---|---|---|---|---|
| Apollo 17 (20,1911° N, 30,7723° E) | `DATA/SDP/NAC_DTM/APOLLO17_1/NAC_DTM_APOLLO17_1.TIF` | `DATA/SDP/NAC_DTM/APOLLO17/NAC_DTM_APOLLO17.TIF` | `EXTRAS/BROWSE/NAC_DTM/APOLLO17_1/NAC_DTM_APOLLO17_1_M134991788_60CM.PYR.TIF` | `EXTRAS/BROWSE/NAC_DTM/APOLLO17/NAC_DTM_APOLLO17_MOSAIC_5M.TIF` |
| Apollo 15 (26,13239° N, 3,6333° E) | `DATA/SDP/NAC_DTM/APOLLO15/NAC_DTM_APOLLO15.TIF` | `DATA/SDP/NAC_DTM/APOLLO15_2/NAC_DTM_APOLLO15_2.TIF` | `EXTRAS/BROWSE/NAC_DTM/APOLLO15/NAC_DTM_APOLLO15_M111571816_50CM.PYR.TIF` | `EXTRAS/BROWSE/NAC_DTM/APOLLO15_2/NAC_DTM_APOLLO15_2_M1121209902_120CM.TIF` |

DTM-urile și ortofotourile regionale se descarcă întregi (100–550 MB fiecare), cu o singură cerere
(serverul LROC limitează multe cereri mici, HTTP 429). Exemplu, cu reluare automată:

```bash
curl -L -C - --speed-limit 50000 --speed-time 30 -o NAC_DTM_APOLLO15.TIF https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/SDP/NAC_DTM/APOLLO15/NAC_DTM_APOLLO15.TIF
```

Datele brute (~1,5 GB) NU intră în repo.

## Pași pentru un loc (exemplu: Apollo 17, folder de lucru `work/apollo17`)

1. Ortofoto pentru placa „near” (±2,4 km) și placa „close” (±620 m), citite de la distanță:

```bash
python ortho_build.py work/apollo17 20.1911 30.7723 2400 EXTRAS/BROWSE/NAC_DTM/APOLLO17_1/NAC_DTM_APOLLO17_1_M134991788_60CM.PYR.TIF 4096 2048
```

```bash
python ortho_build.py work/apollo17/close 20.1911 30.7723 620 EXTRAS/BROWSE/NAC_DTM/APOLLO17_1/NAC_DTM_APOLLO17_1_M134991788_60CM.PYR.TIF 2048 1024
```

2. Plăcile GLB brute (DTM-uri descărcate în `raw/`):

```bash
python glb_build.py work/apollo17 20.1911 30.7723 raw/NAC_DTM_APOLLO17_1.TIF 2400 2 raw/NAC_DTM_APOLLO17.TIF 16000 16000 12 raw/NAC_DTM_APOLLO17_MOSAIC_5M.TIF
```

   Pentru Apollo 15 s-au folosit: near ±2400 m pas 2 m; far 7500 × 15000 m pas 10 m;
   close ±520 m (ortofoto 0,5 m/px).

3. Simplificare cu limită de eroare + compresie meshopt (`-se` = eroare relativă la extinderea plăcii):

```bash
npx gltfpack -i work/apollo17/close_raw_2048.glb -o close-high.glb -si 0.02 -se 0.0001 -cc -kn
```

```bash
npx gltfpack -i work/apollo17/close_raw_1024.glb -o close-low.glb -si 0.02 -se 0.0005 -cc -kn
```

```bash
npx gltfpack -i work/apollo17/near_raw_4096.glb -o near-high.glb -si 0.01 -se 0.0001 -cc -kn
```

```bash
npx gltfpack -i work/apollo17/near_raw_2048.glb -o near-low.glb -si 0.01 -se 0.0005 -cc -kn
```

```bash
npx gltfpack -i work/apollo17/far_raw_4096.glb -o far-high.glb -si 0.01 -se 0.00004 -cc -kn
```

```bash
npx gltfpack -i work/apollo17/far_raw_2048.glb -o far-low.glb -si 0.01 -se 0.00025 -cc -kn
```

4. Copiază cele 6 fișiere `.glb` și `work/apollo17/build.json` în `public/3d-models/terrain/apollo17/`.

## Datele pentru comparația Apollo 17 / Apollo 15

`node tools/terrain/build-apollo-comparison.mjs` regenerează `public/data/bundle.json`
din răspunsurile publice JPL Horizons și plăcile locale LROC. Rulează din rădăcina
frontendului, cu Node.js (suport TypeScript nativ) și curl. Setul conține trei
starturi UTC comune, cu câte 72 h și eșantioane la 10 minute. Profilul de teren
folosește vârfurile modelelor GLB în raza de 5 km și un observator la 2 m.

## Rocile (Blender)

`rocks.glb`: rocile `moon_rock_01`…`07` din Poly Haven (colecția „Moon”, CC0), descărcate cu
`python ph_dl.py work/ph model:moon_rock_01:2k …`, importate în Blender 5.2, reduse la ~2 500 de fețe,
normalizate la 1 m, cu texturi 1024 px, exportate GLB (JPEG 85) și comprimate cu `gltfpack -cc -kn -km`.

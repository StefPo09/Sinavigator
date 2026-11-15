# Modele 3D

Next.js servește fișierele din `public/` direct (`public/3d-models/x.glb` → `/3d-models/x.glb`).

| Fișier | Unde apare | Note |
|---|---|---|
| `moon.glb` | „Zone de aterizare”: globul lunar | Copie a `Moon_NASA_LRO_8k_Topo_Small.glb` (export Blender; 2 M vârfuri, textură JPEG 8k, ~78 MB). Polul sud pe −Y, longitudinea 0° pe +X, 90° E pe −Z; raza medie 0,983 (scalată la 1). Relieful modelului este exagerat (~2,5×). Nu se încarcă pe „Grafică: Redusă”. Sub limita GitHub de 100 MB/fișier, dar peste pragul de avertizare de 50 MB. |
| `terrain/apollo17/*`, `terrain/apollo15/*` | „Suprafață”, pentru locurile de aterizare | Teren 3D real generat din date LROC (vezi mai jos). |
| `lander.glb` | „Suprafață”, puncte de studiu | Opțional; lipsește momentan. |

## Teren 3D real (Apollo 17, Apollo 15)

Fiecare loc are trei plăci, centrate pe modulul lunar (x = est, y = sus, z = sud, metri; include curbura Lunii):

| Fișier | Conținut |
|---|---|
| `close-high.glb` / `close-low.glb` | ~1 × 1 km: relief DTM 2 m + ortofoto NAC la rezoluție nativă (0,5–0,6 m/px; 2048 / 1024 px) |
| `near-high.glb` / `near-low.glb` | ~4,8 km: relief DTM 2 m (eroare geometrică ≤ 0,5 m / 2,5 m) + ortofoto NAC (4096 / 2048 px) |
| `far.glb` | Relief regional DTM 5 m (zeci de km: masivele Taurus–Littrow, Munții Apenini); zonele fără date sunt lăsate goale |
| `build.json` | Produsele sursă, rezoluții, extinderi |

Surse (NASA/GSFC/Arizona State University, LROC; domeniu public):

- Apollo 17: `NAC_DTM_APOLLO17_1` (2 m), `NAC_DTM_APOLLO17` (5 m), ortofoto `NAC_DTM_APOLLO17_1_M134991788_60CM`.
- Apollo 15: `NAC_DTM_APOLLO15` (2 m), `NAC_DTM_APOLLO15_2` (5 m), ortofoto `NAC_DTM_APOLLO15_M111571816_50CM`.

Fișierele GLB sunt comprimate cu meshopt (`gltfpack -cc`), simplificate cu limită de eroare; aplicația le decodează cu `MeshoptDecoder` din three.js.

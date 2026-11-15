# Sinavigator frontend

The frontend uses Next.js App Router. From this directory, install dependencies
and start the development server:

```bash
npm ci
npm run dev
```

Open [http://localhost:3002](http://localhost:3002). For production, run
`npm run build` followed by `npm run start`.

The workspace gets the generated data bundle through `/api/bundle`, which
proxies to the Python backend at `http://127.0.0.1:8000`. Start the backend
alongside Next.js for API-backed data; the frontend retains a static bundle
fallback for deployments that have not enabled the API yet.

The lunar globe and Apollo landing-surface lighting, along with selected-site
sky readings, follow the bundle's 10-minute Sun/Earth azimuth and elevation
samples from NASA/JPL Horizons DE441. The selected UTC time is interpolated
between samples; no positions are extrapolated beyond the bundle's coverage
(currently Nov 27–Dec 3, 2026). Surface visibility uses the LROC NAC DTM
horizon profile. Terrain provenance and source links are included in the bundle.

## Source structure

- `src/app/` contains the Next.js route entry points, root layout, metadata,
  global styles, and route redirects. The main workspace uses `?p=sistem`,
  `?p=zone`, and `?p=suprafata` to select its three in-page perspectives.
- `src/app-pages/` contains the composed perspective screens.
- `src/components/` contains reusable UI grouped by feature; `shared/` holds
  cross-feature workspace elements and shared state types.
- `src/lib/` contains data loading, shared types, and reusable domain logic.
- `public/` is at the frontend root, as expected by Next.js, and stores the
  static data, textures, and 3D models.

Routing uses the existing Next.js App Router and shared workspace state; no
additional client router is needed. The Python backend is a separate service,
so no duplicate Next.js API handlers are added.

## Learning and presentation tools

The workspace header switches between **Elev** (the guided mission) and
**Planificator** (the detailed scenario comparison). The quiz and tutorial use
the same loaded bundle and analysis rules as the main workspace. The tutorial
opens on a first visit and can be reopened from the header; append `?tour=0` to
skip its automatic launch.

**Pregătește prezentarea** preloads lunar relief, both sites' terrain, rocks,
and sky/planet textures. This is optional and downloads the 81.5 MB lunar model
in addition to the selected terrain assets.

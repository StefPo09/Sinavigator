# Sinavigator frontend

The frontend uses Next.js App Router. From this directory, install dependencies
and start the development server:

```bash
npm ci
npm run dev
```

Open [http://localhost:3002](http://localhost:3002). For production, run
`npm run build` followed by `npm run start`.

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

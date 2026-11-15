'use client';

// The selected landing site on the LRO WAC global mosaic, streamed from NASA Moon Trek (WMTS),
// with links out to Moon Trek and LROC QuickMap for deeper exploration.
import { useState } from 'react';
import { fmtLat, fmtLon } from './SiteInspector';

const TILE = 256;
const WMTS = 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm';
const KM_PER_DEG = (1737.4 * Math.PI) / 180;
/** Map frame in CSS pixels; the tile grid is laid out around its centre. */
const W = 360;
const H = 200;

const ZOOMS = { region: 6, site: 8 } as const;
type Zoom = keyof typeof ZOOMS;

function niceKm(maxKm: number) {
  for (const v of [100, 50, 20, 10, 5, 2, 1]) if (v <= maxKm) return v;
  return 1;
}

export function TrekSiteMap({ name, latDeg, lonDeg }: { name: string; latDeg: number; lonDeg: number }) {
  const [zoom, setZoom] = useState<Zoom>('site');
  const [copied, setCopied] = useState(false);
  const z = ZOOMS[zoom];
  const cols = 2 ** (z + 1);
  const rows = 2 ** z;
  // equirectangular grid: 2 × 1 tiles at level 0, doubling each level
  const cx = ((lonDeg + 180) / 360) * cols * TILE;
  const cy = ((90 - latDeg) / 180) * rows * TILE;
  const tiles: { r: number; c: number }[] = [];
  for (let r = Math.floor((cy - H / 2) / TILE); r <= Math.floor((cy + H / 2) / TILE); r++)
    for (let c = Math.floor((cx - W / 2) / TILE); c <= Math.floor((cx + W / 2) / TILE); c++)
      if (r >= 0 && r < rows) tiles.push({ r, c: ((c % cols) + cols) % cols });
  const kmPerPx = (360 / (cols * TILE)) * KM_PER_DEG * Math.cos((latDeg * Math.PI) / 180);
  const barKm = niceKm(kmPerPx * W * 0.35);
  const coords = `${latDeg.toFixed(4)}, ${lonDeg.toFixed(4)}`;

  const copy = () => {
    void navigator.clipboard
      ?.writeText(coords)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => undefined);
  };

  return (
    <div className="trek-map">
      <div className="insp-row">
        <h2 className="insp-h">Map · NASA Moon Trek</h2>
        <div className="seg" role="group" aria-label="Map scale">
          {(Object.keys(ZOOMS) as Zoom[]).map((k) => (
            <button key={k} type="button" className={zoom === k ? 'on' : ''} aria-pressed={zoom === k} onClick={() => setZoom(k)}>
              {k === 'site' ? 'Site' : 'Region'}
            </button>
          ))}
        </div>
      </div>
      <div className="trek-frame" role="img" aria-label={`LRO WAC mosaic around ${name}, ${fmtLat(latDeg)}, ${fmtLon(lonDeg)}; north is up.`}>
        {tiles.map(({ r, c }) => {
          // place by the unwrapped column so tiles stay contiguous across the 180° seam
          const unwrapped = c + Math.round((cx / TILE - c) / cols) * cols;
          return (
            // external WMTS tiles: next/image would re-host them, which the tile service does not need
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${z}-${r}-${c}`}
              src={`${WMTS}/${z}/${r}/${c}.jpg`}
              alt=""
              width={TILE}
              height={TILE}
              loading="lazy"
              decoding="async"
              style={{ left: `calc(50% + ${unwrapped * TILE - cx}px)`, top: `calc(50% + ${r * TILE - cy}px)` }}
            />
          );
        })}
        <span className="trek-pin" aria-hidden="true" />
        <span className="trek-north" aria-hidden="true">
          N ↑
        </span>
        <span className="trek-scale" aria-hidden="true" style={{ width: `${barKm / kmPerPx}px` }}>
          {barKm} km
        </span>
      </div>
      <p className="muted small">
        LRO WAC global mosaic (≈ 100 m/px), streamed from the NASA Moon Trek WMTS service. Equirectangular, north up; the marker is the {name} landing site.
      </p>
      <div className="trek-links">
        <a className="text-link" href="https://trek.nasa.gov/moon/" target="_blank" rel="noreferrer">
          Open NASA Moon Trek ↗
        </a>
        <a className="text-link" href="https://quickmap.lroc.asu.edu/" target="_blank" rel="noreferrer">
          Open LROC QuickMap ↗
        </a>
        <button type="button" className="btn quiet small-btn" onClick={copy} title="Paste into the search box of Moon Trek or QuickMap">
          {copied ? 'Copied' : `Copy ${coords}`}
        </button>
      </div>
    </div>
  );
}

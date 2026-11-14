'use client';

import { QUALITY_LABEL } from '@/lib/data/landingSites';
import { approxLocalSky, LOCAL_SKY_LABEL } from '@/lib/logic/ephemeris';
import { fmtUtcMs } from '@/lib/logic/format';
import type { WS } from '../shared/types';

const fmtLat = (v: number) => `${Math.abs(v).toFixed(4)}° ${v < 0 ? 'S' : 'N'}`;
const fmtLon = (v: number) => `${Math.abs(v).toFixed(4)}° ${v < 0 ? 'V' : 'E'}`;

/** Panoul unui loc real de aterizare: identitate, sursă, teren disponibil, cer aproximativ. */
export function LandingPanel({ ws }: { ws: WS }) {
  const l = ws.landing!;
  const sky = approxLocalSky(ws.timeMs, l.latDeg, l.lonDeg);
  return (
    <div className="zone-panel">
      <header className="zp-h">
        <p className="k">Loc de aterizare</p>
        <h2>{l.mission}</h2>
        <p className="small">
          {l.agency} · aterizare: <span className="mono">{fmtUtcMs(Date.parse(l.landingUtc))}</span>
        </p>
        <p className="mono small">
          {fmtLat(l.latDeg)}, {fmtLon(l.lonDeg)}
        </p>
        <p className="small">{l.blurb}</p>
        <p className="small muted">
          Sursa coordonatelor: {l.source} ({QUALITY_LABEL[l.quality]}).
        </p>
      </header>

      <p className={l.terrain ? 'zp-verdict v-fits' : 'zp-verdict v-insufficient'}>
        {l.terrain ? (
          <>
            <b>Model 3D de teren real.</b> Relief LROC NAC DTM (2 m/px lângă modul, 5 m/px regional, zeci de km) cu imaginea NAC a solului, la scară reală.
          </>
        ) : (
          <>
            <b>Fără teren real procesat.</b> Suprafața va fi procedurală (ilustrativă); doar poziția este reală.
          </>
        )}
      </p>

      <div className="zp-summary">
        <p className="zp-time">
          <span className="k">Cer aproximativ la data analizată</span> <b className="mono">{fmtUtcMs(ws.timeMs)}</b>
        </p>
        <ul className="zp-events">
          <li>
            <span className="k">Soarele</span> elevație ≈ {sky.sun.elDeg.toFixed(0)}°, azimut ≈ {sky.sun.azDeg.toFixed(0)}° {sky.sun.elDeg > 0 ? '(zi)' : '(noapte)'}
          </li>
          <li>
            <span className="k">Pământul</span> elevație ≈ {sky.earth.elDeg.toFixed(0)}°, azimut ≈ {sky.earth.azDeg.toFixed(0)}° {sky.earth.elDeg > 0 ? '' : '(sub orizont — fața ascunsă)'}
          </li>
        </ul>
        <p className="muted small">{LOCAL_SKY_LABEL}</p>
      </div>

      <button type="button" className="btn primary wide" onClick={() => ws.go('suprafata')}>
        Explorează suprafața
      </button>
    </div>
  );
}

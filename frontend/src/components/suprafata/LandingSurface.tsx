'use client';

// Suprafața unui loc REAL de aterizare: model 3D de teren (LROC NAC DTM + ortofoto NAC), cer aproximativ.
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { approxLocalSky, LOCAL_SKY_LABEL } from '@/lib/logic/ephemeris';
import { fmtUtcMs } from '@/lib/logic/format';
import { StatePill } from '../shared/common';
import { TimeBar } from '../shared/TimeBar';
import { webglAvailable } from '../shared/three-utils';
import type { WS } from '../shared/types';
import type { SkyState, SurfaceHandle } from './SurfaceScene';
import { loadSiteTerrain, type SiteTerrain } from './siteTerrain';
import { useTextPresentation, type SurfacePresentation } from './surfacePresentation';

const SurfaceScene = dynamic(() => import('./SurfaceScene'), {
  ssr: false,
  loading: () => <div className="s3-loading">Se încarcă suprafața…</div>,
});

const CARD = ['N', 'NE', 'E', 'SE', 'S', 'SV', 'V', 'NV'];
const cardinal = (az: number) => CARD[Math.round(az / 45) % 8];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const H = 3_600_000;

type Load = { s: 'loading' } | { s: 'ready'; t: SiteTerrain } | { s: 'none' } | { s: 'error' };

export function LandingSurface({ ws, initialText, onPresented }: { ws: WS } & SurfacePresentation) {
  const l = ws.landing!;
  const [gl, setGl] = useState<boolean | null>(() => (typeof window === 'undefined' ? null : webglAvailable()));
  const [mode, setMode] = useState<'3d' | '2d'>(() => (initialText || gl === false ? '2d' : '3d'));
  useTextPresentation(mode === '2d' || gl === false, onPresented);
  const [heading, setHeading] = useState({ az: 0, pitch: 8 });
  const [load, setLoad] = useState<Load>({ s: 'loading' });
  // momentul: ora reală a aterizării (+ ore) sau data analizată din bara temporală globală
  const [clock, setClock] = useState<'landing' | 'global'>('landing');
  // implicit: prima oră după aterizare cu Soarele la ~25° (umbre lizibile, ca în fotografiile din misiune)
  const [afterH, setAfterH] = useState(() => {
    const t0 = Date.parse(l.landingUtc);
    for (let h = 0; h <= 240; h++) if (approxLocalSky(t0 + h * 3_600_000, l.latDeg, l.lonDeg).sun.elDeg >= 25) return h;
    return 0;
  });
  const handle = useRef<SurfaceHandle | null>(null);
  const onReady = useCallback((h: SurfaceHandle | null) => {
    handle.current = h;
  }, []);

  useEffect(() => {
    let alive = true;
    loadSiteTerrain(l.id, ws.quality)
      .then((t) => alive && setLoad(t ? { s: 'ready', t } : { s: 'none' }))
      .catch(() => alive && setLoad({ s: 'error' }));
    return () => {
      alive = false;
    };
  }, [l, ws.quality]);

  const landingMs = Date.parse(l.landingUtc);
  const timeMs = clock === 'landing' ? landingMs + afterH * H : ws.timeMs;
  const ap = approxLocalSky(timeMs, l.latDeg, l.lonDeg);
  const sky: SkyState = {
    sunAz: ap.sun.azDeg,
    sunEl: ap.sun.elDeg,
    earthAz: ap.earth.azDeg,
    earthEl: ap.earth.elDeg,
    sunState: ap.sun.elDeg > 0 ? 'vis' : 'hid',
    earthState: ap.earth.elDeg > 0 ? 'vis' : 'hid',
  };
  const real = load.s === 'ready' ? load.t : null;
  const night = ap.sun.elDeg <= 0;
  /** următorul moment (după `from`) cu Soarele la cel puțin 10° deasupra orizontului */
  const nextDay = (from: number) => {
    for (let h = 1; h <= 24 * 30; h++) if (approxLocalSky(from + h * H, l.latDeg, l.lonDeg).sun.elDeg >= 10) return from + h * H;
    return null;
  };
  const goSunrise = () => {
    const t = nextDay(timeMs);
    if (t == null) return;
    if (clock === 'landing' && t - landingMs <= 240 * H) setAfterH(Math.round((t - landingMs) / H));
    else if (clock === 'global' && t <= ws.cov.endMs) ws.seekUtc(t);
    else {
      // în afara intervalului: revino la momentul aterizării, cu Soarele sus
      setClock('landing');
      const t2 = nextDay(landingMs);
      setAfterH(t2 != null ? Math.min(240, Math.round((t2 - landingMs) / H)) : 0);
    }
  };
  const b = real?.build;

  const back = (
    <button type="button" className="btn hud-btn" onClick={() => ws.go('zone')}>
      ← Înapoi la Lună
    </button>
  );

  const terrainNote = b
    ? `Model 3D de teren real: relief LROC NAC DTM ${b.near.tif.replace('.TIF', '')} (${b.near.dtm_res_m.toFixed(0)} m/px) pe ~${((2 * b.near.half_m) / 1000).toFixed(1)} km în jurul modulului lunar, cu imaginea NAC ${b.near.ortho.product} la rezoluție nativă (${(b.close?.ortho.resolution_m ?? b.near.ortho.resolution_m).toFixed(1)} m/px) pe ~1 km în jurul tău și ~${((b.near.ortho.x1 - b.near.ortho.x0) / 4096).toFixed(1)} m/px mai departe, și relief regional ${b.far.tif.replace('.TIF', '')} (${b.far.dtm_res_m.toFixed(0)} m/px) pe ${((b.far.x[1] - b.far.x[0]) / 1000).toFixed(0)} × ${((b.far.z[1] - b.far.z[0]) / 1000).toFixed(0)} km${b.far.ortho ? `, cu imaginea NAC regională ${b.far.ortho}` : ''}. Scară reală, fără exagerare, cu curbura Lunii. Textura fină de regolit adăugată la distanță mică este ilustrativă.`
    : load.s === 'loading'
      ? 'Se încarcă modelul 3D al terenului…'
      : load.s === 'error'
        ? 'Modelul 3D al terenului nu a putut fi încărcat; se afișează teren procedural ilustrativ.'
        : 'Modelul 3D al terenului lipsește din public/3d-models/terrain; se afișează teren procedural ilustrativ.';

  const hasScene = mode === '3d' && gl && load.s !== 'loading';

  return (
    <div className="workspace-grid">
      <section className="workspace-scene" aria-label="Vedere de pe suprafață">
        <header className="scene-heading">
          <div><p className="k">Vedere de pe suprafață</p><p>{l.name}</p></div>
          {back}
        </header>
        <div className="workspace-viewport surface-view">
          {hasScene ? (
            <>
              <SurfaceScene
                sky={sky}
                profile={undefined}
                model="ideal"
                seed={hash(l.id)}
                modelUrl={null}
                onReady={onReady}
              onFirstFrame={onPresented}
                onHeading={(az, pitch) => setHeading({ az, pitch })}
                onFail={() => {
                  setGl(false);
                  setMode('2d');
                }}
                onModel={() => undefined}
                real={real}
                quality={ws.quality}
              />
              {night && (
                <div className="night-note glass" role="status">
                  <p>
                    <b>Noapte lunară</b> la acest moment: Soarele e sub orizont (≈ {ap.sun.elDeg.toFixed(0)}°). Terenul e luminat doar de lumina Pământului
                    {ap.earth.elDeg > 0 ? ', aflat sus pe cer' : ' — iar Pământul e și el sub orizont'}.
                  </p>
                  <button type="button" className="btn sm primary" onClick={goSunrise}>
                    Mergi la răsărit
                  </button>
                </div>
              )}
            </>
          ) : load.s === 'loading' && mode === '3d' && gl ? (
            <div className="s3-loading">Se încarcă modelul 3D al terenului (LROC NAC DTM)…</div>
          ) : (
            <div className="surface-2d">
              {gl === false && <p className="muted small">WebGL nu este disponibil; se afișează alternativa text.</p>}
              <p>{l.blurb}</p>
            </div>
          )}
        </div>

        <div className="scene-footer landing-clock">
          <div className="seg" role="group" aria-label="Momentul afișat">
            <button type="button" className={`chip${clock === 'landing' ? ' on' : ''}`} aria-pressed={clock === 'landing'} onClick={() => setClock('landing')}>
              Momentul aterizării
            </button>
            <button type="button" className={`chip${clock === 'global' ? ' on' : ''}`} aria-pressed={clock === 'global'} onClick={() => setClock('global')}>
              Data analizată
            </button>
          </div>
          {clock === 'landing' ? (
            <label className="after-h">
              <span className="small">
                Aterizare: <b className="mono">{fmtUtcMs(landingMs)}</b> · +{afterH} h
              </span>
              <input type="range" min={0} max={240} step={1} value={afterH} onChange={(e) => setAfterH(Number(e.target.value))} aria-label="Ore după aterizare" aria-valuetext={`${afterH} ore după aterizare, ${fmtUtcMs(timeMs)}`} />
            </label>
          ) : (
            <TimeBar cov={ws.cov} timeMs={ws.timeMs} playing={ws.playing} speed={ws.speed} onSeek={ws.seekUtc} onPlay={ws.togglePlay} onSpeed={ws.setSpeed} onNow={ws.goNow} compact />
          )}
        </div>
      </section>
      <aside className="workspace-inspector" aria-labelledby="surf-h">
        <div className="inspector-heading">
          <div>
            <p className="k">Loc selectat</p>
            <h2 id="surf-h">{l.name}</h2>
            <p className="muted small">{l.mission}</p>
            <p className="mono small muted">{fmtUtcMs(timeMs)}</p>
          </div>
          <span aria-hidden="true" className="body-dot site-dot" />
        </div>
        <h3 className="inspector-section-title">Cameră</h3>
        <div className="seg" role="group" aria-label="Mod de afișare">
          <button type="button" className={`chip${mode === '3d' ? ' on' : ''}`} aria-pressed={mode === '3d'} onClick={() => setMode('3d')} disabled={!gl}>
            3D
          </button>
          <button type="button" className={`chip${mode === '2d' ? ' on' : ''}`} aria-pressed={mode === '2d'} onClick={() => setMode('2d')}>
            2D / text
          </button>
        </div>
        {hasScene && (
          <p className="inspector-readout mono">
            Privire: {cardinal(heading.az)} {Math.round(heading.az)}° · {Math.round(heading.pitch)}°
          </p>
        )}
        <h3 className="inspector-section-title">Soare și Pământ</h3>
        <div className="sky-readout">
          <div className="hud-body">
            <StatePill state={sky.sunState} label="Soarele ≈" />
            <span className="mono small">
              el {ap.sun.elDeg.toFixed(0)}° · az {ap.sun.azDeg.toFixed(0)}°
            </span>
          </div>
          <div className="hud-body">
            <StatePill state={sky.earthState} label="Pământul ≈" />
            <span className="mono small">
              el {ap.earth.elDeg.toFixed(0)}° · az {ap.earth.azDeg.toFixed(0)}°
            </span>
          </div>
          <p className="small">Poziții aproximative pentru explorare</p>
          </div>
        {hasScene && (
          <div className="row">
            <button type="button" className="btn sm primary" onClick={() => handle.current?.lookAt(ap.sun.azDeg, ap.sun.elDeg)}>
              Privește Soarele
            </button>
            <button type="button" className="btn sm hud-btn" onClick={() => handle.current?.lookAt(ap.earth.azDeg, ap.earth.elDeg)}>
              Privește Pământul
            </button>
            <button type="button" className="btn sm hud-btn" onClick={() => handle.current?.reset()}>
              Resetează privirea
            </button>
          </div>
        )}

        <p className="surface-note small" tabIndex={0}>
          <b>{terrainNote}</b> {LOCAL_SKY_LABEL} Controale: trage pentru a roti privirea, rotița pentru zoom; din tastatură: clic pe scenă, apoi săgețile și + / −.
        </p>
      </aside>
    </div>
  );
}

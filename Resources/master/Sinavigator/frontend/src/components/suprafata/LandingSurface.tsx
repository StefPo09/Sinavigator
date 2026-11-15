'use client';

// Suprafața unui loc real de aterizare, lit from the fetched site-specific Horizons samples.
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { horizonAt } from '@/lib/logic/derive';
import { siteSkyAt } from '@/lib/logic/bundleEphemeris';
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

type Load = { s: 'loading' } | { s: 'ready'; t: SiteTerrain } | { s: 'none' } | { s: 'error' };

export function LandingSurface({ ws, initialText, onPresented }: { ws: WS } & SurfacePresentation) {
  const l = ws.landing!;
  const [gl, setGl] = useState<boolean | null>(() => (typeof window === 'undefined' ? null : webglAvailable()));
  const [mode, setMode] = useState<'3d' | '2d'>(() => (initialText || gl === false ? '2d' : '3d'));
  useTextPresentation(mode === '2d' || gl === false, onPresented);
  const [heading, setHeading] = useState({ az: 0, pitch: 8 });
  const [load, setLoad] = useState<Load>({ s: 'loading' });
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

  const timeMs = ws.timeMs;
  const sample = siteSkyAt(ws.bundle, l.id, timeMs);
  const profile = ws.profileOf(l.id);
  const visible = (azDeg: number | undefined, elDeg: number | null, threshold: number, strict: boolean): 'vis' | 'hid' | 'unk' => {
    if (azDeg == null || elDeg == null) return 'unk';
    const horizon = horizonAt(profile, azDeg, 'terrain');
    if (horizon == null) return 'unk';
    const margin = elDeg - horizon;
    return (strict ? margin > threshold : margin >= threshold) ? 'vis' : 'hid';
  };
  const sky: SkyState = {
    sunAz: sample?.sun.azDeg ?? 0,
    sunEl: sample?.sun.elDeg ?? null,
    earthAz: sample?.earth?.azDeg ?? 0,
    earthEl: sample?.earth?.elDeg ?? null,
    sunState: visible(sample?.sun.azDeg, sample?.sun.elDeg ?? null, ws.bundle.rules.sunMarginDeg, true),
    earthState: visible(sample?.earth?.azDeg, sample?.earth?.elDeg ?? null, ws.bundle.rules.earthMarginDeg, false),
  };
  const real = load.s === 'ready' ? load.t : null;
  const night = sample != null && sky.sunState === 'hid';
  const b = real?.build;
  const goSunrise = () => {
    const scenarios = ws.bundle.scenarios
      .filter((scenario) => scenario.siteId === l.id && Date.parse(scenario.startUtc) + scenario.durationH * 3_600_000 > timeMs)
      .sort((a, b) => Date.parse(a.startUtc) - Date.parse(b.startUtc));
    for (const scenario of scenarios) {
      const start = Date.parse(scenario.startUtc);
      const stepMs = scenario.stepMin * 60_000;
      const first = Math.max(0, Math.floor((timeMs - start) / stepMs) + 1);
      for (let i = first; i < scenario.sun.elDeg.length; i++) {
        const candidate = start + i * stepMs;
        const candidateSample = siteSkyAt(ws.bundle, l.id, candidate);
        const horizon = candidateSample && horizonAt(profile, candidateSample.sun.azDeg, 'terrain');
        if (candidateSample && horizon != null && candidateSample.sun.elDeg - horizon > ws.bundle.rules.sunMarginDeg) {
          ws.seekUtc(candidate);
          return;
        }
      }
    }
    ws.setNote('Nu există un eșantion viitor cu Soarele vizibil în intervalul acoperit de datele NASA/JPL Horizons.');
  };

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

  const hasScene = mode === '3d' && gl && load.s !== 'loading' && sample != null;

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
                    <b>Noapte lunară</b> la acest moment: Soarele este ascuns de orizontul local al terenului (elevație {sample.sun.elDeg.toFixed(1)}°). Pământul
                    {sky.earthState === 'vis' ? ' este deasupra orizontului local.' : ' nu este vizibil deasupra orizontului local.'}
                  </p>
                  <button type="button" className="btn sm primary" onClick={goSunrise}>
                    Mergi la următoarea lumină solară
                  </button>
                </div>
              )}
            </>
          ) : load.s === 'loading' && mode === '3d' && gl ? (
            <div className="s3-loading">Se încarcă modelul 3D al terenului (LROC NAC DTM)…</div>
          ) : !sample ? (
            <div className="fallback">
              <p><b>Datele NASA/JPL Horizons nu acoperă acest moment.</b> Alege un timp din intervalul afișat în bara temporală pentru a vizualiza iluminarea calculată.</p>
            </div>
          ) : (
            <div className="surface-2d">
              {gl === false && <p className="muted small">WebGL nu este disponibil; se afișează alternativa text.</p>}
              <p>{l.blurb}</p>
            </div>
          )}
        </div>

        <div className="scene-footer landing-clock">
          <TimeBar cov={ws.cov} timeMs={ws.timeMs} playing={ws.playing} speed={ws.speed} onSeek={ws.seekUtc} onPlay={ws.togglePlay} onSpeed={ws.setSpeed} onNow={ws.goNow} compact />
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
        {sample ? (
          <>
            <div className="sky-readout">
              <div className="hud-body">
                <StatePill state={sky.sunState} label="Soarele" />
                <span className="mono small">el {sample.sun.elDeg.toFixed(1)}° · az {sample.sun.azDeg.toFixed(1)}°</span>
              </div>
              {sample.earth && (
                <div className="hud-body">
                  <StatePill state={sky.earthState} label="Pământul" />
                  <span className="mono small">el {sample.earth.elDeg.toFixed(1)}° · az {sample.earth.azDeg.toFixed(1)}°</span>
                </div>
              )}
              <p className="small">
                Poziții interpolate din <a href={ws.bundle.layers?.geometry?.url ?? 'https://ssd.jpl.nasa.gov/horizons/'} target="_blank" rel="noreferrer">NASA/JPL Horizons (DE441)</a>; vizibilitatea folosește profilul de teren <a href={ws.bundle.layers?.terrain?.url ?? 'https://trek.nasa.gov/moon/'} target="_blank" rel="noreferrer">LROC NAC DTM</a>.
              </p>
            </div>
            {hasScene && (
              <div className="row">
                <button type="button" className="btn sm primary" onClick={() => handle.current?.lookAt(sample.sun.azDeg, sample.sun.elDeg)}>
                  Privește Soarele
                </button>
                {sample.earth && (
                  <button type="button" className="btn sm hud-btn" onClick={() => handle.current?.lookAt(sample.earth!.azDeg, sample.earth!.elDeg!)}>
                    Privește Pământul
                  </button>
                )}
                <button type="button" className="btn sm hud-btn" onClick={() => handle.current?.reset()}>
                  Resetează privirea
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="small muted">Nu sunt poziții NASA/JPL Horizons pentru acest moment.</p>
        )}

        <p className="surface-note small" tabIndex={0}>
          <b>{terrainNote}</b> Datele astronomice sunt limitate la acoperirea temporală a bundle-ului. Controale: trage pentru a roti privirea, rotița pentru zoom; din tastatură: clic pe scenă, apoi săgețile și + / −.
        </p>
      </aside>
    </div>
  );
}

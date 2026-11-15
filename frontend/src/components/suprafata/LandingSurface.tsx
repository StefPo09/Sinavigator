'use client';

// Suprafața unui loc real de aterizare. Scena arată mereu terenul real; concluziile
// (vizibil / ascuns / noapte) folosesc modelul de orizont activ, la fel ca restul atlasului.
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { horizonAt, sampleIndex, type Body, type VisState } from '@/lib/logic/derive';
import { siteSkyAt } from '@/lib/logic/bundleEphemeris';
import { fmtUtcMs } from '@/lib/logic/format';
import { angleDiff, cardinal, nextSunVisible } from '@/lib/logic/lesson';
import { SkyPanorama, type ElRange } from '../shared/SkyPanorama';
import { TimeBar } from '../shared/TimeBar';
import { webglAvailable } from '../shared/three-utils';
import type { WS } from '../shared/types';
import { BodyLine, localSky, modelLabel, ModelSwitch, SiteConclusion } from '../zone/SiteInspector';
import type { SkyState, SurfaceHandle } from './SurfaceScene';
import { loadSiteTerrain, type SiteTerrain } from './siteTerrain';

const SurfaceScene = dynamic(() => import('./SurfaceScene'), {
  ssr: false,
  loading: () => <p className="scene-loading">Preparing the ground view…</p>,
});

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
/** Jumătatea câmpului vizual folosită ca să spunem „în cadru” (camera are 60° pe verticală). */
const HALF_V = 28;
const HALF_H = 40;

type Load = { s: 'loading' } | { s: 'ready'; t: SiteTerrain } | { s: 'none' } | { s: 'error' };

export function LandingSurface({ ws, onReplay }: { ws: WS; onReplay: () => void }) {
  const l = ws.landing!;
  const [gl, setGl] = useState<boolean | null>(() => (typeof window === 'undefined' ? null : webglAvailable()));
  const [mode, setMode] = useState<'3d' | '2d'>(() => (gl === false ? '2d' : '3d'));
  const [heading, setHeading] = useState({ az: 0, pitch: -4 });
  const [load, setLoad] = useState<Load>({ s: 'loading' });
  const handle = useRef<SurfaceHandle | null>(null);
  const onReady = useCallback((h: SurfaceHandle | null) => {
    handle.current = h;
  }, []);
  const noop = useCallback(() => undefined, []);
  // coborârea de pe glob continuă în scenă o singură dată (nu la comutarea 3D/2D sau a calității)
  const [intro, setIntro] = useState(ws.prevStage === 'zone');
  const introDone = useCallback(() => setIntro(false), []);

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
  const local = localSky(ws, l.id);
  const track = ws.trackOf(l.id);

  // scena: poziții interpolate, iluminare după terenul real (vizual), indiferent de experiment
  const visualState = (azDeg: number | undefined, elDeg: number | null, threshold: number, strict: boolean): VisState => {
    if (azDeg == null || elDeg == null) return 'unk';
    const h = horizonAt(profile, azDeg, 'terrain');
    if (h == null) return 'unk';
    const m = elDeg - h;
    return (strict ? m > threshold : m >= threshold) ? 'vis' : 'hid';
  };
  const sky: SkyState = {
    sunAz: sample?.sun.azDeg ?? 0,
    sunEl: sample?.sun.elDeg ?? null,
    earthAz: sample?.earth?.azDeg ?? 0,
    earthEl: sample?.earth?.elDeg ?? null,
    sunState: visualState(sample?.sun.azDeg, sample?.sun.elDeg ?? null, ws.bundle.rules.sunMarginDeg, true),
    earthState: visualState(sample?.earth?.azDeg, sample?.earth?.elDeg ?? null, ws.bundle.rules.earthMarginDeg, false),
  };
  const real = load.s === 'ready' ? load.t : null;
  const b = real?.build;
  const night = local != null && local.sun.state === 'hid';
  const next = useMemo(() => (night ? nextSunVisible(track, timeMs) : null), [night, track, timeMs]);

  const range = useMemo<ElRange>(() => {
    let lo = 0;
    let hi = 0;
    if (local)
      for (const k of ['sun', 'earth'] as const)
        for (const v of [...local.an[k].el, ...local.an[k].hor]) {
          if (v == null) continue;
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        }
    return { min: Math.floor(lo - 1), max: Math.ceil(hi + 1) };
  }, [local?.an]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasScene = mode === '3d' && gl && load.s !== 'loading' && sample != null;
  const inFrame = (az: number | null, el: number | null) => az != null && el != null && Math.abs(angleDiff(az, heading.az)) <= HALF_H && Math.abs(el - heading.pitch) <= HALF_V;
  const look = (k: Body) => {
    const p = k === 'sun' ? sample?.sun : sample?.earth;
    if (p && p.elDeg != null) handle.current?.lookAt(p.azDeg, p.elDeg);
  };

  const terrainNote = b
    ? `LROC NAC DTM relief ${b.near.tif.replace('.TIF', '')} (${b.near.dtm_res_m.toFixed(0)} m/px) over ~${((2 * b.near.half_m) / 1000).toFixed(1)} km around the lander, with the NAC image ${b.near.ortho.product} (${(b.close?.ortho.resolution_m ?? b.near.ortho.resolution_m).toFixed(1)} m/px near you), plus regional relief ${b.far.tif.replace('.TIF', '')} (${b.far.dtm_res_m.toFixed(0)} m/px) over ${((b.far.x[1] - b.far.x[0]) / 1000).toFixed(0)} × ${((b.far.z[1] - b.far.z[0]) / 1000).toFixed(0)} km. True scale, with the Moon's curvature. The meshes are simplified; the fine regolith texture near the camera is illustrative.`
    : load.s === 'loading'
      ? 'Loading the terrain tiles (near, mid, far)…'
      : load.s === 'error'
        ? 'The terrain tiles could not be loaded; the scene uses illustrative procedural terrain.'
        : 'The terrain tiles are missing from public/3d-models/terrain; the scene uses illustrative procedural terrain.';

  return (
    <div className="atlas-grid">
      <section className="scene-frame" aria-label={`Ground view, ${l.name}`}>
        <div className="scene-view tall">
          {hasScene ? (
            <SurfaceScene
              sky={sky}
              profile={undefined}
              model="ideal"
              seed={hash(l.id)}
              modelUrl={null}
              onReady={onReady}
              onFirstFrame={introDone}
              onHeading={(az, pitch) => setHeading({ az, pitch })}
              onFail={() => {
                setGl(false);
                setMode('2d');
              }}
              onModel={noop}
              real={real}
              quality={ws.quality}
              intro={intro}
            />
          ) : load.s === 'loading' && mode === '3d' && gl ? (
            <p className="scene-loading">Loading the LROC terrain tiles for {l.name} ({ws.quality === 'high' ? 'high' : 'low'} quality)…</p>
          ) : !local ? (
            <div className="scene-fallback">
              <p>
                <b>The data does not cover this moment.</b> Pick a moment inside the timeline range.
              </p>
            </div>
          ) : (
            <div className="scene-2d">
              {gl === false && <p className="muted small">WebGL is not available; showing the horizon in 2D.</p>}
              <SkyPanorama
                a={local.an}
                profile={profile}
                model={ws.model}
                idx={sampleIndex(local.an, local.t)}
                sunState={local.sun.state}
                earthState={local.earth.state}
                range={range}
                highlight={null}
                label={`Horizon at ${l.name}, ${fmtUtcMs(timeMs)}: Sun ${local.sun.why.kind === 'visible' ? 'visible' : 'not visible'}, Earth ${local.earth.why.kind === 'visible' ? 'visible' : 'not visible'}.`}
              />
            </div>
          )}
          {hasScene && (
            <div className="scene-caption">
              <p className="mono">
                {l.name} · {fmtUtcMs(timeMs)} · looking {cardinal(heading.az)} {Math.round(heading.az)}°
              </p>
              {night && (
                <p className="night-strip" role="status">
                  <b>Night</b> ({modelLabel(ws.model)}): {local!.sun.why.kind === 'terrain' ? 'the Sun is hidden by terrain.' : 'the Sun is below the horizon.'}
                </p>
              )}
              <p className="scene-hint">Drag to look around · wheel to zoom · keyboard: click the scene, then arrows and + / −</p>
            </div>
          )}
        </div>
        <TimeBar cov={ws.cov} timeMs={ws.timeMs} playing={ws.playing} speed={ws.speed} onSeek={ws.seekUtc} onPlay={ws.togglePlay} onSpeed={ws.setSpeed} onNow={ws.goNow} nowState={ws.nowState} track={track} siteLabel={l.name} />
      </section>

      <aside className="inspector" aria-label={`Local sky at ${l.name}`}>
        <div className="insp-row">
          <button type="button" className="btn quiet" onClick={() => ws.go('zone')}>
            ← Back to the Moon
          </button>
          <div className="seg" role="group" aria-label="Display mode">
            <button type="button" className={mode === '3d' ? 'on' : ''} aria-pressed={mode === '3d'} onClick={() => setMode('3d')} disabled={!gl}>
              3D
            </button>
            <button type="button" className={mode === '2d' ? 'on' : ''} aria-pressed={mode === '2d'} onClick={() => setMode('2d')}>
              2D / text
            </button>
          </div>
        </div>

        <div className="insp-section">
          <div className="insp-row">
            <h2 className="insp-h">Local sky</h2>
            <ModelSwitch ws={ws} />
          </div>
          {local ? (
            <>
              {(['sun', 'earth'] as const).map((k) => {
                const v = local[k];
                const seen = inFrame(v.why.az, v.why.el);
                return (
                  <div key={k} className="body-block">
                    <BodyLine {...v} />
                    <p className="small muted">{v.why.text}</p>
                    {hasScene && v.why.el != null && (
                      <p className="body-frame small">
                        {seen ? 'In view.' : 'Out of view.'}{' '}
                        <button type="button" className="text-link" onClick={() => look(k)}>
                          Look {k === 'sun' ? 'at the Sun' : 'at the Earth'}
                        </button>
                      </p>
                    )}
                  </div>
                );
              })}
              {ws.model === 'ideal' && <p className="state-line warn small">Experiment on: the conclusions ignore terrain; the scene still shows the real terrain.</p>}
              {night && (
                <p className="small">
                  {next ? (
                    <>
                      First moment with the Sun visible in the data: <span className="mono">{fmtUtcMs(next.ms)}</span>
                      {next.approx ? ' (≈, interpolated between 10-min samples)' : ''}.{' '}
                      <button type="button" className="text-link" onClick={() => ws.seekUtc(next.ms)}>
                        Go there
                      </button>
                    </>
                  ) : (
                    <>The Sun does not become visible again before the end of the data ({fmtUtcMs(ws.cov.endMs)}); no sunrise can be shown.</>
                  )}
                </p>
              )}
            </>
          ) : (
            <p className="muted">No computed positions for this moment.</p>
          )}
        </div>

        <div className="insp-section">
          <h2 className="insp-h">The chosen activity here</h2>
          <SiteConclusion ws={ws} site={l} />
        </div>

        <details className="insp-more">
          <summary>What is real in the scene</summary>
          <p className="small">{terrainNote}</p>
          <p className="small">
            The Sun and Earth are placed at the azimuth and elevation interpolated from NASA/JPL Horizons (DE441); their apparent sizes are enlarged (Sun ×2, Earth ×3), and the orientation of the continents is illustrative.
            The terrain fill light is added for readability and is not a computed result. Shadows come from the relief, not the textures; the NAC images may contain shadows baked in when they were photographed.
            The rocks are illustrative.
          </p>
        </details>
        <button type="button" className="text-link" onClick={onReplay}>
          Educational replay: Earth–Moon transfer (estimate)
        </button>
      </aside>
    </div>
  );
}

'use client';

// Perspectiva 3 — vederea de la sol, la locul și momentul analizat. Intrarea este directă;
// transferul Pământ–Lună este un replay opțional.
import dynamic from 'next/dynamic';
import { useCallback, useMemo, useRef, useState } from 'react';
import { sampleIndex, segAt } from '@/lib/logic/derive';
import { fmtDeg, fmtUtcMs } from '@/lib/logic/format';
import { cardinal } from '@/lib/logic/lesson';
import { BODY_NAME, StatePill } from '../components/shared/common';
import { SkyPanorama, type ElRange } from '../components/shared/SkyPanorama';
import { TimeBar } from '../components/shared/TimeBar';
import { webglAvailable } from '../components/shared/three-utils';
import type { WS } from '../components/shared/types';
import type { SkyState, SurfaceHandle } from '../components/suprafata/SurfaceScene';
import { LandingSurface } from '../components/suprafata/LandingSurface';
import { SurfaceArrival } from '../components/suprafata/SurfaceArrival';

const SurfaceScene = dynamic(() => import('../components/suprafata/SurfaceScene'), {
  ssr: false,
  loading: () => <p className="scene-loading">Preparing the ground view…</p>,
});

/** Modelul 3D opțional exportat din Blender (GLB). Apare doar dacă fișierul există. */
export const LANDER_MODEL_URL = '/3d-models/lander.glb';
/** Pune true după ce adaugi public/3d-models/lander.glb (evită o cerere 404 la fiecare intrare). */
const LANDER_MODEL_URL_ENABLED = false;

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function SuprafataView({ ws }: { ws: WS }) {
  const [replay, setReplay] = useState(false);
  const close = useCallback(() => setReplay(false), []);
  const site = ws.landing?.name ?? ws.A?.site.short ?? 'the Moon';
  return (
    <>
      {ws.landing ? <LandingSurface key={ws.landing.id} ws={ws} onReplay={() => setReplay(true)} /> : <StudySurface ws={ws} />}
      {replay && <SurfaceArrival site={site} onClose={close} />}
    </>
  );
}

/** Suprafață procedurală pentru un loc fără teren real (de ex. un Bundle generic). */
function StudySurface({ ws }: { ws: WS }) {
  const [gl, setGl] = useState<boolean | null>(() => (typeof window === 'undefined' ? null : webglAvailable()));
  const [mode, setMode] = useState<'3d' | '2d'>(() => (gl === false ? '2d' : '3d'));
  const [heading, setHeading] = useState({ az: 0, pitch: -4 });
  const [modelStatus, setModelStatus] = useState<'none' | 'loaded' | 'error'>('none');
  const handle = useRef<SurfaceHandle | null>(null);
  const onReady = useCallback((h: SurfaceHandle | null) => {
    handle.current = h;
  }, []);
  const noop = useCallback(() => undefined, []);

  const A = ws.A;
  const t = ws.cursorA;
  const idx = A && t != null ? sampleIndex(A.an, t) : 0;
  const sky: SkyState | null =
    A && t != null
      ? {
          sunAz: A.an.sun.az[idx],
          sunEl: A.an.sun.el[idx],
          earthAz: A.an.earth.az[idx],
          earthEl: A.an.earth.el[idx],
          sunState: segAt(A.an.sun.segs, t).state,
          earthState: segAt(A.an.earth.segs, t).state,
        }
      : null;

  const range = useMemo<ElRange>(() => {
    let lo = 0;
    let hi = 0;
    if (A)
      for (const b of ['sun', 'earth'] as const)
        for (const v of [...A.an[b].el, ...A.an[b].hor]) {
          if (v == null) continue;
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        }
    return { min: Math.floor(lo - 1), max: Math.ceil(hi + 1) };
  }, [A]);

  if (!A) {
    return (
      <section className="notice">
        <p>No site with data is selected. Choose a site on the Moon page.</p>
        <button type="button" className="btn" onClick={() => ws.go('zone')}>
          ← Back to the Moon
        </button>
      </section>
    );
  }

  const end = fmtUtcMs(A.t0 + A.an.totalMin * 60_000);
  return (
    <div className="atlas-grid">
      <section className="scene-frame" aria-label={`Ground view, ${A.site.short}`}>
        <div className="scene-view tall">
          {t == null || !sky ? (
            <div className="scene-fallback">
              <p>
                <b>Not enough data for this moment.</b> The period covers {fmtUtcMs(A.t0)} → {end}; the analysed moment is outside it.
              </p>
              <button type="button" className="btn" onClick={() => ws.seekUtc(A.t0)}>
                Go to the start of the period
              </button>
            </div>
          ) : mode === '3d' && gl ? (
            <SurfaceScene
              sky={sky}
              profile={A.profile}
              model={ws.model}
              seed={hash(A.site.id)}
              modelUrl={LANDER_MODEL_URL_ENABLED ? LANDER_MODEL_URL : null}
              onReady={onReady}
              onFirstFrame={noop}
              onHeading={(az, pitch) => setHeading({ az, pitch })}
              onFail={() => setGl(false)}
              onModel={setModelStatus}
              real={null}
              quality={ws.quality}
            />
          ) : (
            <div className="scene-2d">
              <SkyPanorama a={A.an} profile={A.profile} model={ws.model} idx={idx} sunState={sky.sunState} earthState={sky.earthState} range={range} highlight={null} label={`Horizon at ${A.site.short}, ${fmtUtcMs(ws.timeMs)}`} />
            </div>
          )}
        </div>
        <TimeBar cov={ws.cov} timeMs={ws.timeMs} playing={ws.playing} speed={ws.speed} onSeek={ws.seekUtc} onPlay={ws.togglePlay} onSpeed={ws.setSpeed} onNow={ws.goNow} nowState={ws.nowState} />
      </section>
      <aside className="inspector" aria-label="Local sky">
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
        {sky && t != null && (
          <div className="insp-section">
            {mode === '3d' && gl && (
              <p className="mono small">
                Looking {cardinal(heading.az)} {Math.round(heading.az)}° · {Math.round(heading.pitch)}°
              </p>
            )}
            {(['sun', 'earth'] as const).map((k) => (
              <p key={k} className="body-row">
                <StatePill state={sky[k === 'sun' ? 'sunState' : 'earthState']} label={BODY_NAME[k]} />
                <span className="mono small">
                  El {fmtDeg(A.an[k].el[idx], 1)} · Az {fmtDeg(A.an[k].az[idx], 0)}
                </span>
              </p>
            ))}
          </div>
        )}
        <p className="muted small">
          Illustrative procedural terrain: it does not reproduce this place. {ws.model === 'terrain' && A.profile ? 'Only the distant horizon line follows the profile from the data.' : 'Ideal horizon (0°).'}
          {modelStatus === 'loaded' && ' The lander model is illustrative.'}
        </p>
      </aside>
    </div>
  );
}

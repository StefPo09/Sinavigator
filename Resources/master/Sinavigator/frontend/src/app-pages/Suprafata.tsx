'use client';

// Perspectiva 3 — Explorarea suprafeței zonei selectate, exact la zona și momentul alese.
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nextEvent, sampleIndex, segAt } from '@/lib/logic/derive';
import { countdownText } from '@/lib/logic/explain';
import { fmtDeg, fmtUtcMs } from '@/lib/logic/format';
import { BODY_NAME, StatePill } from '../components/shared/common';
import { SkyPanorama, type ElRange } from '../components/shared/SkyPanorama';
import { TimeBar } from '../components/shared/TimeBar';
import { webglAvailable } from '../components/shared/three-utils';
import type { WS } from '../components/shared/types';
import type { SkyState, SurfaceHandle } from '../components/suprafata/SurfaceScene';
import { LandingSurface } from '../components/suprafata/LandingSurface';
import { SurfaceArrival } from '../components/suprafata/SurfaceArrival';
import { useTextPresentation, type SurfacePresentation } from '../components/suprafata/surfacePresentation';

const SurfaceScene = dynamic(() => import('../components/suprafata/SurfaceScene'), {
  ssr: false,
  loading: () => <div className="s3-loading">Se încarcă suprafața…</div>,
});

/** Modelul 3D opțional exportat din Blender (GLB). Apare doar dacă fișierul există. */
export const LANDER_MODEL_URL = '/3d-models/lander.glb';
/** Pune true după ce adaugi public/3d-models/lander.glb (evită o cerere 404 la fiecare intrare). */
const LANDER_MODEL_URL_ENABLED = false;

const CARD = ['N', 'NE', 'E', 'SE', 'S', 'SV', 'V', 'NV'];
const cardinal = (az: number) => CARD[Math.round(az / 45) % 8];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function SuprafataView({ ws }: { ws: WS }) {
  const [presented, setPresented] = useState(false);
  const [showArrival, setShowArrival] = useState(true);
  const [initialText, setInitialText] = useState(false);
  const onPresented = useCallback(() => setPresented(true), []);
  const closeArrival = useCallback(() => setShowArrival(false), []);
  const site = ws.landing?.name ?? ws.A?.site.short ?? 'Lună';

  return (
    <>
      {ws.landing
        ? <LandingSurface key={`${ws.landing.id}:${initialText}`} ws={ws} initialText={initialText} onPresented={onPresented} />
        : <StudySurface key={String(initialText)} ws={ws} initialText={initialText} onPresented={onPresented} />}
      {showArrival && (
        <SurfaceArrival
          site={site}
          presented={presented}
          onComplete={closeArrival}
          onText={() => setInitialText(true)}
          onBack={() => ws.go('zone')}
        />
      )}
    </>
  );
}

function StudySurface({ ws, initialText, onPresented }: { ws: WS } & SurfacePresentation) {
  // WebGL se verifică o singură dată, în browser (perspectivele se afișează doar pe client)
  const [gl, setGl] = useState<boolean | null>(() => (typeof window === 'undefined' ? null : webglAvailable()));
  const [mode, setMode] = useState<'3d' | '2d'>(() => (initialText || gl === false ? '2d' : '3d'));
  const [vr, setVr] = useState(false);
  const [heading, setHeading] = useState({ az: 0, pitch: 8 });
  const [modelStatus, setModelStatus] = useState<'none' | 'loaded' | 'error'>('none');
  const handle = useRef<SurfaceHandle | null>(null);
  const onReady = useCallback((h: SurfaceHandle | null) => {
    handle.current = h;
  }, []);

  useEffect(() => {
    const xr = (navigator as Navigator & { xr?: { isSessionSupported: (m: string) => Promise<boolean> } }).xr;
    xr?.isSessionSupported('immersive-vr')
      .then(setVr)
      .catch(() => setVr(false));
  }, []);

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
  useTextPresentation(!sky || mode === '2d' || gl === false, onPresented);

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

  const back = (
    <button type="button" className="btn hud-btn" onClick={() => ws.go('zone')}>
      ← Înapoi la Lună
    </button>
  );

  if (!A) {
    return (
      <section className="card">
        <p className="unavail">Nu este aleasă o zonă cu date. Alege o zonă și un start în perspectiva „Zone de aterizare”.</p>
        <div className="row">{back}</div>
      </section>
    );
  }

  const end = fmtUtcMs(A.t0 + A.an.totalMin * 60_000);
  const terrainNote =
    'Teren procedural ilustrativ — nu reproduce acest loc. ' +
    (ws.model === 'terrain' && A.profile
      ? `Doar linia orizontului îndepărtat urmează profilul de orizont din date${ws.terrainSynthetic ? ' (sintetic în demo)' : ''}; sectoarele fără date rămân goale.`
      : 'Model de orizont idealizat (0°): terenul îndepărtat nu este modelat.');

  return (
    <div className="workspace-grid">
      <section className="workspace-scene" aria-label="Vedere de pe suprafață">
        <header className="scene-heading">
          <div>
            <p className="k">Vedere de pe suprafață</p>
            <p>{A.site.short}</p>
          </div>
          {back}
        </header>
        <div className="workspace-viewport surface-view">
          {t == null || !sky ? (
            <div className="fallback">
              <p>
                <b>Date insuficiente pentru acest moment.</b> Scenariul zonei acoperă {fmtUtcMs(A.t0)} → {end}; momentul analizat ({fmtUtcMs(ws.timeMs)}) este în afara lui. Pozițiile Soarelui și
                Pământului nu sunt afișate.
              </p>
              <button type="button" className="btn sm" onClick={() => ws.seekUtc(A.t0)}>
                Mergi la începutul scenariului
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
              onFirstFrame={onPresented}
              onHeading={(az, pitch) => setHeading({ az, pitch })}
              onFail={() => {
                setGl(false);
                setMode('2d');
              }}
              onModel={setModelStatus}
              real={null}
              quality={ws.quality}
            />
          ) : (
            <div className="surface-2d">
              {gl === false && <p className="muted small">WebGL nu este disponibil; se afișează alternativa 2D/text.</p>}
              <SkyPanorama
                a={A.an}
                profile={A.profile}
                model={ws.model}
                idx={idx}
                sunState={sky.sunState}
                earthState={sky.earthState}
                range={range}
                highlight={null}
                label={`Orizontul zonei ${A.site.short} la ${fmtUtcMs(ws.timeMs)}`}
              />
            </div>
          )}
        </div>
        <div className="scene-footer">
          <TimeBar cov={ws.cov} timeMs={ws.timeMs} playing={ws.playing} speed={ws.speed} onSeek={ws.seekUtc} onPlay={ws.togglePlay} onSpeed={ws.setSpeed} onNow={ws.goNow} compact />
        </div>
      </section>
      <aside className="workspace-inspector" aria-labelledby="surf-h">
        <div className="inspector-heading">
          <div>
            <p className="k">Loc selectat</p>
            <h2 id="surf-h">{A.site.name}</h2>
            <p className="muted small">{fmtUtcMs(ws.timeMs)}</p>
          </div>
          <span aria-hidden="true" className="body-dot site-dot" />
        </div>
        <h3 className="inspector-section-title">Cameră</h3>
        <div className="row">
          <div className="seg" role="group" aria-label="Mod de afișare">
            <button type="button" className={`chip${mode === '3d' ? ' on' : ''}`} aria-pressed={mode === '3d'} onClick={() => setMode('3d')} disabled={!gl}>
              3D
            </button>
            <button type="button" className={`chip${mode === '2d' ? ' on' : ''}`} aria-pressed={mode === '2d'} onClick={() => setMode('2d')}>
              2D / text
            </button>
          </div>
          {vr && mode === '3d' && (
            <button type="button" className="btn sm" onClick={() => handle.current?.enterVR().catch(() => ws.setNote('Sesiunea VR nu a putut porni.'))}>
              VR
            </button>
          )}
        </div>
        {t != null && sky && (
          <>
            {mode === '3d' && gl && (
              <p className="inspector-readout mono" aria-live="off">
                Privire: {cardinal(heading.az)} {Math.round(heading.az)}° · {Math.round(heading.pitch)}°
              </p>
            )}
            <h3 className="inspector-section-title">Soare și Pământ</h3>
            <div className="sky-readout">
              {(['sun', 'earth'] as const).map((k) => (
                <div key={k} className="hud-body">
                  <StatePill state={sky[k === 'sun' ? 'sunState' : 'earthState']} label={BODY_NAME[k]} />
                  <span className="mono small">
                    el {fmtDeg(A.an[k].el[idx], 1)} · az {fmtDeg(A.an[k].az[idx], 0)}
                  </span>
                </div>
              ))}
              <p className="small">{countdownText('both', nextEvent(A.an.segs.both, t), end)}</p>
            </div>
            {mode === '3d' && gl && (
              <div className="row">
                <button type="button" className="btn sm primary" onClick={() => handle.current?.lookAt(A.an.sun.az[idx], A.an.sun.el[idx] ?? 0)}>
                  Privește Soarele
                </button>
                <button type="button" className="btn sm hud-btn" onClick={() => handle.current?.lookAt(A.an.earth.az[idx], A.an.earth.el[idx] ?? 0)}>
                  Privește Pământul
                </button>
                <button type="button" className="btn sm hud-btn" onClick={() => handle.current?.reset()}>
                  Resetează privirea
                </button>
              </div>
            )}
          </>
        )}

        <p className="surface-note small" tabIndex={0}>
          <b>{terrainNote}</b> Soarele și Pământul sunt plasate la azimutul și elevația din date pentru zona și momentul selectate; faza Pământului urmează direcția Soarelui. Dimensiunile aparente sunt mărite (Soarele ×2, Pământul ×3), orientarea continentelor este ilustrativă, iar lumina de umplere a terenului este adăugată pentru lizibilitate. Pietrele sunt ilustrative.
          {modelStatus === 'loaded' && ' Modelul 3D al aterizorului este ilustrativ.'}
          {modelStatus === 'error' && ' Modelul 3D din public/3d-models nu a putut fi încărcat.'} Controale: trage pentru a roti privirea, rotița pentru zoom; din tastatură: clic pe scenă, apoi săgețile și + / −.
        </p>

      </aside>
    </div>
  );
}

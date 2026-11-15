'use client';

// Perspectiva 2 — Luna: clic pe un punct de pe glob → camera zboară spre el → „Suprafață”.
// Comparația Plan A / Alternativa B se deschide într-un panou glisant („Analiză”).
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { LANDING_SITES } from '@/lib/data/landingSites';
import { localSkyDirection, siteSkyAt } from '@/lib/logic/bundleEphemeris';
import { TimeBar } from '../components/shared/TimeBar';
import { webglAvailable } from '../components/shared/three-utils';
import type { WS } from '../components/shared/types';
import { Comparison } from '../components/zone/Comparison';
import { LandingPanel } from '../components/zone/LandingPanel';
import type { MoonModelState } from '../components/zone/MoonGlobe';

const MoonGlobe = dynamic(() => import('../components/zone/MoonGlobe'), {
  ssr: false,
  loading: () => <div className="s3-loading">Se încarcă globul lunar…</div>,
});

export function ZoneAterizareView({ ws }: { ws: WS }) {
  // WebGL se verifică o singură dată, în browser (perspectivele se afișează doar pe client)
  const [gl, setGl] = useState<boolean | null>(() => (typeof window === 'undefined' ? null : webglAvailable()));
  const [moonModel, setMoonModel] = useState<MoonModelState>({ state: 'loading', pct: null });
  const [analysis, setAnalysis] = useState(false);
  const { flight, arrive } = ws;
  useEffect(() => {
    if (gl === false && flight === 'site') arrive();
  }, [gl, flight, arrive]);

  useEffect(() => {
    if (!analysis) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAnalysis(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [analysis]);

  const focus = ws.landing;
  const sky = focus ? siteSkyAt(ws.bundle, focus.id, ws.timeMs) : null;
  const sunDirection = focus && sky ? localSkyDirection(focus.latDeg, focus.lonDeg, sky.sun) : null;
  const flyLanding = (id: string) => {
    ws.selectLanding(id);
    ws.go('suprafata');
  };

  const badge =
    moonModel.state === 'loaded'
      ? 'Model NASA LRO: culoare 8k + topografie (relief exagerat ≈ 2,5×)'
      : moonModel.state === 'loading'
        ? `Se încarcă modelul LRO${moonModel.pct != null ? ` · ${moonModel.pct} %` : '…'}`
        : moonModel.state === 'skipped'
          ? 'Grafică redusă: hartă LRO 2k fără relief'
          : 'Hartă LRO 2k · fără relief';

  return (
    <div className="workspace-grid">
      <section className="workspace-scene" aria-label="Glob lunar">
        <header className="scene-heading">
          <div><p className="k">Lună</p><p>Locuri de aterizare</p></div>
          <span className="view-label">Glob 3D</span>
        </header>
        <div className="workspace-viewport">
          {gl === false ? (
            <div className="fallback">
              <p>
                <b>WebGL nu este disponibil.</b> Alege un loc din panoul lateral.
              </p>
            </div>
          ) : gl ? (
            <MoonGlobe
              onFail={() => setGl(false)}
              onModel={setMoonModel}
              landing={LANDING_SITES}
              landingId={ws.landing?.id ?? null}
              sunDirection={sunDirection}
              onLanding={flyLanding}
              quality={ws.quality}
              intro={ws.prevStage === 'sistem' ? 'far' : ws.prevStage === 'suprafata' ? 'site' : 'none'}
              focus={focus ? { latDeg: focus.latDeg, lonDeg: focus.lonDeg } : null}
              flyToFocus={ws.flight === 'site'}
              onArrive={ws.arrive}
            />
          ) : null}
        </div>

        {gl && <p className="scene-footer small muted">{badge}</p>}
        <div className="scene-footer">
          <TimeBar
            cov={ws.cov}
            timeMs={ws.timeMs}
            playing={ws.playing}
            speed={ws.speed}
            onSeek={ws.seekUtc}
            onPlay={ws.togglePlay}
            onSpeed={ws.setSpeed}
            onNow={ws.goNow}
            compact
          />
        </div>
      </section>

      <aside className="workspace-inspector" aria-label="Locuri și informații">
        <div className="inspector-heading">
          <div>
            <p className="k">{ws.landing ? 'Loc selectat' : 'Locuri de aterizare'}</p>
            <h2>{ws.landing?.name ?? 'Alege un loc'}</h2>
          </div>
          <span aria-hidden="true" className="body-dot site-dot" />
        </div>
        {ws.landing ? (
          <div className="panel-body" key={ws.landing.id}><LandingPanel ws={ws} /></div>
        ) : (
          <p className="muted small">Selectează Apollo 15 sau Apollo 17 din bara laterală pentru detalii. Apasă pe marcajul de pe glob pentru a intra pe suprafață.</p>
        )}

        <button type="button" className="btn wide" onClick={() => setAnalysis(true)}>
          Analiză și comparație
        </button>
      </aside>

      <section className={`drawer${analysis ? ' open' : ''}`} aria-label="Analiză și comparație" aria-hidden={!analysis} inert={!analysis}>
        <header className="drawer-h">
          <h2>Analiză și comparație</h2>
          <button type="button" className="btn sm" onClick={() => setAnalysis(false)}>
            Închide
          </button>
        </header>
        <div className="drawer-body">
          <Comparison ws={ws} />
          <footer className="foot">
            <p>Instrument de comparație preliminară. Un Pământ vizibil geometric nu garantează legătura radio; un Soare vizibil nu garantează putere electrică sau siguranță termică. Nu este o evaluare a siguranței aterizării.</p>
            <p>NASA Space Apps Challenge 2026 · Lunar Landing Site Navigator</p>
          </footer>
        </div>
      </section>
    </div>
  );
}

'use client';

// Page 2 — the Moon: clicking a marker selects the site (inspector + timeline);
// entering the surface is a separate action. The mission and the Planner sit below, on every page.
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { LANDING_SITES } from '@/lib/data/landingSites';
import { localSkyDirection, siteSkyAt } from '@/lib/logic/bundleEphemeris';
import { TimeBar } from '../components/shared/TimeBar';
import { webglAvailable } from '../components/shared/three-utils';
import type { WS } from '../components/shared/types';
import type { MoonModelState } from '../components/zone/MoonGlobe';
import { SiteInspector } from '../components/zone/SiteInspector';

const MoonGlobe = dynamic(() => import('../components/zone/MoonGlobe'), {
  ssr: false,
  loading: () => <p className="scene-loading">Preparing the lunar globe…</p>,
});

/** Size of public/3d-models/moon.glb on disk (not measured HTTP traffic). */
const MOON_GLB_MB = '81.5';

export function ZoneAterizareView({ ws }: { ws: WS }) {
  const [gl, setGl] = useState<boolean | null>(() => (typeof window === 'undefined' ? null : webglAvailable()));
  const [moonModel, setMoonModel] = useState<MoonModelState>({ state: 'loading', pct: null });
  const { flight, arrive } = ws;
  useEffect(() => {
    if (gl === false && flight === 'site') arrive();
  }, [gl, flight, arrive]);

  const focus = ws.landing;
  const sky = focus ? siteSkyAt(ws.bundle, focus.id, ws.timeMs) : null;
  const sunDirection = focus && sky ? localSkyDirection(focus.latDeg, focus.lonDeg, sky.sun) : null;
  const track = focus ? ws.trackOf(focus.id) : null;

  const loading = moonModel.state === 'loading';
  const layer =
    moonModel.state === 'loaded'
      ? 'LRO relief: colour and topography, relief exaggerated ≈ 2.5×'
      : moonModel.state === 'missing' || moonModel.state === 'error'
        ? 'The LRO model could not be loaded; showing the 2k map without relief'
        : 'Loading the LRO relief…';
  const lighting = sunDirection ? 'Lighting: the Sun from the Horizons data for the selected site' : focus ? 'Even lighting: the moment is outside the data' : 'Even lighting: choose a site';

  return (
    <div className="atlas-grid">
      <section className="scene-frame" aria-label="Lunar globe">
        <div className="scene-view">
          {gl === false ? (
            <div className="scene-fallback">
              <p>
                <b>WebGL is not available.</b> The sites and their data are in the right-hand column and the list on the left.
              </p>
            </div>
          ) : gl ? (
            <MoonGlobe
              onFail={() => setGl(false)}
              onModel={setMoonModel}
              landing={LANDING_SITES}
              landingId={ws.landing?.id ?? null}
              sunDirection={sunDirection}
              onLanding={ws.selectLanding}
              quality={ws.quality}
              intro={ws.prevStage === 'sistem' ? 'far' : ws.prevStage === 'suprafata' ? 'site' : 'none'}
              focus={focus ? { latDeg: focus.latDeg, lonDeg: focus.lonDeg } : null}
              flyToFocus={ws.flight === 'site'}
              onArrive={ws.arrive}
            />
          ) : null}
          {gl && loading && (
            <div className="globe-loading" role="status">
              <p>Loading the LRO lunar relief</p>
              <div className="load-bar" aria-hidden="true">
                <span style={{ width: moonModel.state === 'loading' && moonModel.pct != null ? `${moonModel.pct}%` : '0%' }} />
              </div>
              <p className="mono small">
                {moonModel.state === 'loading' && moonModel.pct != null ? `${moonModel.pct} % of ${MOON_GLB_MB} MB` : `${MOON_GLB_MB} MB · first load only, then kept for the session`}
              </p>
            </div>
          )}
          {gl && !loading && (
            <div className="scene-caption">
              <p>{layer}</p>
              <p>{lighting}</p>
              <p className="scene-hint">Drag to rotate · wheel or two fingers to zoom · keyboard: focus the globe, then arrows and + / −</p>
            </div>
          )}
        </div>
        <TimeBar
          cov={ws.cov}
          timeMs={ws.timeMs}
          playing={ws.playing}
          speed={ws.speed}
          onSeek={ws.seekUtc}
          onPlay={ws.togglePlay}
          onSpeed={ws.setSpeed}
          onNow={ws.goNow}
          nowState={ws.nowState}
          track={track}
          siteLabel={focus?.name}
        />
      </section>

      <aside className="inspector" aria-label={focus ? `About ${focus.name}` : 'Landing sites'}>
        <SiteInspector ws={ws} />
      </aside>
    </div>
  );
}

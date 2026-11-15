'use client';

// Page 1 — the Sun–Earth–Moon system (schematic; analytic model, separate from the Horizons data).
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { EPHEMERIS_LABEL, moonGeocentric, moonPhase, sunGeocentric } from '@/lib/logic/ephemeris';
import { fmtUtcMs } from '@/lib/logic/format';
import { TimeBar } from '../components/shared/TimeBar';
import { webglAvailable } from '../components/shared/three-utils';
import type { WS } from '../components/shared/types';

const SystemScene = dynamic(() => import('../components/sistem/SystemScene'), {
  ssr: false,
  loading: () => <p className="scene-loading">Preparing the system scene (Sun, Earth and Moon textures)…</p>,
});

const pct = (x: number) => `${Math.round(x * 100)} %`;
const km = (x: number) => `${Math.round(x).toLocaleString('en-US')} km`;

/** The phase seen from Earth, drawn: the lit part of the disc. */
function PhaseGlyph({ illuminated, waxing }: { illuminated: number; waxing: boolean }) {
  // terminator: an ellipse with horizontal semi-axis |1 − 2k|·r
  const r = 18;
  const rx = Math.abs(1 - 2 * illuminated) * r;
  const lit = waxing ? 1 : 0; // waxing: right side lit (northern hemisphere view)
  const gibbous = illuminated > 0.5;
  const d = `M0 ${-r} A${r} ${r} 0 0 ${lit} 0 ${r} A${rx} ${r} 0 0 ${gibbous ? lit : 1 - lit} 0 ${-r}Z`;
  return (
    <svg className="phase-glyph" viewBox="-22 -22 44 44" width="44" height="44" aria-hidden="true">
      <circle r={r} className="phase-dark" />
      <path d={d} className="phase-lit" />
    </svg>
  );
}

export function SistemView({ ws }: { ws: WS }) {
  const [gl, setGl] = useState<boolean | null>(() => (typeof window === 'undefined' ? null : webglAvailable()));
  const [resetToken, setResetToken] = useState(0);
  const { flight, arrive } = ws;
  useEffect(() => {
    if (gl === false && flight === 'moon') arrive();
  }, [gl, flight, arrive]);

  const t = ws.timeMs;
  const phase = moonPhase(t);
  const moon = moonGeocentric(t);
  const sun = sunGeocentric(t);
  const waxing = (moon.lonDeg - sun.lonDeg + 360) % 360 < 180;
  const toMoon = () => ws.go('zone');

  return (
    <div className="atlas-grid">
      <section className="scene-frame" aria-label="Sun, Earth and Moon, schematic">
        <div className="scene-view">
          {gl === false ? (
            <div className="scene-fallback">
              <p>
                <b>WebGL is not available in this browser.</b> The same information as text:
              </p>
              <ul className="bullets">
                <li>Ecliptic longitude of the Sun (seen from Earth): {sun.lonDeg.toFixed(1)}°</li>
                <li>
                  Ecliptic longitude of the Moon: {moon.lonDeg.toFixed(1)}°, latitude {moon.latDeg.toFixed(1)}°
                </li>
                <li>
                  Moon phase seen from Earth: {pct(phase.illuminated)} lit, {waxing ? 'waxing' : 'waning'}
                </li>
              </ul>
            </div>
          ) : gl ? (
            <SystemScene timeMs={t} resetToken={resetToken} onSelectMoon={toMoon} onFail={() => setGl(false)} flyToMoon={ws.flight === 'moon'} onArrive={ws.arrive} introFromMoon={ws.prevStage === 'zone'} />
          ) : null}
          {gl && (
            <>
              <p className="tableau-note">Schematic representation; not to scale.</p>
              <div className="scene-caption">
                <p>The Moon sits at its computed elongation for the chosen moment: move the timeline and watch it travel around the Earth.</p>
                <p className="scene-hint">Click the Moon (or press Enter) to fly there · drag to tilt the view slightly</p>
                <div className="scene-tools">
                  <button type="button" className="btn quiet" onClick={() => setResetToken((n) => n + 1)}>
                    Reset view
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        <TimeBar cov={ws.cov} timeMs={t} playing={ws.playing} speed={ws.speed} onSeek={ws.seekUtc} onPlay={ws.togglePlay} onSpeed={ws.setSpeed} onNow={ws.goNow} nowState={ws.nowState} stepMin={60} />
      </section>

      <aside className="inspector" aria-label="What you see in the system">
        <div className="insp-section">
          <h2 className="insp-h">What moves</h2>
          <p>
            The Earth orbits the Sun, and the Moon goes around the Earth about once every 29.5 days relative to the Sun. When you move the timeline, the direction the Sun lights the Moon
            from changes.
          </p>
        </div>

        <div className="insp-section">
          <div className="phase-row">
            <PhaseGlyph illuminated={phase.illuminated} waxing={waxing} />
            <div>
              <h2 className="insp-h">Phase seen from Earth</h2>
              <p className="mono">
                {pct(phase.illuminated)} · {waxing ? 'waxing' : 'waning'}
              </p>
            </div>
          </div>
          <p className="small">
            <b>The phase is not the light at a landing site.</b> The phase shows which part of the near side is lit, seen from Earth. What matters for one site is whether the Sun is
            above its local horizon: a site can be in night even when the Moon looks almost full. You check that on the Moon page.
          </p>
        </div>

        <dl className="kv insp-section">
          <dt>Earth–Moon</dt>
          <dd className="mono">≈ {km(moon.distKm)}</dd>
          <dt>Earth–Sun</dt>
          <dd className="mono">≈ {(sun.distKm / 149_597_870.7).toFixed(4)} AU</dd>
          <dt>Moment</dt>
          <dd className="mono">{fmtUtcMs(t)}</dd>
        </dl>

        <button type="button" className="btn primary wide" onClick={toMoon} disabled={!!ws.flight}>
          {ws.flight === 'moon' ? 'Approaching the Moon…' : 'Explore the Moon'}
        </button>

        <details className="insp-more">
          <summary>What is computed and what is schematic</summary>
          <ul className="bullets small">
            <li>{EPHEMERIS_LABEL}</li>
            <li>A composed picture: the Sun, Earth and Moon are brought close and enlarged to fit in one frame. The Sun&apos;s direction is fixed (from the left); the Moon&apos;s place on its orbit follows the computed elongation.</li>
            <li>The bodies are greatly enlarged. Textures are real maps (Solar System Scope, CC BY 4.0, based on NASA data); the Earth&apos;s rotation and clouds are illustrative.</li>
            <li>The activity windows on the Moon page use different data: NASA/JPL Horizons (DE441) positions sampled for each site.</li>
          </ul>
        </details>
      </aside>
    </div>
  );
}

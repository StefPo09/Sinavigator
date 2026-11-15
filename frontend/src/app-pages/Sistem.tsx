'use client';

// Perspectiva 1 — Sistemul Soare–Pământ–Lună.
// Clic pe Lună → camera zboară până la Lună → perspectiva „Lună”.
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { EPHEMERIS_LABEL, moonGeocentric, moonPhase, sunGeocentric } from '@/lib/logic/ephemeris';
import { fmtUtcMs } from '@/lib/logic/format';
import { TimeBar } from '../components/shared/TimeBar';
import { webglAvailable } from '../components/shared/three-utils';
import type { WS } from '../components/shared/types';
import { MOON_ORBIT_EXAGGERATION } from '../components/sistem/scale';

const SystemScene = dynamic(() => import('../components/sistem/SystemScene'), {
  ssr: false,
  loading: () => <div className="s3-loading">Se încarcă scena 3D…</div>,
});

const pct = (x: number) => `${Math.round(x * 100)} %`;
const km = (x: number) => `${Math.round(x).toLocaleString('ro-RO')} km`;

export function SistemView({ ws }: { ws: WS }) {
  // WebGL se verifică o singură dată, în browser (perspectivele se afișează doar pe client)
  const [gl, setGl] = useState<boolean | null>(() => (typeof window === 'undefined' ? null : webglAvailable()));
  const [follow, setFollow] = useState(false);
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
    <div className="workspace-grid">
      <section className="workspace-scene" aria-label="Sistem solar 3D">
        <header className="scene-heading">
          <div><p className="k">Sistem solar</p><p>Vedere centrată pe Soare</p></div>
          <span className="view-label">Vedere 3D</span>
        </header>
        <div className="workspace-viewport">
          {gl === false ? (
            <div className="fallback">
              <p>
                <b>WebGL nu este disponibil în acest browser.</b> Iată aceleași informații în format text:
              </p>
              <ul>
                <li>Longitudinea ecliptică a Soarelui (văzut de pe Pământ): {sun.lonDeg.toFixed(1)}°</li>
                <li>
                  Longitudinea ecliptică a Lunii: {moon.lonDeg.toFixed(1)}°, latitudine {moon.latDeg.toFixed(1)}°
                </li>
                <li>
                  Faza Lunii: {pct(phase.illuminated)} iluminată, {waxing ? 'în creștere' : 'în descreștere'}
                </li>
              </ul>
            </div>
          ) : gl ? (
            <SystemScene
              timeMs={t}
              cov={ws.cov}
              follow={follow}
              resetToken={resetToken}
              moonSelected={ws.flight === 'moon'}
              onSelectMoon={toMoon}
              onFail={() => setGl(false)}
              flyToMoon={ws.flight === 'moon'}
              onArrive={ws.arrive}
              introFromMoon={ws.prevStage === 'zone'}
            />
          ) : null}
        </div>
        <div className="scene-footer">
          <TimeBar cov={ws.cov} timeMs={t} playing={ws.playing} speed={ws.speed} onSeek={ws.seekUtc} onPlay={ws.togglePlay} onSpeed={ws.setSpeed} onNow={ws.goNow} stepMin={60} compact />
        </div>
      </section>

      <aside className="workspace-inspector" aria-labelledby="sys-side-h">
        <div className="inspector-heading">
          <div>
            <p className="k">Obiecte</p>
            <h2 id="sys-side-h">Pământ și Lună</h2>
            <p className="muted small">{fmtUtcMs(t)}</p>
          </div>
          <span aria-hidden="true" className="body-dot earth-dot" />
        </div>
        <div className="moon-action">
          <p>
            <b>Luna</b> · {pct(phase.illuminated)} iluminată, {waxing ? 'în creștere' : 'în descreștere'} (aproximativ).
          </p>
          <button type="button" className="btn primary wide glow" onClick={toMoon} disabled={!!ws.flight}>
            {ws.flight === 'moon' ? 'Zbor spre Lună…' : 'Zboară spre Lună'}
          </button>
        </div>
        <h3 className="inspector-section-title">Pe scurt</h3>
        <dl className="kv">
          <dt>Distanța Pământ–Lună</dt>
          <dd>≈ {km(moon.distKm)}</dd>
          <dt>Distanța Pământ–Soare</dt>
          <dd>≈ {(sun.distKm / 149_597_870.7).toFixed(4)} UA</dd>
        </dl>
        <div className="row">
          <button type="button" className={`chip${follow ? ' on' : ''}`} aria-pressed={follow} onClick={() => setFollow((f) => !f)}>
            Urmărește Pământul
          </button>
          <button type="button" className="btn sm" onClick={() => setResetToken((n) => n + 1)} disabled={!gl}>
            Resetează vederea
          </button>
        </div>
        <details className="inline-more">
          <summary>Ce este real și ce este schematic</summary>
          <ul className="bullets small">
            <li>{EPHEMERIS_LABEL}</li>
            <li>Distanțele sunt comprimate: orbita Pământului are 40 de unități, iar orbita Lunii este mărită de ≈ {MOON_ORBIT_EXAGGERATION}× ca să fie lizibilă.</li>
            <li>Dimensiunile corpurilor sunt mărite mult. Texturile sunt hărți reale (Solar System Scope, CC BY 4.0, pe baza datelor NASA); rotația Pământului și norii sunt ilustrative.</li>
            <li>Arcul verde de pe orbita Pământului marchează intervalul acoperit de datele de vizibilitate.</li>
            <li>Ferestrele de activitate lunară descriu iluminarea și vizibilitatea la sol. Transferul orbital idealizat de la intrarea pe suprafață folosește un calcul separat.</li>
          </ul>
        </details>
        <p className="scale-chip">Schematic · nu este la scară</p>
      </aside>

    </div>
  );
}

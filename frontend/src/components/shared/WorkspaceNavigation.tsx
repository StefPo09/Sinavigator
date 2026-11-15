import Image from 'next/image';
import { LANDING_SITES } from '@/lib/data/landingSites';
import type { Perspective, WS } from './types';

const perspectives: { id: Perspective; label: string; hint: string }[] = [
  { id: 'sistem', label: 'System', hint: 'Sun, Earth, Moon' },
  { id: 'zone', label: 'Moon', hint: 'Landing sites' },
  { id: 'suprafata', label: 'Surface', hint: 'Ground view' },
];

export type PreloadState =
  | { kind: 'idle' }
  | { kind: 'running'; done: number; total: number; label: string; pct: number | null }
  | { kind: 'ready' }
  | { kind: 'partial'; failed: string[] };

const coord = (lat: number, lon: number) => `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? 'S' : 'N'} · ${Math.abs(lon).toFixed(2)}° ${lon < 0 ? 'W' : 'E'}`;

export function Brand() {
  return (
    <p className="brand">
      {/* the team logo, converted to vector from the supplied PDF (public/brand) */}
      <Image src="/brand/sinavigator-logo-mark.svg" alt="Sinavigator" width={388} height={71} priority unoptimized />
    </p>
  );
}

export function WorkspaceNavigation({
  perspective,
  landingId,
  flight,
  fading,
  onNavigate,
  onSelectLanding,
  onAbout,
  onMission,
  onTour,
  onQuiz,
  onPreload,
  preload,
  synthetic,
}: {
  perspective: Perspective;
  landingId: string | null;
  flight: WS['flight'];
  fading: boolean;
  onNavigate: (perspective: Perspective) => void;
  onSelectLanding: (id: string) => void;
  onAbout: () => void;
  onMission: () => void;
  onTour: () => void;
  onQuiz: () => void;
  onPreload: () => void;
  preload: PreloadState;
  synthetic: boolean;
}) {
  const busy = !!flight || fading;
  return (
    <aside className="atlas-nav">
      <Brand />
      <nav aria-label="Pages">
        <ol className="nav-list">
          {perspectives.map(({ id, label, hint }, i) => {
            const needsSite = id === 'suprafata' && !landingId;
            const current = id === perspective;
            return (
              <li key={id}>
                <button
                  type="button"
                  className="nav-item"
                  data-stage={id}
                  onClick={() => onNavigate(id)}
                  aria-current={current ? 'page' : undefined}
                  disabled={current || busy || needsSite}
                  title={needsSite ? 'Choose a site first' : undefined}
                >
                  <span className="nav-num mono" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span>
                    {label}
                    <small>{needsSite ? 'Choose a site first' : hint}</small>
                  </span>
                </button>
              </li>
            );
          })}
          <li>
            <button type="button" className="nav-item nav-mission" onClick={onMission}>
              <span className="nav-num mono" aria-hidden="true">
                4
              </span>
              <span>
                Mission
                <small>Your exercise ↓</small>
              </span>
            </button>
          </li>
        </ol>
      </nav>
      {perspective !== 'sistem' && (
        <section className="nav-sites" aria-labelledby="nav-sites-h">
          <h2 id="nav-sites-h" className="label">
            Sites
          </h2>
          <ul>
            {LANDING_SITES.map(({ id, name, latDeg, lonDeg }) => (
              <li key={id}>
                <button type="button" className="site-item" aria-pressed={landingId === id} disabled={busy} onClick={() => onSelectLanding(id)}>
                  <span className="site-dot" aria-hidden="true" />
                  <span>
                    {name}
                    <small className="mono">{coord(latDeg, lonDeg)}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="nav-foot">
        <div className="nav-learn">
          <button type="button" className="btn quiet" onClick={onTour}>
            Tutorial
          </button>
          <button type="button" className="btn quiet" onClick={onQuiz}>
            Quiz
          </button>
        </div>
        <div className="preload" aria-live="polite">
          {preload.kind === 'idle' && (
            <button type="button" className="btn quiet preload-btn" onClick={onPreload} title="Downloads the Moon relief, both Apollo terrains, rocks and textures now, so a presentation never waits">
              Prepare for presentation
            </button>
          )}
          {preload.kind === 'running' && (
            <>
              <p className="small">
                Preloading {Math.min(preload.done + 1, preload.total)}/{preload.total} · {preload.label}
                {preload.pct != null && preload.done === 0 ? ` · ${preload.pct} %` : ''}
              </p>
              <div className="load-bar" aria-hidden="true">
                <span style={{ width: `${((preload.done + (preload.done === 0 && preload.pct != null ? preload.pct / 100 : 0)) / preload.total) * 100}%` }} />
              </div>
            </>
          )}
          {preload.kind === 'ready' && <p className="state-line ok small">✓ Ready for presentation</p>}
          {preload.kind === 'partial' && <p className="state-line warn small">Preloaded except: {preload.failed.join(', ')}</p>}
        </div>
        {synthetic && <p className="state-line warn">Synthetic data</p>}
        <button type="button" className="text-link" onClick={onAbout}>
          Sources, limits and AI statement
        </button>
      </div>
    </aside>
  );
}

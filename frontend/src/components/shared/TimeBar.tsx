'use client';

import { fmtUtcMs } from '@/lib/logic/format';
import { SPEEDS, type Coverage, type Speed } from '@/lib/logic/timeline';

interface Props {
  cov: Coverage;
  timeMs: number;
  playing: boolean;
  speed: Speed;
  onSeek: (ms: number) => void;
  onPlay: () => void;
  onSpeed: (s: Speed) => void;
  onNow: () => void;
  /** pas pentru butoanele ◀ / ▶ și pentru slider, în minute */
  stepMin?: number;
  compact?: boolean;
}

const DAY = 86_400_000;

/** Bara temporală globală: dată/oră UTC mereu vizibilă, Play/Pauză, viteză prin butoane, „Acum”. */
export function TimeBar({ cov, timeMs, playing, speed, onSeek, onPlay, onSpeed, onNow, stepMin = 10, compact = false }: Props) {
  const stepMs = stepMin * 60_000;
  const span = cov.endMs - cov.startMs;
  const ticks = Array.from({ length: Math.floor(span / DAY) + 1 }, (_, i) => cov.startMs + i * DAY);
  const pct = (ms: number) => `${((ms - cov.startMs) / span) * 100}%`;
  return (
    <section className={`timebar${compact ? ' timebar-compact' : ''}`} aria-label="Bara temporală">
      <div className="tb-row">
        <div className="tb-clock" aria-live="off">
          <span className="k">Data analizată (UTC)</span>
          <b className="mono">{fmtUtcMs(timeMs)}</b>
        </div>
        <div className="tb-ctl">
          <button type="button" className="btn icon" onClick={() => onSeek(timeMs - stepMs)} disabled={timeMs <= cov.startMs} aria-label={`Înapoi ${stepMin} minute`}>
            ◀
          </button>
          <button type="button" className="btn icon play" onClick={onPlay} aria-label={playing ? 'Pauză' : 'Redă'} aria-pressed={playing}>
            {playing ? '❚❚' : '▶'}
          </button>
          <button type="button" className="btn icon" onClick={() => onSeek(timeMs + stepMs)} disabled={timeMs >= cov.endMs} aria-label={`Înainte ${stepMin} minute`}>
            ▶
          </button>
          <div className="seg" role="group" aria-label="Viteza de redare">
            {SPEEDS.map((s) => (
              <button key={s} type="button" className={`chip${speed === s ? ' on' : ''}`} aria-pressed={speed === s} onClick={() => onSpeed(s)}>
                {s} h/s
              </button>
            ))}
          </div>
          <button type="button" className="btn sm" onClick={onNow}>
            Acum
          </button>
        </div>
      </div>
      <div className="tb-track">
        <input
          type="range"
          min={cov.startMs}
          max={cov.endMs}
          step={stepMs}
          value={timeMs}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Momentul analizat"
          aria-valuetext={fmtUtcMs(timeMs)}
        />
        <div className="tb-ticks" aria-hidden="true">
          {ticks.map((ms) => (
            <span key={ms} style={{ left: pct(ms) }}>
              {fmtUtcMs(ms).replace(/, .*$/, '')}
            </span>
          ))}
        </div>
      </div>
      {!compact && (
        <p className="tb-range muted small">
          Interval acoperit de date: {fmtUtcMs(cov.startMs)} → {fmtUtcMs(cov.endMs)}. În afara lui nu sunt afișate rezultate.
        </p>
      )}
    </section>
  );
}

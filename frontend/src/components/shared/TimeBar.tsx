'use client';

import { fmtUtcMs } from '@/lib/logic/format';
import type { SiteEvent, SiteTrack } from '@/lib/logic/lesson';
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
  /** where today falls relative to the data; outside it the button jumps to the nearest data edge */
  nowState?: 'inside' | 'before' | 'after';
  /** pas pentru butoanele ◀ / ▶ și pentru slider, în minute */
  stepMin?: number;
  /** benzile de vizibilitate ale locului selectat; fără ele, timeline-ul arată doar acoperirea datelor */
  track?: SiteTrack | null;
  siteLabel?: string;
}

const DAY = 86_400_000;
const DETAIL_TEXT = { both: 'Sun + Earth', sun: 'Sun only', earth: 'Earth only', none: 'neither', unk: 'unknown' } as const;
const EVENT_TEXT: Record<SiteEvent['body'], Record<SiteEvent['kind'], string>> = {
  sun: { rise: 'Sun rises', set: 'Sun sets', unk: 'missing data (Sun)' },
  earth: { rise: 'Earth rises', set: 'Earth sets', unk: 'missing data (Earth)' },
};

/**
 * Timeline-ul comun: momentul analizat (UTC), acoperirea datelor, benzile calculate pentru locul
 * selectat și evenimentele lui. Evenimentele sunt butoane: mută momentul analizat la ele.
 */
export function TimeBar({ cov, timeMs, playing, speed, onSeek, onPlay, onSpeed, onNow, nowState = 'inside', stepMin = 10, track, siteLabel }: Props) {
  const stepMs = stepMin * 60_000;
  const span = cov.endMs - cov.startMs;
  const firstDay = Math.ceil(cov.startMs / DAY) * DAY;
  const ticks = Array.from({ length: Math.floor((cov.endMs - firstDay) / DAY) + 1 }, (_, i) => firstDay + i * DAY);
  const x = (ms: number) => ((ms - cov.startMs) / span) * 100;
  const events = (track?.events ?? []).filter((e) => e.kind !== 'unk');
  const inTrack = track ? track.segs.find((g) => timeMs >= g.startMs && timeMs < g.endMs) ?? (timeMs === track.endMs ? track.segs[track.segs.length - 1] : null) : null;
  const states = track ? [...new Set(track.segs.map((g) => g.state))] : [];

  return (
    <section className="timeline" aria-label="Timeline: analysed moment">
      <div className="tl-row">
        <p className="tl-clock">
          <span className="label">Analysed moment (UTC)</span>
          <time className="mono" dateTime={new Date(timeMs).toISOString()}>
            {fmtUtcMs(timeMs)}
          </time>
          {track && (
            <span className="tl-now small">
              {siteLabel}: {inTrack ? DETAIL_TEXT[inTrack.state] : 'no data at this moment'}
            </span>
          )}
        </p>
        <div className="tl-ctl">
          <button type="button" className="btn icon" onClick={() => onSeek(timeMs - stepMs)} disabled={timeMs <= cov.startMs} aria-label={`Back ${stepMin} minutes`}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M10 3 5 8l5 5" /></svg>
          </button>
          <button type="button" className="btn icon" onClick={onPlay} aria-label={playing ? 'Pause' : 'Play'} aria-pressed={playing}>
            {playing ? (
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M5 3v10M11 3v10" /></svg>
            ) : (
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path className="fill" d="M5 3l8 5-8 5z" /></svg>
            )}
          </button>
          <button type="button" className="btn icon" onClick={() => onSeek(timeMs + stepMs)} disabled={timeMs >= cov.endMs} aria-label={`Forward ${stepMin} minutes`}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
          </button>
          <div className="seg" role="group" aria-label="Playback speed">
            {SPEEDS.map((s) => (
              <button key={s} type="button" className={speed === s ? 'on' : ''} aria-pressed={speed === s} onClick={() => onSpeed(s)}>
                {s} h/s
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn quiet"
            onClick={onNow}
            title={nowState === 'inside' ? 'Jump to the current time' : `Today is ${nowState} the computed data window; jumps to its ${nowState === 'before' ? 'first' : 'last'} moment`}
          >
            {nowState === 'inside' ? 'Now' : nowState === 'before' ? 'Data start' : 'Data end'}
          </button>
        </div>
      </div>

      <div className="tl-track">
        <div className="tl-events" aria-label={events.length ? 'Computed events' : undefined} role={events.length ? 'group' : undefined}>
          {events.map((e) => {
            const label = `${e.approx ? '≈ ' : ''}${EVENT_TEXT[e.body][e.kind]} · ${fmtUtcMs(e.ms)}`;
            return (
              <button key={`${e.body}${e.ms}`} type="button" className={`tl-ev ev-${e.body} ev-${e.kind}`} style={{ left: `${x(e.ms)}%` }} onClick={() => onSeek(e.ms)} aria-label={`Go to: ${label}`} title={label}>
                <span aria-hidden="true">{e.kind === 'rise' ? '▲' : '▼'}</span>
              </button>
            );
          })}
        </div>
        <div className="tl-band" aria-hidden="true">
          {track ? (
            track.segs.map((g) => <i key={g.startMs} className={`b-${g.state}`} style={{ left: `${x(g.startMs)}%`, width: `${x(g.endMs) - x(g.startMs)}%` }} />)
          ) : (
            <i className="b-cov" style={{ left: 0, width: '100%' }} />
          )}
          <b className="tl-cursor" style={{ left: `${x(timeMs)}%` }} />
        </div>
        <input
          type="range"
          className="tl-range"
          min={cov.startMs}
          max={cov.endMs}
          step={stepMs}
          value={timeMs}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Analysed moment"
          aria-valuetext={`${fmtUtcMs(timeMs)}${inTrack ? `, ${siteLabel}: ${DETAIL_TEXT[inTrack.state]}` : ''}`}
        />
        <div className="tl-ticks" aria-hidden="true">
          {ticks.map((ms) => (
            <span key={ms} style={{ left: `${x(ms)}%` }}>
              {fmtUtcMs(ms).replace(/ \d{4}, .*$/, '')}
            </span>
          ))}
        </div>
      </div>
      <p className="tl-legend small">
        {track ? (
          <>
            {states.map((s) => (
              <span key={s} className={`lg lg-${s}`}>
                {DETAIL_TEXT[s]}
              </span>
            ))}
            <span className="lg-ev">▲▼ rise / set (± one 10-min step)</span>
          </>
        ) : (
          <span>
            Data available: {fmtUtcMs(cov.startMs)} → {fmtUtcMs(cov.endMs)}
          </span>
        )}
      </p>
    </section>
  );
}

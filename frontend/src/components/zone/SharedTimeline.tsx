'use client';

import { segAt, type Detail } from '@/lib/logic/derive';
import { fmtElapsed, fmtUtcMs } from '@/lib/logic/format';
import { Tag } from '../shared/common';
import type { Side } from './ScenarioCards';

const DETAIL_TEXT: Record<Detail, string> = { both: 'both visible', sun: 'Sun only', earth: 'Earth only', none: 'neither visible', unk: 'unknown' };

interface Props {
  sides: Side[];
  total: number;
  step: number;
  cursor: number;
  playing: boolean;
  syncLabel: string;
  marker: number | null;
  prev: number | null;
  next: number | null;
  onPlay: () => void;
  onSeek: (t: number) => void;
  onReset: () => void;
}

export function SharedTimeline({ sides, total, step, cursor, playing, syncLabel, marker, prev, next, onPlay, onSeek, onReset }: Props) {
  const pct = (t: number) => `${(Math.min(t, total) / total) * 100}%`;
  const valueText = `${fmtElapsed(cursor)}. ` + sides.map((s) => `${s.site.short}: ${fmtUtcMs(s.t0 + cursor * 60_000)}, ${DETAIL_TEXT[segAt(s.an.detail, cursor).state]}`).join('. ');
  return (
    <section className="dock" aria-label="Comparison timeline">
      <div className="dock-ctl">
        <button type="button" className="btn icon play" onClick={onPlay} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? '❚❚' : '▶'}
        </button>
        <button type="button" className="btn sm" onClick={() => prev != null && onSeek(prev)} disabled={prev == null}>
          ◀ Previous event
        </button>
        <button type="button" className="btn sm" onClick={() => next != null && onSeek(next)} disabled={next == null}>
          Next event ▶
        </button>
        <button type="button" className="btn sm" onClick={onReset} disabled={cursor === 0 && !playing}>
          Start of the period
        </button>
        <div className="dock-time">
          <b className="mono">{fmtElapsed(cursor)}</b>
          <span>{syncLabel}</span>
        </div>
      </div>

      <div className="dock-main">
        <div className="tracks">
          {sides.map((s, r) => (
            <div className="trackrow" key={s.id} style={{ gridRow: r + 1 }}>
              <Tag id={s.id} label={s.site.short} small />
              <div className="bar" aria-hidden="true">
                {s.an.detail
                  .filter((g) => g.start < total)
                  .map((g, i) => (
                    <i key={i} className={`d-${g.state}`} style={{ left: pct(g.start), width: `calc(${pct(Math.min(g.end, total))} - ${pct(g.start)})` }} />
                  ))}
              </div>
              <span className="mono utc">{fmtUtcMs(s.t0 + cursor * 60_000)}</span>
            </div>
          ))}
          <div className="slider-wrap" style={{ gridRow: `1 / span ${sides.length}` }}>
            {marker != null && marker <= total && <span className="mk" style={{ left: pct(marker) }} aria-hidden="true" />}
            <input
              type="range"
              min={0}
              max={total}
              step={step}
              value={cursor}
              onChange={(e) => onSeek(Number(e.target.value))}
              aria-label="Selected moment, shared by both options"
              aria-valuetext={valueText}
            />
          </div>
          <div className="ticks" aria-hidden="true" style={{ gridRow: sides.length + 1 }}>
            {Array.from({ length: Math.floor(total / 720) + 1 }, (_, i) => (
              <span key={i} style={{ left: pct(i * 720) }}>
                +{i * 12} h
              </span>
            ))}
          </div>
        </div>
        <ul className="legend" aria-label="Timeline legend">
          <li className="lg lg-both">Both visible</li>
          <li className="lg lg-sun">Sun only</li>
          <li className="lg lg-earth">Earth only</li>
          <li className="lg lg-none">Neither</li>
          <li className="lg lg-unk">Unknown</li>
        </ul>
      </div>
    </section>
  );
}

'use client';

import { useId, useRef, type PointerEvent } from 'react';
import type { Analysis, BodyTrack, Model, RowKey, Segment } from '@/lib/logic/derive';
import { fmtDeg, fmtDur, fmtUtc } from '@/lib/logic/format';
import { useWidth } from '../shared/common';
import { elTicks, type ElRange } from '../shared/SkyPanorama';

const CH = 150;
const ROW_H = 18;
const ROW_GAP = 5;
const PAD = { l: 58, r: 10, t: 8 };
const ROWS: { key: RowKey; label: string }[] = [
  { key: 'sun', label: 'Sun' },
  { key: 'earth', label: 'Earth' },
  { key: 'both', label: 'Ambele' },
];
const STATE_WORD = { vis: 'visible', hid: 'hidden', unk: 'unknown' };

interface Props {
  a: Analysis;
  startUtc: string;
  model: Model;
  cursor: number;
  total: number;
  activityMin: number;
  range: ElRange;
  marker: number | null;
  onSeek: (min: number) => void;
  label: string;
}

/** Elevation of both bodies against time, with per-body and joint visibility rows. Pointer-only:
 *  the shared timeline and event buttons provide the keyboard equivalent. */
export function TimeChart({ a, startUtc, model, cursor, total, activityMin, range, marker, onSeek, label }: Props) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const uid = useId().replace(/:/g, '');
  const drag = useRef(false);
  const pw = w - PAD.l - PAD.r;
  const stripsTop = PAD.t + CH + 22;
  const H = stripsTop + ROWS.length * (ROW_H + ROW_GAP) + 2;
  const x = (min: number) => PAD.l + (Math.min(min, total) / total) * pw;
  const y = (el: number) => PAD.t + (1 - (el - range.min) / (range.max - range.min)) * CH;
  const idx = Math.round(cursor / a.stepMin);

  const line = (vals: (number | null)[], add = 0) => {
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      const t = i * a.stepMin;
      if (v == null || t > total) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(t).toFixed(1)} ${y(v + add).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const seek = (e: PointerEvent) => {
    const box = e.currentTarget.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - box.left - PAD.l) / pw));
    onSeek(Math.round((f * total) / a.stepMin) * a.stepMin);
  };

  const hours = Array.from({ length: Math.floor(total / 720) + 1 }, (_, i) => i * 12);
  const cx = x(cursor);
  const dot = (t: BodyTrack, cls: string) => {
    const el = t.el[idx];
    return el == null ? null : <circle cx={cx} cy={y(el)} r={4} className={`dot ${cls}`} />;
  };

  const segRect = (row: RowKey, s: Segment, i: number, top: number) => {
    if (s.start >= total) return null;
    const x0 = x(s.start);
    const sw = Math.max(1.5, x(Math.min(s.end, total)) - x0);
    const fits = row === 'both' && s.state === 'vis' && s.end - s.start >= activityMin;
    return (
      <g key={row + i}>
        <title>{`${ROWS.find((r) => r.key === row)!.label}: ${STATE_WORD[s.state]} · ${fmtUtc(startUtc, s.start)} → ${fmtUtc(startUtc, s.end)} · ${fmtDur(s.end - s.start)}${s.truncStart || s.truncEnd ? ' · cut by the analysed period' : ''}`}</title>
        <rect x={x0 + 0.5} y={top} width={Math.max(1, sw - 1)} height={ROW_H} rx={3} className={`sg sg-${row} sg-${s.state}${fits ? ' fits' : ''}`} fill={s.state === 'unk' ? `url(#unk${uid})` : undefined} />
        {sw > 64 && s.state !== 'hid' && (
          <text x={x0 + sw / 2} y={top + ROW_H / 2 + 3.5} textAnchor="middle" className={`sg-text st-${s.state}`}>
            {s.state === 'unk' ? '? unknown' : `${fits ? '✓ ' : ''}${fmtDur(s.end - s.start)}${s.truncEnd ? ' →' : ''}`}
          </text>
        )}
      </g>
    );
  };

  return (
    <div ref={ref} className="tchart">
      <svg
        width={w}
        height={H}
        role="img"
        aria-label={label}
        onPointerDown={(e) => {
          drag.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          seek(e);
        }}
        onPointerMove={(e) => drag.current && seek(e)}
        onPointerUp={() => (drag.current = false)}
        onPointerCancel={() => (drag.current = false)}
      >
        <defs>
          <pattern id={`unk${uid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="rgba(243,246,250,0.04)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(243,246,250,0.4)" strokeWidth="1.3" />
          </pattern>
          <clipPath id={`tc${uid}`}>
            <rect x={PAD.l} y={PAD.t} width={pw} height={CH} />
          </clipPath>
        </defs>

        <rect x={PAD.l} y={PAD.t} width={pw} height={CH} rx="6" className="plot-bg" />
        {a.segs.both
          .filter((s) => s.state === 'vis' && s.start < total)
          .map((s, i) => (
            <rect key={i} x={x(s.start)} y={PAD.t} width={x(Math.min(s.end, total)) - x(s.start)} height={CH} className="band-both" />
          ))}
        {elTicks(range).map((e) => (
          <g key={e}>
            <line x1={PAD.l} x2={PAD.l + pw} y1={y(e)} y2={y(e)} className={e === 0 ? 'grid zero' : 'grid'} />
            <text x={PAD.l - 7} y={y(e) + 3.5} textAnchor="end" className="axis">
              {e}°
            </text>
          </g>
        ))}
        {hours.map((h) => (
          <g key={h}>
            <line x1={x(h * 60)} x2={x(h * 60)} y1={PAD.t} y2={PAD.t + CH} className="grid" />
            {(w > 520 || h % 24 === 0) && (
              <text x={x(h * 60)} y={PAD.t + CH + 14} textAnchor={h === 0 ? 'start' : h * 60 >= total ? 'end' : 'middle'} className="axis">
                +{h} h
              </text>
            )}
          </g>
        ))}

        <g clipPath={`url(#tc${uid})`}>
          {model === 'terrain' && (
            <>
              <path d={line(a.sun.hor, a.sun.threshold)} className="ln ln-sun obstacle" />
              <path d={line(a.earth.hor, a.earth.threshold)} className="ln ln-earth obstacle" />
            </>
          )}
          <path d={line(a.sun.el)} className="ln ln-sun" />
          <path d={line(a.earth.el)} className="ln ln-earth" />
        </g>

        {ROWS.map((r, ri) => {
          const top = stripsTop + ri * (ROW_H + ROW_GAP);
          return (
            <g key={r.key}>
              <text x={PAD.l - 7} y={top + ROW_H / 2 + 4} textAnchor="end" className="row-label">
                {r.label}
              </text>
              {a.segs[r.key].map((s, i) => segRect(r.key, s, i, top))}
            </g>
          );
        })}

        {marker != null && marker <= total && <line x1={x(marker)} x2={x(marker)} y1={PAD.t} y2={H - 2} className="marker" />}
        <g className="cursor" pointerEvents="none">
          <line x1={cx} x2={cx} y1={PAD.t - 4} y2={H - 2} />
          {dot(a.sun, 'd-sun')}
          {dot(a.earth, 'd-earth')}
          <g transform={`translate(${Math.min(PAD.l + pw - 104, Math.max(PAD.l + 2, cx + 8))} ${PAD.t + 4})`}>
            <rect width="102" height="34" rx="5" className="tip" />
            <text x="7" y="14" className="tip-t t-sun">
              Sun {fmtDeg(a.sun.el[idx], 2)}
            </text>
            <text x="7" y="28" className="tip-t t-earth">
              Earth {fmtDeg(a.earth.el[idx], 2)}
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}

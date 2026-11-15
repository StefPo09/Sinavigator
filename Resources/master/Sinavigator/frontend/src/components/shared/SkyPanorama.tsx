'use client';

import { useId, useMemo } from 'react';
import type { HorizonProfile } from '@/lib/data/types';
import type { Analysis, Body, BodyTrack, Model, VisState } from '@/lib/logic/derive';
import { fmtDeg } from '@/lib/logic/format';
import { EarthGlyph, SunGlyph, useWidth } from './common';

export interface ElRange {
  min: number;
  max: number;
}

const H = 236;
const PAD = { l: 40, r: 10, t: 10, b: 30 };
const COMPASS = ['S', 'SV', 'V', 'NV', 'N', 'NE', 'E', 'SE', 'S'];
const wrap180 = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

export function elTicks(r: ElRange): number[] {
  const span = r.max - r.min;
  const step = span > 24 ? 10 : span > 10 ? 5 : span > 5 ? 2 : 1;
  const out: number[] = [];
  for (let v = Math.ceil(r.min / step) * step; v <= r.max + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

interface Props {
  a: Analysis;
  profile: HorizonProfile | undefined;
  model: Model;
  idx: number;
  sunState: VisState;
  earthState: VisState;
  range: ElRange;
  highlight: Body | 'both' | null;
  label: string;
}

export function SkyPanorama({ a, profile, model, idx, sunState, earthState, range, highlight, label }: Props) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const uid = useId().replace(/:/g, '');
  const pw = w - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  const x = (az: number) => PAD.l + ((wrap180(az) + 180) / 360) * pw;
  const y = (el: number) => PAD.t + (1 - (el - range.min) / (range.max - range.min)) * ph;
  const bottom = PAD.t + ph;

  const terrain = useMemo(() => {
    const fills: string[] = [];
    const lines: string[] = [];
    const gaps: [number, number][] = [];
    const n = profile?.elevDeg.length ?? 0;
    let run: string[] = [];
    let runStart = -180;
    let gapStart: number | null = null;
    const flush = (endAz: number) => {
      if (run.length > 1) {
        lines.push('M' + run.join('L'));
        fills.push(`M${x(runStart).toFixed(1)} ${bottom}L${run.join('L')}L${(endAz >= 180 ? PAD.l + pw : x(endAz)).toFixed(1)} ${bottom}Z`);
      }
      run = [];
    };
    for (let az = -180; az <= 180; az++) {
      const h = model === 'ideal' ? 0 : profile ? profile.elevDeg[Math.round((((az % 360) + 360) % 360) / profile.stepDeg) % n] : null;
      const px = az === 180 ? PAD.l + pw : x(az);
      if (h == null) {
        if (gapStart == null) {
          gapStart = az - 1;
          flush(az - 1);
        }
        continue;
      }
      if (gapStart != null) {
        gaps.push([gapStart, az]);
        gapStart = null;
      }
      if (!run.length) runStart = az;
      run.push(`${px.toFixed(1)} ${y(h).toFixed(1)}`);
    }
    if (gapStart != null) gaps.push([gapStart, 180]);
    flush(180);
    return { fills, lines, gaps };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, model, w, range.min, range.max]);

  const trackPaths = (t: BodyTrack) => {
    const out: { d: string; state: VisState }[] = [];
    let cur: string[] = [];
    let st = t.state[0];
    let px = 0;
    for (let i = 0; i < t.az.length; i++) {
      const el = t.el[i];
      if (el == null) {
        if (cur.length > 1) out.push({ d: 'M' + cur.join('L'), state: st });
        cur = [];
        continue;
      }
      const cx = x(t.az[i]);
      const pt = `${cx.toFixed(1)} ${y(el).toFixed(1)}`;
      const jump = cur.length > 0 && Math.abs(cx - px) > pw / 2;
      if (t.state[i] !== st || jump) {
        if (!jump) cur.push(pt);
        if (cur.length > 1) out.push({ d: 'M' + cur.join('L'), state: st });
        cur = [];
        st = t.state[i];
      }
      cur.push(pt);
      px = cx;
    }
    if (cur.length > 1) out.push({ d: 'M' + cur.join('L'), state: st });
    return out;
  };

  const body = (key: Body, t: BodyTrack, state: VisState) => {
    const el = t.el[idx];
    if (el == null) return null;
    const cx = x(t.az[idx]);
    const cy = y(el);
    const hor = t.hor[idx];
    const m = t.margin[idx];
    const left = cx > PAD.l + pw - 80;
    const lit = highlight === key || highlight === 'both';
    return {
      band: lit ? <rect x={cx - 9} y={PAD.t} width={18} height={ph} className={`hl hl-${key}`} /> : null,
      glyph: key === 'sun' ? <SunGlyph x={cx} y={cy} r={6} /> : <EarthGlyph x={cx} y={cy} r={6.5} />,
      front: (
        <g className={`leader leader-${key}`}>
          {hor != null && <line x1={cx} x2={cx} y1={y(hor)} y2={cy} />}
          {hor != null && t.threshold > 0 && <line x1={cx - 8} x2={cx + 8} y1={y(hor + t.threshold)} y2={y(hor + t.threshold)} className="thr" />}
          {state !== 'vis' && <circle cx={cx} cy={cy} r={10.5} className={`ghost ghost-${state}`} />}
          <text x={cx + (left ? -15 : 15)} y={cy + 4} textAnchor={left ? 'end' : 'start'} className="margin-label">
            {m == null ? 'fără date' : fmtDeg(m, 1, true)}
          </text>
        </g>
      ),
    };
  };

  const sun = body('sun', a.sun, sunState);
  const earth = body('earth', a.earth, earthState);
  const ticks = elTicks(range);

  return (
    <div ref={ref} className="pano">
      <svg width={w} height={H} role="img" aria-label={label}>
        <defs>
          <linearGradient id={`sky${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0a1322" />
            <stop offset="1" stopColor="#13213a" />
          </linearGradient>
          <linearGradient id={`reg${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6f7a8c" />
            <stop offset="0.35" stopColor="#3a4352" />
            <stop offset="1" stopColor="#1a202b" />
          </linearGradient>
          <pattern id={`hatch${uid}`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="7" stroke="rgba(243,246,250,0.35)" strokeWidth="1.4" />
          </pattern>
          <clipPath id={`clip${uid}`}>
            <rect x={PAD.l} y={PAD.t} width={pw} height={ph} rx="6" />
          </clipPath>
        </defs>

        <rect x={PAD.l} y={PAD.t} width={pw} height={ph} rx="6" fill={`url(#sky${uid})`} />
        <g clipPath={`url(#clip${uid})`}>
          {ticks.map((e) => (
            <line key={e} x1={PAD.l} x2={PAD.l + pw} y1={y(e)} y2={y(e)} className={e === 0 ? 'grid zero' : 'grid'} />
          ))}
          {COMPASS.map((_, i) => (
            <line key={i} x1={PAD.l + (i / 8) * pw} x2={PAD.l + (i / 8) * pw} y1={PAD.t} y2={bottom} className="grid" />
          ))}
          {sun?.band}
          {earth?.band}
          {sun?.glyph}
          {earth?.glyph}
          {terrain.fills.map((d, i) => (
            <path key={i} d={d} fill={`url(#reg${uid})`} />
          ))}
          {terrain.lines.map((d, i) => (
            <path key={i} d={d} className="ridge" />
          ))}
          {terrain.gaps.map(([g0, g1], i) => (
            <g key={i}>
              <rect x={x(g0)} y={PAD.t} width={Math.max(2, x(g1) - x(g0))} height={ph} fill={`url(#hatch${uid})`} />
              <text x={(x(g0) + x(g1)) / 2} y={PAD.t + 14} textAnchor="middle" className="gap-label">
                ? no terrain data
              </text>
            </g>
          ))}
          {(['sun', 'earth'] as const).map((k) => trackPaths(a[k]).map((p, i) => <path key={k + i} d={p.d} className={`trk trk-${k} trk-${p.state}`} />))}
          {sun?.front}
          {earth?.front}
        </g>

        {ticks.map((e) => (
          <text key={e} x={PAD.l - 6} y={y(e) + 3.5} textAnchor="end" className="axis">
            {e}°
          </text>
        ))}
        {COMPASS.map((c, i) => (
          <text key={i} x={PAD.l + (i / 8) * pw} y={H - 12} textAnchor={i === 0 ? 'start' : i === 8 ? 'end' : 'middle'} className={c === 'N' ? 'axis strong' : 'axis'}>
            {c}
            {w > 460 && <tspan className="axis-sub"> {(180 + i * 45) % 360}°</tspan>}
          </text>
        ))}
      </svg>
    </div>
  );
}

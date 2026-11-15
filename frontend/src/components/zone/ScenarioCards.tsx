'use client';

import type { ReactNode } from 'react';
import type { HorizonProfile, Scenario, Site } from '@/lib/data/types';
import { sampleIndex, segAt, type Analysis, type Body, type Model } from '@/lib/logic/derive';
import { fmtDateShort, fmtDeg, fmtDeltaH, fmtUtcMs } from '@/lib/logic/format';
import { has, type Catalog, type Sel } from '@/lib/logic/scenarios';
import { BODY_NAME, BodyIcon, ChipGroup, STATE_TEXT, StatePill } from '../shared/common';
import { SkyPanorama, type ElRange } from '../shared/SkyPanorama';

const H = 3_600_000;

export interface Side {
  id: 'A' | 'B';
  sc: Scenario;
  site: Site;
  an: Analysis;
  profile: HorizonProfile | undefined;
  t0: number;
}

export function ScenarioFrame({ id, title, children }: { id: 'A' | 'B'; title: string; children: ReactNode }) {
  return (
    <section className={`card scn scn-${id}`} aria-labelledby={`scn-${id}-h`}>
      <header className="scn-h">
        <h2 id={`scn-${id}-h`}>{title}</h2>
      </header>
      {children}
    </section>
  );
}

const siteOptions = (cat: Catalog) => cat.sites.map((s) => ({ value: s.id, label: s.short }));

export function PlanAControls({ cat, sel, onChange }: { cat: Catalog; sel: Sel; onChange: (s: Sel) => void }) {
  const site = cat.sites.find((s) => s.id === sel.siteId)!;
  return (
    <div className="controls">
      <ChipGroup
        label="Site"
        value={sel.siteId}
        options={siteOptions(cat)}
        onChange={(id) => onChange({ siteId: id, startMs: sel.startMs != null && has(cat, id, sel.startMs) ? sel.startMs : null })}
      />
      <ChipGroup
        label="Start (UTC)"
        value={sel.startMs}
        options={cat.starts.map((ms) => ({ value: ms, label: fmtDateShort(ms), reason: has(cat, sel.siteId, ms) ? undefined : `not computed for ${site.short}` }))}
        onChange={(ms) => onChange({ ...sel, startMs: ms })}
      />
      <StartLine ms={sel.startMs} missing={`Choose an available start for ${site.short}; the previous start is not computed for this site.`} />
    </div>
  );
}

export function PlanBControls({ cat, a, sel, onChange }: { cat: Catalog; a: Sel; sel: Sel; onChange: (s: Sel) => void }) {
  const site = cat.sites.find((s) => s.id === sel.siteId)!;
  const reference = cat.sites.find((s) => s.id === a.siteId)?.short ?? 'the reference option';
  const delta = a.startMs != null && sel.startMs != null ? (sel.startMs - a.startMs) / H : null;
  const delays = [0, 24, 72];
  return (
    <div className="controls">
      <ChipGroup
        label="Site"
        value={sel.siteId}
        options={siteOptions(cat)}
        onChange={(id) => onChange({ siteId: id, startMs: sel.startMs != null && has(cat, id, sel.startMs) ? sel.startMs : null })}
      />
      <ChipGroup
        label={`Start relative to ${reference}`}
        value={delta != null && delays.includes(delta) ? delta : null}
        options={delays.map((dh) => ({
          value: dh,
          label: dh === 0 ? 'Same start' : `+${dh} h`,
          reason:
            a.startMs == null
              ? `choose a start for ${reference} first`
              : has(cat, sel.siteId, a.startMs + dh * H)
                ? undefined
                : `${site.short} has no data for the ${fmtDateShort(a.startMs + dh * H)} start`,
        }))}
        onChange={(dh) => a.startMs != null && onChange({ ...sel, startMs: a.startMs + dh * H })}
      />
      <StartLine
        ms={sel.startMs}
        extra={delta != null ? `${fmtDeltaH(delta)} relative to ${reference}` : undefined}
        missing={`${site.short} has no scenario at the current start. Pick one of the available delays above.`}
      />
    </div>
  );
}

function StartLine({ ms, extra, missing }: { ms: number | null; extra?: string; missing: string }) {
  if (ms == null)
    return (
      <p className="startline need" role="status">
        {missing}
      </p>
    );
  return (
    <p className="startline">
      <span className="k">Actual start</span> <b className="mono">{fmtUtcMs(ms)}</b>
      {extra && <span className="delta-chip">{extra}</span>}
    </p>
  );
}

export function Unavailable({ children }: { children: ReactNode }) {
  return <div className="unavail">{children}</div>;
}

interface EvidenceProps {
  side: Side;
  model: Model;
  cursor: number;
  range: ElRange;
  highlight: Body | 'both' | null;
}

export function ScenarioEvidence({ side, model, cursor, range, highlight }: EvidenceProps) {
  const { an } = side;
  const idx = sampleIndex(an, cursor);
  const sunState = segAt(an.sun.segs, cursor).state;
  const earthState = segAt(an.earth.segs, cursor).state;
  const label = `Horizon at ${side.site.short}, ${fmtUtcMs(side.t0 + cursor * 60_000)}: Sun ${STATE_TEXT[sunState].toLowerCase()}, Earth ${STATE_TEXT[earthState].toLowerCase()}. The values are in the table below.`;
  return (
    <div className="evidence">
      <SkyPanorama a={an} profile={side.profile} model={model} idx={idx} sunState={sunState} earthState={earthState} range={range} highlight={highlight} label={label} />
      <ReadoutTable side={side} model={model} cursor={cursor} highlight={highlight} />
    </div>
  );
}

function ReadoutTable({ side, model, cursor, highlight }: { side: Side; model: Model; cursor: number; highlight: Body | 'both' | null }) {
  const { an } = side;
  const idx = sampleIndex(an, cursor);
  return (
    <div className="readout-wrap" role="region" aria-label={`Values for ${side.site.short} at the selected moment`} tabIndex={0}>
    <table className="readout">
      <caption className="sr-only">
        Values for {side.site.short} at {fmtUtcMs(side.t0 + cursor * 60_000)}
      </caption>
      <thead>
        <tr>
          <th scope="col">Body</th>
          <th scope="col">Azimuth</th>
          <th scope="col">Elevation</th>
          <th scope="col">{model === 'ideal' ? 'Horizon' : 'Terrain'}</th>
          <th scope="col">Margin</th>
          <th scope="col">Required</th>
          <th scope="col">State</th>
        </tr>
      </thead>
      <tbody>
        {(['sun', 'earth'] as const).map((k) => {
          const t = an[k];
          const st = segAt(t.segs, cursor).state;
          const lit = highlight === k || highlight === 'both';
          return (
            <tr key={k} className={`ro-${k}${lit ? ' lit' : ''}`}>
              <th scope="row">
                <BodyIcon body={k} /> {BODY_NAME[k]}
              </th>
              <td>{fmtDeg(t.az[idx], 1)}</td>
              <td>{fmtDeg(t.el[idx], 2)}</td>
              <td>{fmtDeg(t.hor[idx], 2)}</td>
              <td className="strong">{fmtDeg(t.margin[idx], 2, true)}</td>
              <td>{t.strict ? `> ${fmtDeg(t.threshold, 0)}` : `≥ ${fmtDeg(t.threshold, 0)}`}</td>
              <td>
                <StatePill state={st} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}

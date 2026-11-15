'use client';

import { useMemo } from 'react';
import { allTransitions, seekTime } from '@/lib/logic/derive';
import { fmtDur, fmtUtcMs } from '@/lib/logic/format';
import { ChipGroup, Tag } from '../shared/common';
import type { ElRange } from '../shared/SkyPanorama';
import type { WS } from '../shared/types';
import { CauseSummary } from './CauseSummary';
import { DecisionSummary } from './DecisionSummary';
import { IntervalTable } from './EvidenceDetails';
import { PlanAControls, PlanBControls, ScenarioEvidence, ScenarioFrame, Unavailable, type Side } from './ScenarioCards';
import { SharedTimeline } from './SharedTimeline';
import { TimeChart } from './TimeChart';

import { ACTIVITIES } from '../lesson/Mission';

/** Comparația Plan A / Alternativa B (logica existentă), legată de timpul global. */
export function Comparison({ ws }: { ws: WS }) {
  const { A, B, sides, fits, model } = ws;
  const total = sides.length ? Math.min(...sides.map((s) => s.an.totalMin)) : 0;
  const step = sides[0]?.an.stepMin ?? 10;
  const outOfA = ws.cursorA == null;
  const t = Math.max(0, Math.min(ws.cursorA ?? 0, total));
  const single = ws.bundle.scenarios.length === 1;

  const range = useMemo<ElRange>(() => {
    let lo = 0;
    let hi = 0;
    const take = (v: number | null | undefined) => {
      if (v == null || !Number.isFinite(v)) return;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    };
    for (const s of sides) {
      for (const b of ['sun', 'earth'] as const) {
        s.an[b].el.forEach(take);
        s.an[b].hor.forEach((h) => take(h == null ? null : h + s.an[b].threshold));
      }
      if (model === 'terrain') s.profile?.elevDeg.forEach(take);
    }
    const pad = Math.max(0.5, (hi - lo) * 0.06);
    return { min: Math.floor((lo - pad) * 2) / 2, max: Math.ceil((hi + pad) * 2) / 2 };
  }, [A?.an, B?.an, model]); // eslint-disable-line react-hooks/exhaustive-deps

  const events = useMemo(() => {
    const ts = new Set<number>();
    for (const s of sides) for (const x of [...allTransitions(s.an).map((e) => e.t), ...s.an.segs.both.slice(1).map((g) => g.start)]) ts.add(seekTime(s.an, x));
    return [...ts].filter((x) => x <= total).sort((x, y) => x - y);
  }, [A?.an, B?.an, total]); // eslint-disable-line react-hooks/exhaustive-deps
  const prev = [...events].reverse().find((x) => x < t) ?? null;
  const next = events.find((x) => x > t) ?? null;

  const marker = ws.marker;
  const highlight = (id: 'A' | 'B') => {
    const s = sides.find((d) => d.id === id);
    return marker && marker.side === id && marker.body && s && t === seekTime(s.an, marker.t) ? marker.body : null;
  };
  const syncLabel = !B ? 'One option' : ws.change?.date ? 'Same elapsed time · different UTC dates' : 'Same UTC moment for both options';
  const trustLabel = ws.trust === 'validated' ? 'Computed · validated' : ws.bundle.validation?.status === 'partial' ? 'Computed · partly validated' : 'Computed · not validated';
  const primaryName = ws.cat.sites.find((site) => site.id === ws.selA.siteId)?.short ?? 'Reference site';
  const alternativeName = ws.cat.sites.find((site) => site.id === ws.selB?.siteId)?.short ?? 'Alternative site';

  const evidence = (s: Side | null, missing: string) =>
    s ? <ScenarioEvidence side={s} model={model} cursor={t} range={range} highlight={highlight(s.id)} /> : <Unavailable>{missing}</Unavailable>;

  return (
    <div className="comparison">
      <section className="card global" aria-label="Activity and horizon model">
        <ChipGroup label="Activity duration" value={ws.activityMin} options={ACTIVITIES.map((m) => ({ value: m, label: fmtDur(m) }))} onChange={ws.setActivityMin} />
        <ChipGroup
          label="Horizon model"
          value={model}
          options={[
            { value: 'ideal', label: 'Ideal 0°' },
            {
              value: 'terrain',
              label: ws.terrainSynthetic ? 'Terrain (simulated)' : 'Terrain',
              reason: ws.noTerrain.length ? `no terrain profile for ${ws.noTerrain.map((s) => s.short).join(', ')}` : undefined,
            },
          ]}
          onChange={ws.setModel}
        />
        <p className="model-note">
          {model === 'ideal' ? (
            <>
              <b>Ideal horizon:</b> local terrain is not modelled; the bodies are compared with the 0° plane.
            </>
          ) : ws.terrainSynthetic ? (
            <>
              <b>Simulated terrain:</b> the horizon profiles are synthetic, not from a DEM.
            </>
          ) : (
            <>
              <b>Terrain:</b> horizon profiles from the loaded data ({ws.bundle.layers?.terrain?.product ?? 'product not declared'}).
              {ws.bundle.layers?.terrain?.product === 'LRO/LROC NAC DTM' && ' For the Apollo set, the profiles cover the relief within 5 km of each lunar module.'}
            </>
          )}
        </p>
      </section>

      <div className="compare">
        <ScenarioFrame id="A" title={primaryName}>
          <PlanAControls cat={ws.cat} sel={ws.selA} onChange={ws.changeA} />
          {evidence(A, `Choose an available start for ${primaryName} to see the horizon.`)}
        </ScenarioFrame>
        <ScenarioFrame id="B" title={alternativeName}>
          {single ? (
            <Unavailable>Comparison unavailable: the loaded data has only one scenario.</Unavailable>
          ) : (
            <>
              <PlanBControls cat={ws.cat} a={ws.selA} sel={ws.selB ?? { siteId: ws.selA.siteId, startMs: null }} onChange={ws.changeB} />
              {evidence(B, 'Choose an available delay or site for the alternative.')}
            </>
          )}
        </ScenarioFrame>
      </div>

      {sides.length > 0 ? (
        <>
          <DecisionSummary
            sides={sides}
            fits={fits}
            activityMin={ws.activityMin}
            change={ws.change}
            model={model}
            trust={ws.trust}
            trustLabel={trustLabel}
            options={ws.options}
            readyFromMs={ws.readyFromMs}
            currentB={B?.sc.id ?? null}
            sites={ws.cat.sites}
            onUse={ws.useOption}
            onShow={(id, x) => ws.goEvent(id, x, null)}
          />
          {outOfA && A && (
            <p className="unavail">
              The analysed moment ({fmtUtcMs(ws.timeMs)}) is outside the period for {A.site.short} ({fmtUtcMs(A.t0)} → {fmtUtcMs(A.t0 + A.an.totalMin * 60_000)}). The comparison shows the start of the period; move
              the timeline below to get back inside it.
            </p>
          )}
          <SharedTimeline
            sides={sides}
            total={total}
            step={step}
            cursor={t}
            playing={ws.playing}
            syncLabel={syncLabel}
            marker={marker ? marker.t : null}
            prev={prev}
            next={next}
            onPlay={ws.togglePlay}
            onSeek={ws.seekElapsed}
            onReset={() => ws.seekElapsed(0)}
          />
          <section className="card charts" aria-labelledby="charts-h">
            <header className="sec-h">
              <h2 id="charts-h">Elevation over time</h2>
              <span className="muted small">Same scale for both charts · dotted lines: terrain in each body’s direction (Earth: + δ) · click or drag to move the shared moment</span>
            </header>
            <div className="chart-grid">
              {sides.map((s) => (
                <div key={s.id} className="chart-col">
                  <p className="chart-h">
                    <Tag id={s.id} label={s.site.short} small /> · from {fmtUtcMs(s.t0)}
                  </p>
                  <TimeChart
                    a={s.an}
                    startUtc={s.sc.startUtc}
                    model={model}
                    cursor={t}
                    total={total}
                    activityMin={ws.activityMin}
                    range={range}
                    marker={marker?.side === s.id ? marker.t : null}
                    onSeek={ws.seekElapsed}
                    label={`Sun and Earth elevation at ${s.site.short}, over ${fmtDur(total)}. With a keyboard, use the shared timeline or the interval table.`}
                  />
                </div>
              ))}
            </div>
          </section>
          <CauseSummary sides={sides} fits={fits} model={model} cursor={t} onEvent={ws.goEvent} />
          <IntervalTable sides={sides} />
        </>
      ) : (
        <Unavailable>Choose an available option to see the results.</Unavailable>
      )}
    </div>
  );
}

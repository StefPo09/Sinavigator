'use client';

import { useMemo } from 'react';
import { allTransitions, seekTime } from '@/lib/logic/derive';
import { fmtDur, fmtUtcMs } from '@/lib/logic/format';
import { ChipGroup, Tag } from '../shared/common';
import type { ElRange } from '../shared/SkyPanorama';
import type { WS } from '../shared/types';
import { CauseSummary } from './CauseSummary';
import { DecisionSummary } from './DecisionSummary';
import { IntervalTable, MethodsSources } from './EvidenceDetails';
import { PlanAControls, PlanBControls, ScenarioEvidence, ScenarioFrame, Unavailable, type Side } from './ScenarioCards';
import { SharedTimeline } from './SharedTimeline';
import { TimeChart } from './TimeChart';

export const ACTIVITIES = [30, 60, 120, 240];

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
  const syncLabel = !B ? 'Un singur scenariu' : ws.change?.date ? 'Același timp scurs · date UTC diferite' : 'Același moment UTC pentru ambele scenarii';
  const trustLabel = ws.trust === 'validated' ? 'Calculat · validat' : ws.bundle.validation?.status === 'partial' ? 'Calculat · validat parțial' : 'Calculat · nevalidat';
  const primaryName = ws.cat.sites.find((site) => site.id === ws.selA.siteId)?.short ?? 'Situl de referință';
  const alternativeName = ws.cat.sites.find((site) => site.id === ws.selB?.siteId)?.short ?? 'Situl alternativ';

  const evidence = (s: Side | null, missing: string) =>
    s ? <ScenarioEvidence side={s} model={model} cursor={t} range={range} highlight={highlight(s.id)} /> : <Unavailable>{missing}</Unavailable>;

  return (
    <div className="comparison">
      <section className="card global" aria-label="Activitate și model de orizont">
        <ChipGroup label="Durata activității" value={ws.activityMin} options={ACTIVITIES.map((m) => ({ value: m, label: fmtDur(m) }))} onChange={ws.setActivityMin} />
        <ChipGroup
          label="Modelul orizontului"
          value={model}
          options={[
            { value: 'ideal', label: 'Idealizat 0°' },
            {
              value: 'terrain',
              label: ws.terrainSynthetic ? 'Teren (simulat)' : 'Teren',
              reason: ws.noTerrain.length ? `fără profil de teren pentru ${ws.noTerrain.map((s) => s.short).join(', ')}` : undefined,
            },
          ]}
          onChange={ws.setModel}
        />
        <p className="model-note">
          {model === 'ideal' ? (
            <>
              <b>Orizont idealizat:</b> terenul local nu este modelat; corpurile sunt comparate cu planul de 0°.
            </>
          ) : ws.terrainSynthetic ? (
            <>
              <b>Teren simulat:</b> profilurile de orizont sunt sintetice, nu provin dintr-un DEM.
            </>
          ) : (
            <>
              <b>Teren:</b> profiluri de orizont din datele încărcate ({ws.bundle.layers?.terrain?.product ?? 'produs nedeclarat'}).
              {ws.bundle.layers?.terrain?.product === 'LRO/LROC NAC DTM' && ' Pentru setul Apollo, profilurile acoperă relieful dintr-o rază de 5 km în jurul fiecărui modul lunar.'}
            </>
          )}
        </p>
      </section>

      <div className="compare">
        <ScenarioFrame id="A" title={primaryName}>
          <PlanAControls cat={ws.cat} sel={ws.selA} onChange={ws.changeA} />
          {evidence(A, `Alege un start disponibil pentru ${primaryName} ca să vezi orizontul.`)}
        </ScenarioFrame>
        <ScenarioFrame id="B" title={alternativeName}>
          {single ? (
            <Unavailable>Comparație indisponibilă: datele încărcate conțin un singur scenariu.</Unavailable>
          ) : (
            <>
              <PlanBControls cat={ws.cat} a={ws.selA} sel={ws.selB ?? { siteId: ws.selA.siteId, startMs: null }} onChange={ws.changeB} />
              {evidence(B, 'Alege o întârziere sau o zonă disponibilă pentru scenariul alternativ.')}
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
              Momentul global ({fmtUtcMs(ws.timeMs)}) este în afara scenariului pentru {A.site.short} ({fmtUtcMs(A.t0)} → {fmtUtcMs(A.t0 + A.an.totalMin * 60_000)}). Comparația arată începutul scenariului; mută
              timeline-ul de mai jos pentru a reveni în interval.
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
              <h2 id="charts-h">Elevația în timp</h2>
              <span className="muted small">Aceeași scară pentru ambele grafice · liniile punctate: terenul în direcția fiecărui corp (Pământ: + δ) · clic sau trage pentru a muta momentul comun</span>
            </header>
            <div className="chart-grid">
              {sides.map((s) => (
                <div key={s.id} className="chart-col">
                  <p className="chart-h">
                    <Tag id={s.id} label={s.site.short} small /> · din {fmtUtcMs(s.t0)}
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
                    label={`Elevația Soarelui și a Pământului la ${s.site.short}, pe ${fmtDur(total)}. Pentru tastatură folosește timeline-ul comun sau tabelul intervalelor.`}
                  />
                </div>
              ))}
            </div>
          </section>
          <CauseSummary sides={sides} fits={fits} model={model} cursor={t} onEvent={ws.goEvent} />
          <IntervalTable sides={sides} />
        </>
      ) : (
        <Unavailable>Alege un scenariu disponibil pentru a vedea rezultatele.</Unavailable>
      )}
      <MethodsSources bundle={ws.bundle} origin={ws.origin} reason={ws.reason} warnings={ws.warnings} sides={sides} />
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { analyse, assessFit, windowLen, type Fit, type Model } from '@/lib/logic/derive';
import { changeSentence } from '@/lib/logic/explain';
import { fmtDateShort, fmtDur, fmtSignedDur, fmtUtcMs } from '@/lib/logic/format';
import { ANSWER_LABEL, conclusion, expectedAnswer, limitingWhy, type Answer } from '@/lib/logic/lesson';
import { has, startsFor, type Sel } from '@/lib/logic/scenarios';
import { ChipGroup } from '../shared/common';
import type { WS } from '../shared/types';
import type { Side } from '../zone/ScenarioCards';
import { Term } from './Term';

export const ACTIVITIES = [30, 60, 120, 240];
const VERDICT = { fits: 'Fits', none: 'Does not fit in the known period', insufficient: 'Not enough data' } as const;
const MARK = { fits: '✓', none: '✕', insufficient: '?' } as const;

const HINTS = [
  'Check the Sun: pick each site in turn and look at the timeline. Where the green or yellow band ends, the Sun sets (▼).',
  'Check the Earth: from the Apollo sites the Earth stays almost fixed in the sky. If the band says “Sun only”, the Earth is below the 2° threshold.',
  'Look for a continuous overlap: the activity needs one unbroken interval with both bodies (green band) at least as long as the chosen duration.',
];

const keyOf = (a: Sel, b: Sel | null, act: number, model: Model) => `${a.siteId}|${a.startMs}|${b?.siteId}|${b?.startMs}|${act}|${model}`;

function VariantPicker({ ws, id, sel, onChange }: { ws: WS; id: 'A' | 'B'; sel: Sel; onChange: (s: Sel) => void }) {
  const siteName = ws.cat.sites.find((s) => s.id === sel.siteId)?.short ?? sel.siteId;
  return (
    <fieldset className="variant">
      <legend>
        <span className={`vtag vtag-${id}`}>{id}</span> {siteName}
        {sel.startMs != null && <span className="mono muted small"> · {fmtUtcMs(sel.startMs)}</span>}
      </legend>
      <ChipGroup
        label="Site"
        size="sm"
        value={sel.siteId}
        options={ws.cat.sites.map((s) => ({ value: s.id, label: s.short }))}
        onChange={(siteId) => onChange({ siteId, startMs: sel.startMs != null && has(ws.cat, siteId, sel.startMs) ? sel.startMs : (startsFor(ws.cat, siteId)[0] ?? null) })}
      />
      <ChipGroup
        label="Period start (UTC)"
        size="sm"
        value={sel.startMs}
        options={ws.cat.starts.map((ms) => ({ value: ms, label: fmtDateShort(ms).replace(' · 00:00', ''), reason: has(ws.cat, sel.siteId, ms) ? undefined : `no data for ${siteName}` }))}
        onChange={(ms) => onChange({ ...sel, startMs: ms })}
      />
    </fieldset>
  );
}

/** Când se închide fereastra relevantă (prima potrivită sau cea mai lungă), în minute de la start. */
const closeOf = (f: Fit) => (f.first ?? f.longest)?.end ?? null;

function experimentText(side: Side, model: Model, other: Model, fit: Fit, otherFit: Fit): string {
  const name = other === 'ideal' ? 'the ideal 0° horizon' : 'the terrain profile';
  const same = fit.kind === otherFit.kind;
  const a = closeOf(fit);
  const b = closeOf(otherFit);
  const head = same ? `The result stays “${VERDICT[fit.kind]}”` : `The result changes: “${VERDICT[fit.kind]}” becomes “${VERDICT[otherFit.kind]}”`;
  if (a == null || b == null || Math.abs(a - b) < 1)
    return `${side.id} · ${side.site.short}: ${head}${a == null && b == null ? '; no common window in either model.' : '; the window closes at practically the same time.'}`;
  const end = (m: number) => fmtUtcMs(side.t0 + m * 60_000);
  return `${side.id} · ${side.site.short}: ${head}. With ${name} the window closes at ${end(b)}, instead of ${end(a)} with ${model === 'terrain' ? 'terrain' : 'the ideal horizon'} (${fmtSignedDur(b - a)}).`;
}

export function Mission({ ws }: { ws: WS }) {
  const { A, B, fits, model } = ws;
  const [prediction, setPrediction] = useState<Answer | null>(null);
  const [hints, setHints] = useState(0);
  const [checkedKey, setCheckedKey] = useState<string | null>(null);
  const [reflection, setReflection] = useState('');
  const [showModel, setShowModel] = useState(false);
  const selB = ws.selB ?? { siteId: ws.selA.siteId, startMs: null };
  const key = keyOf(ws.selA, ws.selB, ws.activityMin, model);
  const checked = checkedKey === key;
  const stale = checkedKey != null && !checked;
  const ready = !!A && !!B && fits.length === 2;
  const expected = ready ? expectedAnswer(fits[0], fits[1]) : null;
  const other: Model = model === 'terrain' ? 'ideal' : 'terrain';
  const otherBlocked = other === 'terrain' && ws.noTerrain.length > 0;

  const otherFits = useMemo(() => {
    if (!A || !B || otherBlocked) return null;
    return [A, B].map((s) => assessFit(analyse(s.sc, s.profile, other, ws.bundle.rules), ws.activityMin));
  }, [A, B, other, otherBlocked, ws.bundle.rules, ws.activityMin]);

  const preset = (kind: 'sites' | 'dates') => {
    if (kind === 'sites') {
      const otherSite = ws.cat.sites.find((s) => s.id !== ws.selA.siteId && ws.selA.startMs != null && has(ws.cat, s.id, ws.selA.startMs));
      if (otherSite) ws.changeB({ siteId: otherSite.id, startMs: ws.selA.startMs });
    } else {
      const starts = startsFor(ws.cat, ws.selA.siteId).filter((ms) => ms !== ws.selA.startMs);
      if (starts.length) ws.changeB({ siteId: ws.selA.siteId, startMs: starts[starts.length - 1] });
    }
  };

  const tryOtherDate = () => {
    const starts = startsFor(ws.cat, selB.siteId);
    if (!starts.length) return;
    const i = selB.startMs == null ? -1 : starts.indexOf(selB.startMs);
    ws.changeB({ siteId: selB.siteId, startMs: starts[(i + 1) % starts.length] });
    setPrediction(null);
    setHints(0);
  };

  const showCause = (s: Side, f: Fit) => {
    const why = limitingWhy(s.an, model, f);
    const t = why ? why.t : (f.first ?? f.longest)?.end ?? 0;
    ws.selectLanding(s.site.id);
    ws.seekUtc(s.t0 + t * 60_000);
    ws.setNote(`Moment of the cause for ${s.id} (${s.site.short}): ${fmtUtcMs(s.t0 + t * 60_000)}. Open the surface to see the direction.`);
  };

  return (
    <section className="mission" id="mission" aria-labelledby="mission-h">
      <header className="mission-head">
        <p className="eyebrow">Mission 1 · your exercise</p>
        <h2 id="mission-h">A rover activity needs two continuous hours with both the Sun and the Earth visible. Find a site and a date that work in the analysed period.</h2>
        <p className="muted small">
          Same rule as everywhere in the atlas: a <Term k="fereastra" />, with a <Term k="marja" />. Data covers {fmtUtcMs(ws.cov.startMs)} → {fmtUtcMs(ws.cov.endMs)}.
        </p>
        <p className="muted small">
          This activity follows the mission-planning context described by the{' '}
          <a href="https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/" target="_blank" rel="noopener noreferrer">
            Canadian Space Agency
          </a>
          ; the visibility result is still limited to this atlas&apos;s geometric model.
        </p>
      </header>

      <ol className="steps">
        <li>
          <h3>Activity duration</h3>
          <ChipGroup label="Activity duration" hideLabel value={ws.activityMin} options={ACTIVITIES.map((m) => ({ value: m, label: fmtDur(m) }))} onChange={ws.setActivityMin} />
        </li>
        <li>
          <h3>Choose two options</h3>
          <div className="row">
            <button type="button" className="btn quiet" onClick={() => preset('sites')}>
              Two sites, same date
            </button>
            <button type="button" className="btn quiet" onClick={() => preset('dates')}>
              Same site, another date
            </button>
          </div>
          <div className="variants">
            <VariantPicker ws={ws} id="A" sel={ws.selA} onChange={ws.changeA} />
            <VariantPicker ws={ws} id="B" sel={selB} onChange={ws.changeB} />
          </div>
        </li>
        <li>
          <h3>Predict</h3>
          <ChipGroup
            label="In which option does the activity fit?"
            value={prediction}
            options={(['A', 'B', 'both', 'none', 'insufficient'] as Answer[]).map((a) => ({ value: a, label: ANSWER_LABEL[a] }))}
            onChange={setPrediction}
          />
          <div className="hints">
            {HINTS.slice(0, hints).map((h, i) => (
              <p key={h} className="hint">
                <span className="label">Hint {i + 1}</span> {h}
              </p>
            ))}
            {hints < HINTS.length && (
              <button type="button" className="text-link" onClick={() => setHints((n) => n + 1)}>
                {hints === 0 ? 'Give me a hint' : 'Another hint'} ({hints + 1}/{HINTS.length})
              </button>
            )}
          </div>
        </li>
        <li>
          <h3>Check</h3>
          {stale && <p className="state-line warn">You changed the site, date, duration or model. The previous answer no longer applies; check again.</p>}
          {!ready ? (
            <p className="muted">Choose an available start for both options.</p>
          ) : (
            <button type="button" className="btn primary" disabled={!prediction} onClick={() => setCheckedKey(key)}>
              Check my prediction
            </button>
          )}
          {checked && ready && expected && (
            <div className="result" aria-live="polite">
              <p className={`verdict-line ${prediction === expected ? 'ok' : 'bad'}`}>
                <span aria-hidden="true">{prediction === expected ? '✓' : '✕'}</span>{' '}
                {prediction === expected ? 'Correct.' : `Not quite: you chose “${ANSWER_LABEL[prediction!]}”.`} The computation says: <b>{ANSWER_LABEL[expected]}</b>.
              </p>
              {[A!, B!].map((s, i) => {
                const f = fits[i];
                const c = conclusion(s.an, s.t0, f, ws.activityMin);
                const why = limitingWhy(s.an, model, f);
                return (
                  <article key={s.id} className={`outcome o-${f.kind}`}>
                    <h4>
                      <span className={`vtag vtag-${s.id}`}>{s.id}</span> {s.site.short} · <span aria-hidden="true">{MARK[f.kind]}</span> {VERDICT[f.kind]}
                    </h4>
                    <p>{c.text}</p>
                    <p className="muted small mono">Analysed period: {c.domain}</p>
                    {why && (
                      <div className="why">
                        <p>
                          <b>Why?</b> {why.text}
                        </p>
                        <button type="button" className="btn quiet" onClick={() => showCause(s, f)}>
                          Show the cause on the timeline
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
              <div className="row">
                <button type="button" className="btn" onClick={tryOtherDate}>
                  Try another date for B
                </button>
                {ws.landing && ws.stage === 'zone' && (
                  <button type="button" className="btn quiet" onClick={() => ws.go('suprafata')}>
                    See it on the surface ({ws.landing.name})
                  </button>
                )}
              </div>

              <div className="experiment">
                <h4>Experiment: {other === 'ideal' ? 'without terrain (ideal 0° horizon)' : 'with terrain (terrain profile)'}</h4>
                {otherBlocked ? (
                  <p className="muted">There is no terrain profile for {ws.noTerrain.map((s) => s.short).join(', ')}; the experiment cannot be simulated.</p>
                ) : (
                  <>
                    <p className="muted small">Same options, same duration; only the horizon used in the computation changes.</p>
                    {otherFits && (
                      <ul className="bullets">
                        {[A!, B!].map((s, i) => (
                          <li key={s.id}>{experimentText(s, model, other, fits[i], otherFits[i])}</li>
                        ))}
                      </ul>
                    )}
                    <button type="button" className="btn quiet" onClick={() => ws.setModel(other)}>
                      Use {other === 'ideal' ? 'the ideal horizon' : 'terrain'} across the atlas
                    </button>
                  </>
                )}
              </div>

              <div className="reflect">
                <label htmlFor="reflect-t">
                  <b>What changed between A and B, and why?</b> <span className="muted small">Write it in your own words; it is not sent anywhere.</span>
                </label>
                <textarea id="reflect-t" rows={3} value={reflection} onChange={(e) => setReflection(e.target.value)} />
                <button type="button" className="text-link" onClick={() => setShowModel((v) => !v)} aria-expanded={showModel}>
                  {showModel ? 'Hide the computed explanation' : 'Compare with the computed explanation'}
                </button>
                {showModel && ws.change && (
                  <p className="hint">
                    {changeSentence(ws.change, model)} Longest common window: A {fmtDur(windowLen(fits[0].longest))}, B {fmtDur(windowLen(fits[1].longest))}.
                    {ws.change.date && ' The options are on different dates; the Planner comparison aligns them on the time elapsed since each start.'}
                  </p>
                )}
              </div>
            </div>
          )}
        </li>
      </ol>
    </section>
  );
}

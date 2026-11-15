'use client';

import type { Site } from '@/lib/data/types';
import { closingCause, windowLen, type Fit, type Model } from '@/lib/logic/derive';
import { changeSentence, differenceText, VERDICT_LABEL, type Change } from '@/lib/logic/explain';
import { fmtDur, fmtSignedDur, fmtUtcMs } from '@/lib/logic/format';
import { RANKING_RULE, type AltOption } from '@/lib/logic/recommend';
import { Tag } from '../shared/common';
import type { Side } from './ScenarioCards';

export type Trust = 'synthetic' | 'unvalidated' | 'validated';

interface Props {
  sides: Side[];
  fits: Fit[];
  activityMin: number;
  change: Change | null;
  model: Model;
  trust: Trust;
  trustLabel: string;
  options: AltOption[];
  readyFromMs: number;
  currentB: string | null;
  sites: Site[];
  onUse: (o: AltOption) => void;
  onShow: (side: 'A' | 'B', t: number) => void;
}

const ICON = { fits: '✓', insufficient: '?', none: '✕' };
const LIMIT_NAME = { sun: 'the Sun', earth: 'the Earth', both: 'the Sun and Earth' } as const;

/** Ce limitează activitatea într-un scenariu: corpul care închide fereastra relevantă. */
function limitingText(side: Side, fit: Fit): string {
  const seg = fit.first ?? fit.longest;
  if (!seg) return 'No known common window in the analysed period.';
  const c = closingCause(side.an, seg);
  if (c.kind === 'period-end') return 'The window lasts until the end of the analysed period (it may be longer).';
  if (c.kind === 'unknown') return `Missing data for ${LIMIT_NAME[c.body]} after ${fmtUtcMs(side.t0 + c.t * 60_000, false)}.`;
  return `Limited by ${LIMIT_NAME[c.body]}, which drops below the horizon at ${fmtUtcMs(side.t0 + c.t * 60_000)}.`;
}

/** Varianta cea mai potrivită dintre A și B după regula afișată: încape, apoi cel mai devreme început UTC. */
function bestOf(sides: Side[], fits: Fit[]): number | null {
  let best: number | null = null;
  sides.forEach((s, i) => {
    const f = fits[i];
    if (f.kind !== 'fits' || !f.first) return;
    const start = s.t0 + f.first.start * 60_000;
    if (best == null) return void (best = i);
    const b = sides[best].t0 + fits[best].first!.start * 60_000;
    if (start < b || (start === b && windowLen(f.first) > windowLen(fits[best].first))) best = i;
  });
  return best;
}

export function DecisionSummary({ sides, fits, activityMin, change, model, trust, trustLabel, options, readyFromMs, currentB, sites, onUse, onShow }: Props) {
  const short = (id: string) => sites.find((s) => s.id === id)?.short ?? id;
  const spoken = sides.map((s, i) => `${s.site.short}: ${VERDICT_LABEL[fits[i].kind]}.`).join(' ');
  const top = options[0];
  const more = options.slice(1, 3);
  const label = trust === 'synthetic' ? 'Demo result · synthetic data' : trustLabel;
  const best = sides.length === 2 ? bestOf(sides, fits) : null;
  const startDiff =
    sides.length === 2 && fits[0].first && fits[1].first ? (sides[1].t0 + fits[1].first.start * 60_000 - (sides[0].t0 + fits[0].first.start * 60_000)) / 60_000 : null;

  return (
    <section className="card decision" aria-labelledby="decision-h">
      <header className="sec-h">
        <h2 id="decision-h">Comparison and recommendation</h2>
        <span className={`trust trust-${trust}`}>{label}</span>
        <span className="muted small">Activity: {fmtDur(activityMin)} continuous, with the Sun and Earth visible at the same time</span>
      </header>
      <p className="sr-only" aria-live="polite">
        {spoken}
      </p>

      <div className="verdicts">
        {sides.map((s, i) => {
          const f = fits[i];
          return (
            <article key={s.id} className={`verdict v-${f.kind}${best === i ? ' v-best' : ''}`}>
              <div className="v-h">
                <Tag id={s.id} label={s.site.short} />
                <span className="v-site">
                  {fmtUtcMs(s.t0)}
                </span>
                {best === i && <span className="best-chip">Best of the analysed options</span>}
              </div>
              <p className="v-main">
                <span className="v-icon" aria-hidden="true">
                  {ICON[f.kind]}
                </span>
                {VERDICT_LABEL[f.kind]}
              </p>
              {f.kind === 'fits' && f.first && (
                <p className="v-detail">
                  First suitable window <b className="mono">{fmtUtcMs(s.t0 + f.first.start * 60_000)}</b> → <b className="mono">{fmtUtcMs(s.t0 + f.first.end * 60_000)}</b>
                  <br />
                  length {fmtDur(windowLen(f.first))}
                  {f.first.truncEnd ? '+ (still open at the end of the analysed period)' : ''} · spare <b>{fmtDur(f.spareMin)}</b>
                  <button type="button" className="link" onClick={() => onShow(s.id, f.first!.start)}>
                    Show on the timeline
                  </button>
                </p>
              )}
              {f.kind === 'insufficient' && <p className="v-detail">No known window is long enough, but intervals without data could hide one. More data is needed.</p>}
              {f.kind === 'none' && (
                <p className="v-detail">
                  Longest known common window: {fmtDur(windowLen(f.longest))}.
                  {f.openAtEnd ? ' A window is still open at the end of the period; later data could extend it.' : ''}
                </p>
              )}
              <p className="v-limit">{limitingText(s, f)}</p>
            </article>
          );
        })}
      </div>

      {sides.length === 2 && change && (
        <div className="reason">
          <p>
            {best != null ? (
              <>
                <b>
                  The option for {sides[best].site.short}, starting {fmtUtcMs(sides[best].t0)}, best matches the chosen criteria
                </b>
                {startDiff != null && Math.round(startDiff) !== 0 ? ` — it starts ${fmtDur(Math.abs(startDiff))} earlier.` : '.'}
              </>
            ) : (
              <b>Neither option offers a known window long enough for the activity.</b>
            )}{' '}
            {differenceText(windowLen(fits[0].longest), windowLen(fits[1].longest), sides[0].site.short, sides[1].site.short)} {changeSentence(change, model)}
          </p>
          {startDiff != null && (
            <p className="muted small">Difference between the starts of the first suitable windows (alternative minus reference): {fmtSignedDur(startDiff)}.</p>
          )}
        </div>
      )}
      <p className="rule small">
        <b>Rule:</b> an option “fits” if the activity fits in a known common window; among those that fit, the one with the earliest UTC start is preferred.{' '}
        <b>Limits:</b> geometry only (sunlight and line of sight to Earth); not an assessment of landing safety, terrain, electrical power or radio links.
      </p>

      <div className="alt" aria-labelledby="alt-h">
        <div className="alt-h">
          <h3 id="alt-h">Earliest alternative in the loaded data</h3>
          {trust !== 'validated' && <span className="trust trust-synthetic">{trust === 'synthetic' ? 'Demo suggestion — not a mission recommendation' : 'Data not validated — preliminary only'}</span>}
        </div>
        <p className="muted small">
          From {fmtUtcMs(readyFromMs)} onwards, across {sites.length} {sites.length === 1 ? 'loaded site' : 'loaded sites'}. {RANKING_RULE}
        </p>
        {!top && <p className="alt-none">No loaded scenario from this moment on has a known {fmtDur(activityMin)} window. The analysed set offers no alternative.</p>}
        {top && (
          <ol className="alt-list">
            {[top, ...more].map((o, i) => {
              const inB = o.scenario.id === currentB;
              return (
                <li key={`${o.scenario.id}-${o.startMs}`} className={i === 0 ? 'alt-top' : ''}>
                  <span className="alt-rank">{i + 1}</span>
                  <span className="alt-body">
                    <b>{short(o.siteId)}</b> · <span className="mono">{fmtUtcMs(o.startMs)}</span> → <span className="mono">{fmtUtcMs(o.endMs, false)}</span>
                    <span className="muted">
                      {' '}
                      ({fmtDur(o.lengthMin)}
                      {o.truncatedEnd ? '+' : ''}, spare {fmtDur(o.spareMin)})
                    </span>
                  </span>
                  {inB ? (
                    <button type="button" className="btn sm" onClick={() => onShow('B', o.offsetMin)}>
                      Show the selected alternative
                    </button>
                  ) : (
                    <button type="button" className={`btn sm${i === 0 ? ' primary' : ''}`} onClick={() => onUse(o)}>
                      Use as alternative
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

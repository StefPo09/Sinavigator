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
const LIMIT_NAME = { sun: 'Soarele', earth: 'Pământul', both: 'Soarele și Pământul' } as const;

/** Ce limitează activitatea într-un scenariu: corpul care închide fereastra relevantă. */
function limitingText(side: Side, fit: Fit): string {
  const seg = fit.first ?? fit.longest;
  if (!seg) return 'Nicio fereastră comună cunoscută în perioada analizată.';
  const c = closingCause(side.an, seg);
  if (c.kind === 'period-end') return 'Fereastra durează până la capătul perioadei analizate (poate fi mai lungă).';
  if (c.kind === 'unknown') return `Date lipsă pentru ${LIMIT_NAME[c.body]} după ${fmtUtcMs(side.t0 + c.t * 60_000, false)}.`;
  return `Limitează: ${LIMIT_NAME[c.body]} coboară sub orizont la ${fmtUtcMs(side.t0 + c.t * 60_000)}.`;
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
  const label = trust === 'synthetic' ? 'Rezultat demonstrativ · date sintetice' : trustLabel;
  const best = sides.length === 2 ? bestOf(sides, fits) : null;
  const startDiff =
    sides.length === 2 && fits[0].first && fits[1].first ? (sides[1].t0 + fits[1].first.start * 60_000 - (sides[0].t0 + fits[0].first.start * 60_000)) / 60_000 : null;

  return (
    <section className="card decision" aria-labelledby="decision-h">
      <header className="sec-h">
        <h2 id="decision-h">Comparație și recomandare</h2>
        <span className={`trust trust-${trust}`}>{label}</span>
        <span className="muted small">Activitate: {fmtDur(activityMin)} continuu, cu Soarele și Pământul vizibile simultan</span>
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
                {best === i && <span className="best-chip">Cea mai potrivită dintre cele analizate</span>}
              </div>
              <p className="v-main">
                <span className="v-icon" aria-hidden="true">
                  {ICON[f.kind]}
                </span>
                {VERDICT_LABEL[f.kind]}
              </p>
              {f.kind === 'fits' && f.first && (
                <p className="v-detail">
                  Prima fereastră potrivită <b className="mono">{fmtUtcMs(s.t0 + f.first.start * 60_000)}</b> → <b className="mono">{fmtUtcMs(s.t0 + f.first.end * 60_000)}</b>
                  <br />
                  durată {fmtDur(windowLen(f.first))}
                  {f.first.truncEnd ? '+ (încă deschisă la capătul perioadei analizate)' : ''} · rezervă <b>{fmtDur(f.spareMin)}</b>
                  <button type="button" className="link" onClick={() => onShow(s.id, f.first!.start)}>
                    Arată pe timeline
                  </button>
                </p>
              )}
              {f.kind === 'insufficient' && <p className="v-detail">Nicio fereastră cunoscută nu este destul de lungă, dar intervalele fără date ar putea ascunde una. Sunt necesare mai multe date.</p>}
              {f.kind === 'none' && (
                <p className="v-detail">
                  Cea mai lungă fereastră comună cunoscută: {fmtDur(windowLen(f.longest))}.
                  {f.openAtEnd ? ' O fereastră este încă deschisă la capătul perioadei; date ulterioare ar putea-o prelungi.' : ''}
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
                  Scenariul pentru {sides[best].site.short}, cu start la {fmtUtcMs(sides[best].t0)}, se potrivește cel mai bine criteriilor alese
                </b>
                {startDiff != null && Math.round(startDiff) !== 0 ? ` — începe cu ${fmtDur(Math.abs(startDiff))} mai devreme.` : '.'}
              </>
            ) : (
              <b>Niciuna dintre variante nu oferă o fereastră cunoscută suficient de lungă pentru activitate.</b>
            )}{' '}
            {differenceText(windowLen(fits[0].longest), windowLen(fits[1].longest), sides[0].site.short, sides[1].site.short)} {changeSentence(change, model)}
          </p>
          {startDiff != null && (
            <p className="muted small">Diferența dintre începuturile primelor ferestre potrivite (alternativa față de referință): {fmtSignedDur(startDiff)}.</p>
          )}
        </div>
      )}
      <p className="rule small">
        <b>Regulă:</b> o variantă „se încadrează” dacă activitatea încape într-o fereastră comună cunoscută; dintre variantele care se încadrează, este preferată cea cu cel mai devreme început UTC.{' '}
        <b>Limitări:</b> doar geometrie (iluminare și vizibilitate spre Pământ); nu este o evaluare a siguranței aterizării, a terenului, a puterii electrice sau a legăturii radio.
      </p>

      <div className="alt" aria-labelledby="alt-h">
        <div className="alt-h">
          <h3 id="alt-h">Cea mai devreme alternativă din datele încărcate</h3>
          {trust !== 'validated' && <span className="trust trust-synthetic">{trust === 'synthetic' ? 'Sugestie demonstrativă — nu este o recomandare de misiune' : 'Date nevalidate — doar preliminar'}</span>}
        </div>
        <p className="muted small">
          De la {fmtUtcMs(readyFromMs)} încolo, pentru {sites.length} {sites.length === 1 ? 'zonă încărcată' : 'zone încărcate'}. {RANKING_RULE}
        </p>
        {!top && <p className="alt-none">Niciun scenariu încărcat care începe la sau după acest moment nu are o fereastră cunoscută de {fmtDur(activityMin)}. Setul analizat nu oferă o alternativă.</p>}
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
                      {o.truncatedEnd ? '+' : ''}, rezervă {fmtDur(o.spareMin)})
                    </span>
                  </span>
                  {inB ? (
                    <button type="button" className="btn sm" onClick={() => onShow('B', o.offsetMin)}>
                      Arată alternativa selectată
                    </button>
                  ) : (
                    <button type="button" className={`btn sm${i === 0 ? ' primary' : ''}`} onClick={() => onUse(o)}>
                      Folosește ca alternativă
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

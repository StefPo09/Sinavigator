'use client';

import { closingCause, nextEvent, windowLen, type Body, type Fit, type Model } from '@/lib/logic/derive';
import { causeText, countdownText, limitingAt } from '@/lib/logic/explain';
import { fmtDeg, fmtDur, fmtUtcMs } from '@/lib/logic/format';
import { BODY_NAME, BodyIcon, StatePill, Tag } from '../shared/common';
import type { Side } from './ScenarioCards';

interface Props {
  sides: Side[];
  fits: Fit[];
  model: Model;
  cursor: number;
  onEvent: (side: 'A' | 'B', t: number, body: Body | 'both' | null) => void;
}

export function CauseSummary({ sides, fits, model, cursor, onEvent }: Props) {
  return (
    <section className="card cause" aria-labelledby="cause-h">
      <header className="sec-h">
        <h2 id="cause-h">De ce se închide fereastra</h2>
        <span className="muted small">Propoziții-șablon completate cu valori calculate; fără model de limbaj.</span>
      </header>
      <div className="cause-grid">
        {sides.map((s, i) => {
          const f = fits[i];
          const w = f.first ?? f.longest;
          const c = w ? closingCause(s.an, w) : null;
          const lim = limitingAt(s.an, cursor);
          const end = fmtUtcMs(s.t0 + s.an.totalMin * 60_000);
          return (
            <article key={s.id} className="cause-col">
              <div className="cause-h">
                <Tag id={s.id} label={s.site.short} />
                <span>{f.first ? 'Prima fereastră potrivită' : w ? 'Cea mai lungă fereastră comună cunoscută' : 'Nicio fereastră comună'}</span>
                {w && (
                  <span className="mono muted">
                    {fmtUtcMs(s.t0 + w.start * 60_000, true)} · {fmtDur(windowLen(w))}
                  </span>
                )}
              </div>
              {c ? (
                <>
                  <p className="cause-text">{causeText(s.an, c, model, s.t0)}</p>
                  {c.kind !== 'period-end' && (
                    <button type="button" className="btn sm" onClick={() => onEvent(s.id, c.t, c.body)}>
                      Mergi la momentul închiderii
                    </button>
                  )}
                </>
              ) : (
                <p className="cause-text">Soarele și Pământul nu sunt niciodată cunoscute ca vizibile simultan în perioada analizată.</p>
              )}

              <div className="atcursor">
                <p className="k">La momentul selectat · {fmtUtcMs(s.t0 + cursor * 60_000)}</p>
                {lim.body && (
                  <p className="limit">
                    <BodyIcon body={lim.body} /> Corpul limitativ: <b>{BODY_NAME[lim.body]}</b>
                    {lim.excess != null ? (
                      <>
                        {' '}
                        · marjă rămasă peste prag <b className="mono">{fmtDeg(lim.excess, 2, true)}</b>
                      </>
                    ) : (
                      ' · terenul sau poziția lui sunt necunoscute aici'
                    )}
                  </p>
                )}
                {(['both', 'sun', 'earth'] as const).map((k) => {
                  const ev = nextEvent(s.an.segs[k], cursor);
                  return (
                    <div className="cd" key={k}>
                      <StatePill state={ev.state} label={k === 'both' ? 'Ambele' : BODY_NAME[k]} />
                      <span>{countdownText(k, ev, end)}</span>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

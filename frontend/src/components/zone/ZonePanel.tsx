'use client';

import { nextEvent, sampleIndex, segAt, windowLen, type RowKey } from '@/lib/logic/derive';
import { countdownText, VERDICT_LABEL } from '@/lib/logic/explain';
import { fmtDeg, fmtDur, fmtUtcMs } from '@/lib/logic/format';
import { scenariosCovering } from '@/lib/logic/timeline';
import { BODY_NAME, BodyIcon, StatePill } from '../shared/common';
import type { WS } from '../shared/types';

const ROW_NAME: Record<RowKey, string> = { sun: 'Iluminare (Soare)', earth: 'Vizibilitate spre Pământ', both: 'Fereastră comună' };
const STATE_WORD = { vis: 'vizibil', hid: 'ascuns', unk: 'necunoscut' } as const;

const fmtLat = (v: number) => `${Math.abs(v).toFixed(2)}° ${v < 0 ? 'S' : 'N'}`;
const fmtLon = (v: number) => {
  const l = ((((v + 180) % 360) + 360) % 360) - 180;
  return `${Math.abs(l).toFixed(2)}° ${l < 0 ? 'V' : 'E'}`;
};

/** Panoul zonei selectate: rezumatul întâi, detaliile se extind inline. */
export function ZonePanel({ ws, compact = false }: { ws: WS; compact?: boolean }) {
  const site = ws.A?.site ?? ws.cat.sites.find((s) => s.id === ws.selA.siteId);
  if (!site) return null;
  const A = ws.A;
  const covering = scenariosCovering(ws.bundle, site.id, ws.timeMs);
  const profile = ws.profileOf(site.id);

  return (
    <div className="zone-panel">
      <header className="zp-h">
        <p className="k">Zona selectată</p>
        <h2>{site.name}</h2>
        <p className="mono small">
          {fmtLat(site.latDeg)}, {fmtLon(site.lonDeg)} · {site.frame}
        </p>
        <p className="small muted">Sursa coordonatelor: {site.source}</p>
        {ws.synthetic && <p className="demo-tag">Punct demonstrativ — nu este un loc lunar documentat</p>}
        <p className="small muted">Punct de studiu: nu este un loc de aterizare sigur sau autorizat.</p>
      </header>

      <p className="zp-time">
        <span className="k">Data analizată (UTC)</span> <b className="mono">{fmtUtcMs(ws.timeMs)}</b>
      </p>

      {!A || ws.cursorA == null ? (
        <div className="unavail">
          <p>
            <b>Date insuficiente pentru acest moment.</b>{' '}
            {A ? `Scenariul ales acoperă ${fmtUtcMs(A.t0)} → ${fmtUtcMs(A.t0 + A.an.totalMin * 60_000)}.` : 'Nu este ales un start disponibil pentru această zonă.'}
          </p>
          {covering.length > 0 ? (
            <div className="row">
              {covering.map((sc) => (
                <button key={sc.id} type="button" className="btn sm" onClick={() => ws.changeA({ siteId: site.id, startMs: Date.parse(sc.startUtc) })}>
                  Folosește scenariul din {fmtUtcMs(Date.parse(sc.startUtc))}
                </button>
              ))}
            </div>
          ) : (
            A && (
              <button type="button" className="btn sm" onClick={() => ws.seekUtc(A.t0)}>
                Mergi la începutul scenariului
              </button>
            )
          )}
        </div>
      ) : (
        <ZoneSummary ws={ws} />
      )}

      <button type="button" className="btn primary wide" onClick={() => ws.go('suprafata')} disabled={!A}>
        Explorează suprafața
      </button>

      {!compact && A && ws.cursorA != null && (
        <>
          <details className="inline-more">
            <summary>Intervale de iluminare și vizibilitate spre Pământ</summary>
            {(['both', 'sun', 'earth'] as const).map((k) => (
              <div key={k} className="zp-intervals">
                <h3>{ROW_NAME[k]}</h3>
                <ul>
                  {A.an.segs[k].map((g, i) => (
                    <li key={i} className={`iv iv-${g.state}`}>
                      <span className="mono">
                        {fmtUtcMs(A.t0 + g.start * 60_000)} → {fmtUtcMs(A.t0 + g.end * 60_000, false)}
                      </span>{' '}
                      · {STATE_WORD[g.state]} · {fmtDur(g.end - g.start)}
                      {g.truncStart || g.truncEnd ? ' · trunchiat' : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </details>
          <details className="inline-more">
            <summary>Modelul orizontului, rezoluția și limitele datelor</summary>
            <dl className="kv small">
              <dt>Model folosit</dt>
              <dd>{ws.model === 'ideal' ? 'Orizont idealizat 0° (terenul este ignorat)' : ws.terrainSynthetic ? 'Profil de teren simulat (sintetic, nu dintr-un DEM)' : 'Profil de teren din date'}</dd>
              <dt>Profil de orizont</dt>
              <dd>{profile ? profile.source : 'niciun profil pentru această zonă'}</dd>
              <dt>Pas azimutal</dt>
              <dd>{profile ? `${profile.stepDeg}°` : '—'}</dd>
              <dt>Rezoluția terenului</dt>
              <dd>{profile?.resolutionM != null ? `${profile.resolutionM} m` : 'nedeclarată'}</dd>
              <dt>Rază de căutare</dt>
              <dd>{profile?.searchRadiusKm != null ? `${profile.searchRadiusKm} km` : 'nedeclarată'}</dd>
              <dt>Sectoare fără date</dt>
              <dd>{profile ? `${profile.elevDeg.filter((v) => v == null).length} din ${profile.elevDeg.length}` : '—'}</dd>
              <dt>Pas de timp</dt>
              <dd>{A.an.stepMin} min (momentele de tranziție au o precizie de aproximativ un pas)</dd>
              <dt>Înălțimea observatorului</dt>
              <dd>{site.observerHeightM} m deasupra terenului</dd>
              <dt>Prag Pământ (δ)</dt>
              <dd>{fmtDeg(ws.bundle.rules.earthMarginDeg, 0)} deasupra orizontului; setare a proiectului</dd>
            </dl>
          </details>
        </>
      )}
    </div>
  );
}

function ZoneSummary({ ws }: { ws: WS }) {
  const A = ws.A!;
  const t = ws.cursorA!;
  const idx = sampleIndex(A.an, t);
  const end = fmtUtcMs(A.t0 + A.an.totalMin * 60_000);
  const both = segAt(A.an.segs.both, t);
  const fit = ws.fits[0];
  const remaining = both.state === 'vis' ? both.end - t : 0;

  return (
    <div className="zp-summary">
      <table className="readout">
        <caption className="sr-only">Soarele și Pământul văzute din zona selectată</caption>
        <thead>
          <tr>
            <th scope="col">Corp</th>
            <th scope="col">Elevație</th>
            <th scope="col">Azimut</th>
            <th scope="col">Stare</th>
          </tr>
        </thead>
        <tbody>
          {(['sun', 'earth'] as const).map((k) => (
            <tr key={k} className={`ro-${k}`}>
              <th scope="row">
                <BodyIcon body={k} /> {BODY_NAME[k]}
              </th>
              <td className="mono">{fmtDeg(A.an[k].el[idx], 2)}</td>
              <td className="mono">{fmtDeg(A.an[k].az[idx], 1)}</td>
              <td>
                <StatePill state={segAt(A.an[k].segs, t).state} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">Vizibilitate geometrică față de {ws.model === 'ideal' ? 'orizontul idealizat de 0°' : 'profilul de teren'} (centrul corpului).</p>

      <div className="zp-window">
        <StatePill state={both.state} label={both.state === 'vis' ? 'Fereastră comună deschisă' : both.state === 'hid' ? 'Fără fereastră comună' : 'Fereastră necunoscută'} />
        {both.state === 'vis' && (
          <p>
            Durata ferestrei comune: <b>{fmtDur(windowLen(both))}</b>
            {both.truncStart || both.truncEnd ? '+' : ''} · rămas <b>{fmtDur(remaining)}</b>.{' '}
            {remaining >= ws.activityMin ? `Activitatea de ${fmtDur(ws.activityMin)} încape dacă începe acum.` : `Activitatea de ${fmtDur(ws.activityMin)} nu mai încape în fereastra curentă.`}
          </p>
        )}
      </div>

      <ul className="zp-events">
        {(['both', 'sun', 'earth'] as const).map((k) => (
          <li key={k}>
            <span className="k">{ROW_NAME[k]}</span> {countdownText(k, nextEvent(A.an.segs[k], t), end)}
          </li>
        ))}
      </ul>

      <p className={`zp-verdict v-${fit.kind}`}>
        <b>{VERDICT_LABEL[fit.kind]}</b> — activitatea de {fmtDur(ws.activityMin)} în scenariul analizat ({fmtUtcMs(A.t0)} → {end}).
        {fit.kind === 'fits' && fit.first ? ` Prima fereastră potrivită: ${fmtUtcMs(A.t0 + fit.first.start * 60_000)}.` : ''}
      </p>
    </div>
  );
}

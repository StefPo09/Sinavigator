'use client';

import { LANDING_SITES, QUALITY_LABEL, type LandingSite } from '@/lib/data/landingSites';
import { assessFit, segAt, type Body, type Model, type VisState } from '@/lib/logic/derive';
import { fmtDeg, fmtDur, fmtUtcMs } from '@/lib/logic/format';
import { BODY_NOM, cardinal, conclusion, limitingWhy, scenarioAt, whyAt, type Why } from '@/lib/logic/lesson';
import type { WS } from '../shared/types';
import { Term } from '../lesson/Term';

export const fmtLat = (v: number) => `${Math.abs(v).toFixed(4)}° ${v < 0 ? 'S' : 'N'}`;
export const fmtLon = (v: number) => `${Math.abs(v).toFixed(4)}° ${v < 0 ? 'W' : 'E'}`;
const VERDICT = { fits: 'Fits', none: 'Does not fit', insufficient: 'Not enough data' } as const;

const STATE_WORD: Record<Why['kind'], string> = {
  visible: 'visible',
  'below-ideal': 'below horizon',
  terrain: 'hidden by terrain',
  threshold: 'below threshold',
  unknown: 'unknown',
};

/** One body's state at the analysed moment, with the active rule: values, cause and one sentence. */
export function BodyLine({ why, state }: { why: Why; state: VisState }) {
  return (
    <div className={`body-line bl-${why.body}`}>
      <p className="bl-head">
        <span className={`body-chip chip-${why.body}`} aria-hidden="true" />
        <b>{BODY_NOM[why.body].replace('The ', '')}</b>
        <span className={`state state-${state}`}>
          <span aria-hidden="true">{state === 'vis' ? '●' : state === 'hid' ? '○' : '?'}</span> {STATE_WORD[why.kind]}
        </span>
      </p>
      <p className="mono small bl-values">
        El {fmtDeg(why.el, 1)} · Az {fmtDeg(why.az, 0)} {why.az != null ? cardinal(why.az) : ''} · terrain {fmtDeg(why.hor, 1)}
      </p>
    </div>
  );
}

/** The local sky at `timeMs`, from the scenario that covers that moment. */
export function localSky(ws: WS, siteId: string) {
  const sc = scenarioAt(ws.bundle.scenarios, siteId, ws.timeMs);
  const an = sc ? ws.analyses.get(sc.id) : undefined;
  if (!sc || !an) return null;
  const t0 = Date.parse(sc.startUtc);
  const t = (ws.timeMs - t0) / 60_000;
  const body = (b: Body) => ({ why: whyAt(an, ws.model, b, t), state: segAt(an[b].segs, t).state });
  return { sc, an, t0, t, sun: body('sun'), earth: body('earth') };
}

export function modelLabel(m: Model, terrainProduct?: string) {
  return m === 'ideal' ? 'ideal 0° horizon' : `terrain profile${terrainProduct ? ` (${terrainProduct}, 5 km radius)` : ''}`;
}

function SiteChooser({ ws }: { ws: WS }) {
  return (
    <div className="insp-section">
      <h2 className="insp-h">Choose a landing site</h2>
      <p className="muted small">The globe markers show the same two sites. Selecting one shows its data; walking on the surface is a separate button.</p>
      <ul className="site-cards">
        {LANDING_SITES.map((l) => (
          <li key={l.id}>
            <button type="button" className="site-card" onClick={() => ws.selectLanding(l.id)}>
              <b>{l.name}</b>
              <span className="mono small">
                {fmtLat(l.latDeg)}, {fmtLon(l.lonDeg)}
              </span>
              <span className="small muted">{l.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ModelSwitch({ ws }: { ws: WS }) {
  return (
    <div className="seg" role="group" aria-label="Horizon used in the conclusions">
      {(['terrain', 'ideal'] as const).map((m) => {
        const blocked = m === 'terrain' && ws.noTerrain.length > 0;
        return (
          <button key={m} type="button" className={ws.model === m ? 'on' : ''} aria-pressed={ws.model === m} disabled={blocked} onClick={() => ws.setModel(m)}>
            {m === 'terrain' ? 'Terrain' : 'Ideal 0°'}
          </button>
        );
      })}
    </div>
  );
}

/** Does the chosen activity fit in the period that contains the analysed moment? */
export function SiteConclusion({ ws, site }: { ws: WS; site: Pick<LandingSite, 'id' | 'name'> }) {
  const sky = localSky(ws, site.id);
  if (!sky) return <p className="muted">The analysed moment is outside the data for {site.name}. Move the timeline into the marked range.</p>;
  const fit = assessFit(sky.an, ws.activityMin);
  const c = conclusion(sky.an, sky.t0, fit, ws.activityMin);
  const why = limitingWhy(sky.an, ws.model, fit);
  return (
    <div className={`conclusion c-${fit.kind}`}>
      <p className="c-verdict">
        <span aria-hidden="true">{fit.kind === 'fits' ? '✓' : fit.kind === 'none' ? '✕' : '?'}</span> {VERDICT[fit.kind]}
      </p>
      <p>{c.text}</p>
      {why && (
        <p className="why-inline">
          <b>Why?</b> {why.text}
        </p>
      )}
      <p className="muted small">
        Period: <span className="mono">{c.domain}</span> · {modelLabel(ws.model)}
      </p>
    </div>
  );
}

export function SiteInspector({ ws }: { ws: WS }) {
  const l = ws.landing;
  if (!l) return <SiteChooser ws={ws} />;
  const sky = localSky(ws, l.id);
  const hist = new Date(l.landingUtc);
  const terrain = ws.bundle.layers?.terrain;
  const profile = ws.profileOf(l.id);
  const terrainUrl =
    l.id === 'apollo17'
      ? 'https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_DTM_APOLLO17'
      : l.id === 'apollo15'
        ? 'https://data.lroc.im-ldi.com/lroc/view_rdr_product/NAC_DTM_APOLLO15'
        : null;
  return (
    <>
      <div className="insp-section">
        <p className="mono coords">
          {fmtLat(l.latDeg)} · {fmtLon(l.lonDeg)}
        </p>
        <p>{l.blurb}</p>
        <p className="muted small">
          {l.mission.split(' · ').slice(0, 2).join(' · ')}: historic landing {hist.getUTCFullYear()}-{String(hist.getUTCMonth() + 1).padStart(2, '0')}-{String(hist.getUTCDate()).padStart(2, '0')}. Coordinates: {QUALITY_LABEL[l.quality]}.
        </p>
        <p className="muted small">
          Map context:{' '}
          <a href="https://trek.nasa.gov/moon/" target="_blank" rel="noopener noreferrer">
            NASA Moon Trek
          </a>{' '}
          · terrain inspection:{' '}
          <a href="https://quickmap.lroc.asu.edu/" target="_blank" rel="noopener noreferrer">
            LROC QuickMap
          </a>
          {terrainUrl && (
            <>
              {' '}
              · local model:{' '}
              <a href={terrainUrl} target="_blank" rel="noopener noreferrer">
                LROC terrain
              </a>
            </>
          )}
          <span className="sr-only"> (opens external resources in a new tab)</span>
        </p>
      </div>

      <div className="insp-section">
        <div className="insp-row">
          <h2 className="insp-h">{fmtDur(ws.activityMin)} activity</h2>
          <ModelSwitch ws={ws} />
        </div>
        <SiteConclusion ws={ws} site={l} />
        <button type="button" className="btn insp-mission" onClick={ws.showMission}>
          Start the mission ↓
        </button>
      </div>

      <div className="insp-section">
        <h2 className="insp-h">
          Local sky · <span className="mono">{fmtUtcMs(ws.timeMs, false)}</span>
        </h2>
        {sky ? (
          <>
            <BodyLine {...sky.sun} />
            <BodyLine {...sky.earth} />
            <p className="muted small">
              <Term k="elevatie">Elevation</Term>, <Term k="azimut" /> and <Term k="orizont" /> at the 10-minute sample at or after the chosen moment.
            </p>
          </>
        ) : (
          <p className="muted">No computed positions for this moment.</p>
        )}
      </div>

      <button type="button" className="btn primary wide insp-enter" onClick={() => ws.go('suprafata')} disabled={!!ws.flight}>
        {ws.flight === 'site' ? 'Descending to the site…' : `Walk on the surface · ${l.name}`}
      </button>

      <details className="insp-more">
        <summary>What data we have for this site</summary>
        <dl className="kv">
          <dt>Sun and Earth</dt>
          <dd>{ws.bundle.layers?.geometry?.product ?? 'not declared'}, samples every 10 min</dd>
          <dt>Local horizon</dt>
          <dd>
            {terrain?.product ?? 'not declared'}
            {profile?.searchRadiusKm ? `, ${profile.searchRadiusKm} km radius` : ', 5 km radius (as declared in the metadata)'}, {profile?.stepDeg ?? '—'}° steps; derived from simplified meshes
          </dd>
          <dt>Validation</dt>
          <dd>{ws.bundle.validation?.status === 'validated' ? 'validated' : 'not independently validated'}</dd>
          <dt>3D terrain</dt>
          <dd>{l.terrain ? 'LROC NAC DTM + NAC orthophoto; the fine regolith detail is illustrative' : 'procedural, illustrative'}</dd>
          <dt>Coordinate source</dt>
          <dd>{l.source}</dd>
        </dl>
      </details>
    </>
  );
}

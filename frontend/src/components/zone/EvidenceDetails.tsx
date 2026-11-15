'use client';

import { EPHEMERIS_LABEL } from '@/lib/logic/ephemeris';
import { TEXTURE_CREDITS } from '../shared/bodies';
import type { Bundle, LayerMeta } from '@/lib/data/types';
import type { RowKey, VisState } from '@/lib/logic/derive';
import { fmtDeg, fmtDur, fmtUtcMs } from '@/lib/logic/format';
import type { Side } from './ScenarioCards';

const ROW: Record<RowKey, string> = { sun: 'Sun', earth: 'Earth', both: 'Both' };
const ST: Record<VisState, string> = { vis: 'visible', hid: 'hidden', unk: 'unknown' };

export function IntervalTable({ sides }: { sides: Side[] }) {
  return (
    <details className="card disclosure" id="intervals">
      <summary>
        <span>Interval table</span>
        <span className="muted small">Every computed interval, readable without charts</span>
      </summary>
      <div className="table-wrap" role="region" aria-label="Interval table, scrollable" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">Option</th>
              <th scope="col">Row</th>
              <th scope="col">State</th>
              <th scope="col">Start (UTC)</th>
              <th scope="col">End (UTC)</th>
              <th scope="col">Length</th>
              <th scope="col">Cut</th>
            </tr>
          </thead>
          <tbody>
            {sides.flatMap((s) =>
              (['both', 'sun', 'earth'] as RowKey[]).flatMap((k) =>
                s.an.segs[k].map((g, i) => (
                  <tr key={s.id + k + i}>
                    <td>{s.site.short}</td>
                    <td>{ROW[k]}</td>
                    <td>{ST[g.state]}</td>
                    <td className="mono">{fmtUtcMs(s.t0 + g.start * 60_000)}</td>
                    <td className="mono">{fmtUtcMs(s.t0 + g.end * 60_000)}</td>
                    <td className="mono">{fmtDur(g.end - g.start)}</td>
                    <td>{g.truncStart && g.truncEnd ? 'both ends' : g.truncStart ? 'start' : g.truncEnd ? 'end' : '—'}</td>
                  </tr>
                )),
              ),
            )}
          </tbody>
        </table>
      </div>
    </details>
  );
}

const EXTERNAL = [
  { name: 'LROC QuickMap', url: 'https://quickmap.lroc.asu.edu/', use: 'Inspecting the sites and identifying terrain/image products (those products are cited).' },
  { name: 'NASA Moon Trek', url: 'https://trek.nasa.gov/moon/', use: 'Lunar map and layers for locating the Apollo sites.' },
  { name: 'JPL Horizons', url: 'https://ssd.jpl.nasa.gov/horizons/', use: 'Source of the Sun and Earth ephemerides in the Apollo set.' },
  { name: 'LROC coordinates of the Apollo modules', url: 'https://lroc.im-ldi.com/data/support/downloads/2016_LROC_Coordinates_of_Human_Features.pdf', use: 'Latitude and longitude of the landing sites.' },
  { name: 'LROC Apollo 17 model', url: 'https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_DTM_APOLLO17', use: 'Source of the regional terrain in the Taurus–Littrow valley.' },
  { name: 'LROC Apollo 15 model', url: 'https://data.lroc.im-ldi.com/lroc/view_rdr_product/NAC_DTM_APOLLO15', use: 'Source of the terrain near the Hadley–Apennine landing site.' },
];

const layerText = (l: LayerMeta | undefined) =>
  l ? `${l.source}${l.product ? ` · ${l.product}` : ''}${l.version ? ` ${l.version}` : ''}${l.retrievedAt ? ` · retrieved ${l.retrievedAt}` : ''} — ${l.description}` : 'not declared in the data file';

export function MethodsSources({ bundle, origin, reason, warnings, sides, embedded = false }: { bundle: Bundle; origin: 'file' | 'fixture'; reason?: string; warnings: string[]; sides: Side[]; embedded?: boolean }) {
  const body = <MethodsBody bundle={bundle} origin={origin} reason={reason} warnings={warnings} sides={sides} />;
  if (embedded) return body;
  return (
    <details className="disclosure" id="methods">
      <summary>
        <span>Methods and sources</span>
        <span className="muted small">Data provenance, validation, rules, conventions, limits, credits</span>
      </summary>
      {body}
    </details>
  );
}

function MethodsBody({ bundle, origin, reason, warnings, sides }: { bundle: Bundle; origin: 'file' | 'fixture'; reason?: string; warnings: string[]; sides: Side[] }) {
  const synthetic = bundle.provenance === 'fixture';
  const steps = [...new Set(bundle.scenarios.map((s) => s.stepMin))];
  const v = bundle.validation;
  return (
      <div className="methods">
        {synthetic && (
          <p className="warn">
            <b>Synthetic demo data.</b> {bundle.note} {origin === 'fixture' && reason ? reason : ''} A valid <code>public/data/bundle.json</code> replaces it automatically.
          </p>
        )}

        <h3>Data</h3>
        <dl className="kv">
          <dt>Provenance</dt>
          <dd>{synthetic ? 'Synthetic set (fixture)' : 'Computed (as declared by the data file)'}</dd>
          <dt>Validation</dt>
          <dd>{v ? `${v.status.replace('-', ' ')} — ${v.summary}` : 'No validation record in the data file'}</dd>
          <dt>Geometry layer</dt>
          <dd>{layerText(bundle.layers?.geometry)}</dd>
          <dt>Terrain layer</dt>
          <dd>{layerText(bundle.layers?.terrain)}</dd>
          <dt>Generated</dt>
          <dd className="mono">{fmtUtcMs(Date.parse(bundle.generatedAt))}</dd>
          <dt>Time step</dt>
          <dd>{steps.join(', ')} min between samples</dd>
          <dt>Scenarios</dt>
          <dd>
            {bundle.scenarios.length} ({bundle.sites.length} sites); periods of {[...new Set(bundle.scenarios.map((s) => s.durationH))].join(', ')} h
          </dd>
        </dl>
        {warnings.length > 0 && (
          <ul className="notes">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}

        <h3>Visibility rules</h3>
        <ul>
          <li>
            Margin = elevation of the body’s centre − terrain angle in its direction: <code>M = El − H(Az)</code>.
          </li>
          <li>
            Sun: visible when <code>M &gt; {fmtDeg(bundle.rules.sunMarginDeg, 0)}</code> (the disc centre, not the whole disc).
          </li>
          <li>
            Earth: visible when <code>M ≥ δ = {fmtDeg(bundle.rules.earthMarginDeg, 0)}</code>. δ is a project setting, not a NASA requirement.
          </li>
          <li>The activity must fit in one continuous interval in which both conditions hold.</li>
          <li>Missing values stay unknown; they are never treated as hidden or as zero.</li>
        </ul>

        <h3>Method and precision</h3>
        <ul>
          {bundle.assumptions?.map((assumption) => <li key={assumption}>{assumption}</li>)}
          <li>Each body’s transitions are placed by linear interpolation between neighbouring samples, then the two bodies’ intervals are intersected. Event times are precise to about one step ({steps.join("/")} min).</li>
          <li>A known state is trusted only up to the last known sample; intervals next to missing samples are unknown.</li>
          <li>A change shorter than one step that leaves no trace in the samples cannot be detected.</li>
          <li>Windows touching the start or end of the analysed period are marked as cut; they may be longer.</li>
          <li>When options start on different dates, the cursor shows the same elapsed time from each start.</li>
        </ul>

        <h3>Conventions</h3>
        <ul>
          <li>Azimuth 0° = north, 90° = east. Elevation is relative to the observer’s local horizontal plane. Angles in degrees; time in UTC.</li>
          <li>No atmospheric refraction (airless body). The panorama’s vertical scale is stretched; the body symbols are not to scale.</li>
          <li>Sun–Earth–Moon system scene: {EPHEMERIS_LABEL}</li>
          {sides.map((s) => (
            <li key={s.id}>
              {s.site.name}, lat {fmtDeg(s.site.latDeg, 2)}, lon {fmtDeg(s.site.lonDeg, 2)}, frame {s.site.frame}, observer {s.site.observerHeightM} m above the ground. Terrain profile:{' '}
              {s.profile ? `${s.profile.source}; azimuth step ${s.profile.stepDeg}°; resolution ${s.profile.resolutionM ?? 'not declared'}${s.profile.resolutionM ? ' m' : ''}; search radius ${s.profile.searchRadiusKm ?? 'not declared'}${s.profile.searchRadiusKm ? ' km' : ''}` : 'none'}
              . Site source: {s.site.source}.
            </li>
          ))}
        </ul>

        <h3>What this tool does not claim</h3>
        <ul>
          <li>A visible Sun does not guarantee electrical power or thermal safety.</li>
          <li>A geometrically visible Earth does not guarantee a radio link.</li>
          <li>Eclipses and occultations are not modelled. A finite terrain profile is not a complete horizon.</li>
          <li>The results are preliminary comparisons, not mission analysis or a landing-safety assessment. A study point is not a safe or approved landing site.</li>
        </ul>

        <h3>External resources</h3>
        <p className="muted small">Listed as citations and planned sources. The page queries none of them live, and none is integrated unless the data file declares it above.</p>
        <ul className="ext">
          {EXTERNAL.map((r) => (
            <li key={r.url}>
              <a href={r.url} target="_blank" rel="noopener noreferrer">
                {r.name}
                <span className="sr-only"> (opens an external site in a new tab)</span>
                <span aria-hidden="true"> ↗</span>
              </a>{' '}
              — {r.use}
            </li>
          ))}
        </ul>

        <h3>Credits</h3>
        <p className="muted small">
          Interface built with Next.js, React and TypeScript; 3D scenes with Three.js; Space Grotesk and JetBrains Mono fonts (SIL Open Font License) via Fontsource. {TEXTURE_CREDITS}
        </p>
        <h3>AI statement</h3>
        <p className="small">{AI_DISCLOSURE}</p>
        <p className="muted small">Sinavigator is an independent project for the NASA Space Apps Challenge 2026. It is not affiliated with NASA; NASA/JPL/LROC data are cited as sources.</p>
      </div>
  );
}

export const AI_DISCLOSURE = 'The interface code was written with AI assistance (Claude, Anthropic) and reviewed by the team. The explanations in the app are template sentences filled with computed values; no language model runs in the app.';

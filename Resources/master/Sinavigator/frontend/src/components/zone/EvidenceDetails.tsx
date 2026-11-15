'use client';

import { EPHEMERIS_LABEL } from '@/lib/logic/ephemeris';
import { TEXTURE_CREDITS } from '../shared/bodies';
import type { Bundle, LayerMeta } from '@/lib/data/types';
import type { RowKey, VisState } from '@/lib/logic/derive';
import { fmtDeg, fmtDur, fmtUtcMs } from '@/lib/logic/format';
import type { Side } from './ScenarioCards';

const ROW: Record<RowKey, string> = { sun: 'Soare', earth: 'Pământ', both: 'Ambele' };
const ST: Record<VisState, string> = { vis: 'vizibil', hid: 'ascuns', unk: 'necunoscut' };

export function IntervalTable({ sides }: { sides: Side[] }) {
  return (
    <details className="card disclosure" id="intervals">
      <summary>
        <span>Tabelul intervalelor</span>
        <span className="muted small">Toate intervalele calculate, lizibile fără grafice</span>
      </summary>
      <div className="table-wrap" role="region" aria-label="Tabelul intervalelor, derulabil" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">Scenariu</th>
              <th scope="col">Rând</th>
              <th scope="col">Stare</th>
              <th scope="col">Start (UTC)</th>
              <th scope="col">Sfârșit (UTC)</th>
              <th scope="col">Durată</th>
              <th scope="col">Trunchiat</th>
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
                    <td>{g.truncStart && g.truncEnd ? 'ambele capete' : g.truncStart ? 'început' : g.truncEnd ? 'sfârșit' : '—'}</td>
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
  { name: 'LROC QuickMap', url: 'https://quickmap.lroc.asu.edu/', use: 'Inspectarea zonelor și identificarea produselor de teren/imagini (se citează acele produse).' },
  { name: 'NASA Moon Trek', url: 'https://trek.nasa.gov/moon/', use: 'Harta lunară și straturile pentru localizarea zonelor Apollo.' },
  { name: 'JPL Horizons', url: 'https://ssd.jpl.nasa.gov/horizons/', use: 'Sursa efemeridelor Soarelui și Pământului din setul Apollo.' },
  { name: 'Coordonatele LROC ale modulelor Apollo', url: 'https://lroc.im-ldi.com/data/support/downloads/2016_LROC_Coordinates_of_Human_Features.pdf', use: 'Latitudinea și longitudinea locurilor de aterizare.' },
  { name: 'Modelul LROC Apollo 17', url: 'https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_DTM_APOLLO17', use: 'Sursa terenului regional din valea Taurus–Littrow.' },
  { name: 'Modelul LROC Apollo 15', url: 'https://data.lroc.im-ldi.com/lroc/view_rdr_product/NAC_DTM_APOLLO15', use: 'Sursa terenului de lângă locul de aterizare Hadley–Apennine.' },
];

const layerText = (l: LayerMeta | undefined) =>
  l ? `${l.source}${l.product ? ` · ${l.product}` : ''}${l.version ? ` ${l.version}` : ''}${l.retrievedAt ? ` · preluat ${l.retrievedAt}` : ''} — ${l.description}` : 'nedeclarat în fișierul de date';

export function MethodsSources({ bundle, origin, reason, warnings, sides }: { bundle: Bundle; origin: 'file' | 'fixture'; reason?: string; warnings: string[]; sides: Side[] }) {
  const synthetic = bundle.provenance === 'fixture';
  const steps = [...new Set(bundle.scenarios.map((s) => s.stepMin))];
  const v = bundle.validation;
  return (
    <details className="card disclosure" id="methods">
      <summary>
        <span>Metode și surse</span>
        <span className="muted small">Proveniența datelor, validare, reguli, convenții, limitări, credite</span>
      </summary>
      <div className="methods">
        {synthetic && (
          <p className="warn">
            <b>Date demonstrative sintetice.</b> {bundle.note} {origin === 'fixture' && reason ? reason : ''} Un fișier valid <code>public/data/bundle.json</code> le înlocuiește automat.
          </p>
        )}

        <h3>Date</h3>
        <dl className="kv">
          <dt>Proveniență</dt>
          <dd>{synthetic ? 'Set sintetic (fixture)' : 'Calculat (declarat de fișierul de date)'}</dd>
          <dt>Validare</dt>
          <dd>{v ? `${v.status.replace('-', ' ')} — ${v.summary}` : 'Nicio înregistrare de validare în fișierul de date'}</dd>
          <dt>Stratul de geometrie</dt>
          <dd>{layerText(bundle.layers?.geometry)}</dd>
          <dt>Stratul de teren</dt>
          <dd>{layerText(bundle.layers?.terrain)}</dd>
          <dt>Generat</dt>
          <dd className="mono">{fmtUtcMs(Date.parse(bundle.generatedAt))}</dd>
          <dt>Pas de timp</dt>
          <dd>{steps.join(', ')} min între eșantioane</dd>
          <dt>Scenarii</dt>
          <dd>
            {bundle.scenarios.length} ({bundle.sites.length} zone); perioade de {[...new Set(bundle.scenarios.map((s) => s.durationH))].join(', ')} h
          </dd>
        </dl>
        {warnings.length > 0 && (
          <ul className="notes">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}

        <h3>Reguli de vizibilitate</h3>
        <ul>
          <li>
            Marjă = elevația centrului corpului − unghiul terenului în direcția lui: <code>M = El − H(Az)</code>.
          </li>
          <li>
            Soarele: vizibil când <code>M &gt; {fmtDeg(bundle.rules.sunMarginDeg, 0)}</code> (centrul discului, nu întregul disc).
          </li>
          <li>
            Pământul: vizibil când <code>M ≥ δ = {fmtDeg(bundle.rules.earthMarginDeg, 0)}</code>. δ este o setare a proiectului, nu o cerință NASA.
          </li>
          <li>Activitatea trebuie să încapă într-un singur interval continuu în care ambele condiții sunt îndeplinite.</li>
          <li>Valorile lipsă rămân necunoscute; nu sunt tratate niciodată ca ascunse sau ca zero.</li>
        </ul>

        <h3>Metodă și precizie</h3>
        <ul>
          {bundle.assumptions?.map((assumption) => <li key={assumption}>{assumption}</li>)}
          <li>Tranzițiile fiecărui corp sunt plasate prin interpolare liniară între eșantioane vecine, apoi intervalele celor două corpuri se intersectează. Momentele evenimentelor au o precizie de aproximativ un pas ({steps.join('/')} min).</li>
          <li>O stare cunoscută este considerată sigură doar până la ultimul eșantion cunoscut; intervalele de lângă eșantioane lipsă sunt necunoscute.</li>
          <li>O variație mai scurtă de un pas, care nu lasă urme în eșantioane, nu poate fi detectată.</li>
          <li>Ferestrele care ating începutul sau sfârșitul perioadei analizate sunt marcate ca trunchiate; pot fi mai lungi.</li>
          <li>Când scenariile încep la date diferite, cursorul arată același timp scurs de la fiecare start.</li>
        </ul>

        <h3>Convenții</h3>
        <ul>
          <li>Azimut 0° = nord, 90° = est. Elevația este relativă la planul orizontal local al observatorului. Unghiuri în grade; timp în UTC.</li>
          <li>Fără refracție atmosferică (corp fără atmosferă). Scara verticală a panoramei este întinsă; simbolurile corpurilor nu sunt la scară.</li>
          <li>Scena sistemului Soare–Pământ–Lună: {EPHEMERIS_LABEL}</li>
          {sides.map((s) => (
            <li key={s.id}>
              {s.site.name}, lat {fmtDeg(s.site.latDeg, 2)}, lon {fmtDeg(s.site.lonDeg, 2)}, sistem {s.site.frame}, observator la {s.site.observerHeightM} m deasupra terenului. Profil de teren:{' '}
              {s.profile ? `${s.profile.source}; pas azimutal ${s.profile.stepDeg}°; rezoluție ${s.profile.resolutionM ?? 'nedeclarată'}${s.profile.resolutionM ? ' m' : ''}; rază de căutare ${s.profile.searchRadiusKm ?? 'nedeclarată'}${s.profile.searchRadiusKm ? ' km' : ''}` : 'niciunul'}
              . Sursa zonei: {s.site.source}.
            </li>
          ))}
        </ul>

        <h3>Ce nu afirmă acest instrument</h3>
        <ul>
          <li>Un Soare vizibil nu garantează putere electrică sau siguranță termică.</li>
          <li>Un Pământ vizibil geometric nu garantează legătura radio.</li>
          <li>Eclipsele și ocultațiile nu sunt modelate. Un profil de teren finit nu este un orizont complet.</li>
          <li>Rezultatele sunt comparații preliminare, nu analiză de misiune și nici evaluarea siguranței aterizării. Un punct de studiu nu este un loc de aterizare sigur sau autorizat.</li>
        </ul>

        <h3>Resurse externe</h3>
        <p className="muted small">Listate ca citări și surse planificate. Pagina nu interoghează niciuna în timp real și niciuna nu este integrată decât dacă fișierul de date o declară mai sus.</p>
        <ul className="ext">
          {EXTERNAL.map((r) => (
            <li key={r.url}>
              <a href={r.url} target="_blank" rel="noopener noreferrer">
                {r.name}
                <span className="sr-only"> (deschide un site extern într-o filă nouă)</span>
                <span aria-hidden="true"> ↗</span>
              </a>{' '}
              — {r.use}
            </li>
          ))}
        </ul>

        <h3>Credite</h3>
        <p className="muted small">
          Interfață construită cu Next.js, React și TypeScript; scene 3D cu Three.js; fonturi Space Grotesk și JetBrains Mono (SIL Open Font License) prin Fontsource. {TEXTURE_CREDITS} Codul interfeței a fost scris cu asistență AI (Claude, Anthropic) și revizuit de echipă.
        </p>
      </div>
    </details>
  );
}

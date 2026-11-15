// Propoziții-șablon completate doar cu valori calculate. Fără model de limbaj.

import type { Analysis, Body, Cause, Fit, Model, NextEvent, RowKey } from './derive.ts';
import { sampleIndex } from './derive.ts';
import { fmtDeg, fmtDeltaH, fmtDur, fmtSignedDur, fmtUtcMs } from './format.ts';

const NAME: Record<RowKey, string> = { sun: 'The Sun', earth: 'The Earth', both: 'The common window' };
const LOWER: Record<Body | 'both', string> = { sun: 'the Sun', earth: 'the Earth', both: 'both bodies' };
export const horizonWord = (m: Model) => (m === 'ideal' ? 'the ideal 0° horizon' : 'the terrain profile');

export function countdownText(row: RowKey, ev: NextEvent, endLabel: string): string {
  const n = NAME[row];
  if (ev.inMin == null) {
    if (ev.state === 'vis') return `No setting detected before ${endLabel}`;
    if (ev.state === 'hid') return `No rising detected before ${endLabel}`;
    return `Unknown until ${endLabel}`;
  }
  const d = fmtDur(ev.inMin);
  if (ev.nextState === 'unk') return `Data becomes unknown in ${d}`;
  if (ev.state === 'vis') return row === 'both' ? `Closes in ${d}` : `${n} sets in ${d}`;
  if (ev.state === 'hid') return row === 'both' ? `Opens in ${d}` : `${n} rises in ${d}`;
  return `Known again in ${d}`;
}

export interface Change {
  site: boolean;
  date: boolean;
  deltaH: number;
}

export function changeSentence(ch: Change, model: Model): string {
  if (!ch.site && !ch.date) return 'The same option is selected in both panels.';
  if (ch.site && ch.date) return 'Both the site and the start changed, so the difference cannot be blamed on a single cause.';
  if (ch.date)
    return `Only the start changed (${fmtDeltaH(ch.deltaH)}), at the same site${model === 'terrain' ? ' with the same terrain profile' : ''}: the difference comes from where the Sun and Earth are in the sky on the later dates.`;
  return `Only the site changed, with the same start: the difference comes from the site's position${model === 'terrain' ? ' and its terrain profile' : ''}.`;
}

export function causeText(a: Analysis, c: Cause, model: Model, t0: number): string {
  const at = fmtUtcMs(t0 + c.t * 60_000);
  if (c.kind === 'period-end') return `The window is still open when the analysed period ends (${at}); it may last longer.`;
  if (c.kind === 'unknown') return `At ≈ ${at} the data for ${LOWER[c.body]} becomes unknown, so the window cannot be confirmed after that.`;
  const parts = (['sun', 'earth'] as const)
    .filter((b) => c.body === b || c.body === 'both')
    .map((b) => {
      const tr = a[b];
      const i = Math.min(a.n - 1, Math.ceil(c.t / a.stepMin - 1e-6));
      const need = b === 'sun' ? `above ${horizonWord(model)}` : `at least ${fmtDeg(tr.threshold, 0)} above ${horizonWord(model)}`;
      return `${LOWER[b]} must be ${need}; at the next sample its elevation is ${fmtDeg(tr.el[i], 2)} against terrain ${fmtDeg(tr.hor[i], 2)} at azimuth ${fmtDeg(tr.az[i], 0)} (margin ${fmtDeg(tr.margin[i], 2, true)})`;
    });
  return `The window closes at ≈ ${at} because ${c.body === 'both' ? 'both bodies stop being visible' : `${LOWER[c.body]} stops being visible`}: ${parts.join('; ')}.`;
}

/** La cursor: corpul cu cea mai mică rezervă unghiulară (marjă − prag). */
export function limitingAt(a: Analysis, t: number): { body: Body | null; excess: number | null } {
  const i = sampleIndex(a, t);
  const ex = (b: Body) => {
    const m = a[b].margin[i];
    return m == null ? null : m - a[b].threshold;
  };
  const s = ex('sun');
  const e = ex('earth');
  if (s == null && e == null) return { body: null, excess: null };
  if (s == null) return { body: 'sun', excess: null };
  if (e == null) return { body: 'earth', excess: null };
  return s <= e ? { body: 'sun', excess: s } : { body: 'earth', excess: e };
}

/** Cele trei rezultate posibile, cu formularea cerută. */
export const VERDICT_LABEL: Record<Fit['kind'], string> = {
  fits: 'Fits',
  none: 'Does not fit in the analysed period',
  insufficient: 'Not enough data',
};

export function verdictText(fit: Fit, activityMin: number): string {
  if (fit.kind === 'fits') return `${VERDICT_LABEL.fits} (${fmtDur(activityMin)})`;
  return VERDICT_LABEL[fit.kind];
}

export function differenceText(aLen: number, bLen: number, primary: string, alternative: string): string {
  if (Math.abs(bLen - aLen) < 1) return `The longest known common window lasts ${fmtDur(aLen)} in both options.`;
  const sameSite = primary === alternative;
  return `Longest known common window: ${sameSite ? 'reference option' : primary} · ${fmtDur(aLen)}, ${sameSite ? 'alternative option' : alternative} · ${fmtDur(bLen)} (${fmtSignedDur(bLen - aLen)}).`;
}

// Propoziții-șablon completate doar cu valori calculate. Fără model de limbaj.

import type { Analysis, Body, Cause, Fit, Model, NextEvent, RowKey } from './derive.ts';
import { sampleIndex } from './derive.ts';
import { fmtDeg, fmtDeltaH, fmtDur, fmtSignedDur, fmtUtcMs } from './format.ts';

const NAME: Record<RowKey, string> = { sun: 'Soarele', earth: 'Pământul', both: 'Fereastra comună' };
const LOWER: Record<Body | 'both', string> = { sun: 'Soarele', earth: 'Pământul', both: 'ambele corpuri' };
export const horizonWord = (m: Model) => (m === 'ideal' ? 'orizontul idealizat de 0°' : 'profilul de teren');

export function countdownText(row: RowKey, ev: NextEvent, endLabel: string): string {
  const n = NAME[row];
  if (ev.inMin == null) {
    if (ev.state === 'vis') return `Nicio dispariție detectată înainte de ${endLabel}`;
    if (ev.state === 'hid') return `Nicio reapariție detectată înainte de ${endLabel}`;
    return `Necunoscut până la ${endLabel}`;
  }
  const d = fmtDur(ev.inMin);
  if (ev.nextState === 'unk') return `Datele devin necunoscute în ${d}`;
  if (ev.state === 'vis') return row === 'both' ? `Se închide în ${d}` : `${n} dispare în ${d}`;
  if (ev.state === 'hid') return row === 'both' ? `Se deschide în ${d}` : `${n} reapare în ${d}`;
  return `Din nou cunoscut în ${d}`;
}

export interface Change {
  site: boolean;
  date: boolean;
  deltaH: number;
}

export function changeSentence(ch: Change, model: Model): string {
  if (!ch.site && !ch.date) return 'Este selectat același scenariu în ambele panouri.';
  if (ch.site && ch.date) return 'S-au schimbat atât zona, cât și startul, deci diferența nu poate fi atribuită unei singure cauze.';
  if (ch.date)
    return `S-a schimbat doar startul (${fmtDeltaH(ch.deltaH)}), la aceeași zonă${model === 'terrain' ? ' și același profil de teren' : ''}: diferența vine din pozițiile Soarelui și Pământului pe cer la datele ulterioare.`;
  return `S-a schimbat doar zona, la același start: diferența vine din poziția zonei${model === 'terrain' ? ' și din profilul ei de teren' : ''}.`;
}

export function causeText(a: Analysis, c: Cause, model: Model, t0: number): string {
  const at = fmtUtcMs(t0 + c.t * 60_000);
  if (c.kind === 'period-end') return `Fereastra este încă deschisă când se termină perioada analizată (${at}); poate dura mai mult.`;
  if (c.kind === 'unknown') return `La ≈ ${at} datele pentru ${LOWER[c.body]} devin necunoscute, deci fereastra nu poate fi confirmată după acest moment.`;
  const parts = (['sun', 'earth'] as const)
    .filter((b) => c.body === b || c.body === 'both')
    .map((b) => {
      const tr = a[b];
      const i = Math.min(a.n - 1, Math.ceil(c.t / a.stepMin - 1e-6));
      const need = b === 'sun' ? `deasupra față de ${horizonWord(model)}` : `cu cel puțin ${fmtDeg(tr.threshold, 0)} deasupra față de ${horizonWord(model)}`;
      return `${LOWER[b]} trebuie să fie ${need}; la eșantionul următor elevația este ${fmtDeg(tr.el[i], 2)}, față de teren ${fmtDeg(tr.hor[i], 2)} la azimutul ${fmtDeg(tr.az[i], 0)} (marjă ${fmtDeg(tr.margin[i], 2, true)})`;
    });
  return `Fereastra se închide la ≈ ${at} pentru că ${c.body === 'both' ? 'ambele corpuri ies din vizibilitate' : `${LOWER[c.body]} iese din vizibilitate`}: ${parts.join('; ')}.`;
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
  fits: 'Se încadrează',
  none: 'Nu se încadrează în perioada analizată',
  insufficient: 'Date insuficiente',
};

export function verdictText(fit: Fit, activityMin: number): string {
  if (fit.kind === 'fits') return `${VERDICT_LABEL.fits} (${fmtDur(activityMin)})`;
  return VERDICT_LABEL[fit.kind];
}

export function differenceText(aLen: number, bLen: number, primary: string, alternative: string): string {
  if (Math.abs(bLen - aLen) < 1) return `Cea mai lungă fereastră comună cunoscută durează ${fmtDur(aLen)} în ambele scenarii.`;
  const sameSite = primary === alternative;
  return `Cea mai lungă fereastră comună cunoscută: ${sameSite ? 'scenariul de referință' : primary} · ${fmtDur(aLen)}, ${sameSite ? 'scenariul alternativ' : alternative} · ${fmtDur(bLen)} (${fmtSignedDur(bLen - aLen)}).`;
}

// Display formatting only. Values stay numeric (minutes, degrees, epoch ms) in the data model
// and are formatted at the display boundary.

const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const p2 = (n: number) => String(n).padStart(2, '0');

export function fmtDur(min: number): string {
  const m = Math.round(Math.abs(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h} h` : `${h} h ${p2(r)} min`;
}

export const fmtSignedDur = (min: number) => (Math.round(min) === 0 ? '0 min' : `${min > 0 ? '+' : '−'}${fmtDur(min)}`);

export function fmtUtcMs(ms: number, withDate = true): string {
  const d = new Date(Math.round(ms / 60_000) * 60_000);
  const time = `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
  return withDate ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${time} UTC` : `${time} UTC`;
}

export const fmtUtc = (startUtc: string, offsetMin = 0, withDate = true) => fmtUtcMs(Date.parse(startUtc) + offsetMin * 60_000, withDate);

export function fmtDateShort(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} · ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
}

export function fmtDeg(v: number | null | undefined, digits = 1, signed = false): string {
  if (v == null || !Number.isFinite(v)) return '—';
  // never let rounding flip the visible sign of a margin: show one more digit near zero
  if (v !== 0 && Number(Math.abs(v).toFixed(digits)) === 0) digits = Math.min(4, digits + 2);
  const s = Math.abs(v).toFixed(digits);
  const sign = v < 0 && Number(s) !== 0 ? '−' : signed ? '+' : '';
  return `${sign}${s}°`;
}

export const fmtElapsed = (min: number) => `T+${p2(Math.floor(min / 60))}:${p2(Math.round(min % 60))}`;

export function fmtDeltaH(h: number): string {
  if (Math.round(h * 60) === 0) return 'același start';
  const s = Math.abs(h);
  return `${h > 0 ? '+' : '−'}${Number.isInteger(s) ? s : s.toFixed(1)} h`;
}

// Calitatea grafică: „ridicată” pe desktop, „redusă” pe dispozitive slabe (detectat automat,
// comutabil de utilizator). Redusă = fără umbre, grilă de teren rarefiată, fără modelul 3D de 78 MB.
export type Quality = 'high' | 'low';

export function detectQuality(): Quality {
  if (typeof navigator === 'undefined') return 'high';
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent);
  if (nav.connection?.saveData) return 'low';
  if ((nav.deviceMemory ?? 8) <= 4) return 'low';
  if ((nav.hardwareConcurrency ?? 8) <= 4) return 'low';
  if (mobile) return 'low';
  return 'high';
}

export const QUALITY_TEXT: Record<Quality, string> = { high: 'High', low: 'Low' };

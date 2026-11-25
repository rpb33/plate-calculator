export const MAX_WEIGHT_KG = 10_000;

/** Parse decimal kilograms without floating point multiplication or rounding. */
export function parseKg(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^(?:\d+(?:\.\d{0,3})?|\.\d{1,3})$/.test(normalized)) return null;
  const [whole = '', fraction = ''] = normalized.split('.');
  const grams = Number(whole) * 1_000 + Number(fraction.padEnd(3, '0'));
  return Number.isSafeInteger(grams) && grams <= MAX_WEIGHT_KG * 1_000 ? grams : null;
}

/** Units are hundredths of a gram, preserving exact percentage targets. */
export function formatWeight(units: number): string {
  const whole = Math.floor(units / 100_000);
  const fraction = String(units % 100_000).padStart(5, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}

export function formatGrams(grams: number): string {
  return formatWeight(grams * 100);
}

export function validateWeight(value: string, isTarget: boolean): string | null {
  if (value.trim() === '') return 'Enter a weight in kg.';
  const grams = parseKg(value);
  if (grams === null) return `Use 0–${MAX_WEIGHT_KG.toLocaleString('en')} kg, with up to 3 decimals.`;
  if (isTarget && grams === 0) return 'Target must be greater than 0 kg.';
  return null;
}

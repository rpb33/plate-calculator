import { describe, expect, it } from 'vitest';
import { formatGrams, formatWeight, parseKg, validateWeight } from '../src/weight';

describe('exact weight input and formatting', () => {
  it.each([['100', 100000], ['1.25', 1250], ['0.001', 1], ['.5', 500], [' 2,5 ', 2500], ['20.', 20000], ['0', 0], ['10000', 10000000]])('parses %s to %s integer grams', (text, grams) => expect(parseKg(text)).toBe(grams));
  it.each(['', '-1', 'NaN', 'Infinity', 'abc', '1e2', '0x10', '1.0001', '10,000.00', '10000.001', '1 000'])('rejects invalid input %s without coercion', (text) => expect(parseKg(text)).toBeNull());
  it('preserves every requested decimal without rounding', () => {
    expect(formatWeight(99_950)).toBe('0.9995');
    expect(formatWeight(70)).toBe('0.0007');
    expect(formatWeight(1)).toBe('0.00001');
    expect(formatGrams(1250)).toBe('1.25');
    expect(formatGrams(100000)).toBe('100');
    expect(formatGrams(0)).toBe('0');
  });
  it('validates target and bar with readable errors', () => {
    expect(validateWeight('', true)).toBe('Enter a weight in kg.');
    expect(validateWeight('0', true)).toMatch(/greater than 0/);
    expect(validateWeight('-1', false)).toMatch(/up to 3 decimals/);
    expect(validateWeight('0', false)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { calculateSets, STAGES } from '../src/calculator';
import type { Mode } from '../src/calculator';
import { INVENTORY, parseInventory } from '../src/inventory';
import type { Diameter, Plate } from '../src/inventory';

const inventory = (rows: string) => parseInventory(`weightKg,diameterMm,color,quantity\n${rows}`);
const target = (weight: number, bar: number, plates: Plate[], mode: Mode = 'barbell', diameter: Diameter = 50) =>
  calculateSets(weight, bar, mode, diameter, plates)[3]!;

describe('exact bounded plate optimization', () => {
  it('finds an exact achievable total including the bar', () => {
    const result = target(100_000, 20_000, INVENTORY);
    expect(result.actualG).toBe(100_000);
    expect(result.differenceUnits).toBe(0);
    expect(result.loading.map(({ plate, count }) => [plate.weightG, count])).toEqual([[25_000, 1], [15_000, 1]]);
  });

  it('finds the nearest total below an unachievable target', () => {
    const result = target(103_000, 20_000, INVENTORY);
    expect(result.actualG).toBe(100_000);
    expect(result.differenceUnits).toBe(300_000);
  });

  it('respects physical quantity and odd leftovers', () => {
    const result = target(100_000, 20_000, inventory('10,50,green,3'));
    expect(result.actualG).toBe(40_000);
    expect(result.loading[0]!.count).toBe(1);
  });

  it('requires pairs of identical plates for a barbell', () => {
    const plates = inventory('5,50,red,1\n5,50,blue,1');
    expect(target(30_000, 20_000, plates).actualG).toBe(20_000);
    expect(target(30_000, 20_000, inventory('5,50,red,2')).actualG).toBe(30_000);
  });

  it('reserves groups of four for a dumbbell pair, showing one dumbbell', () => {
    expect(target(20_000, 2_000, inventory('5,50,red,3'), 'dumbbell').actualG).toBe(2_000);
    const result = target(20_000, 2_000, inventory('5,50,red,7'), 'dumbbell');
    expect(result.actualG).toBe(12_000);
    expect(result.loading[0]!.count).toBe(1);
    expect(result.requestedUnits).toBe(2_000_000);
  });

  it('filters diameter without mixing inventories', () => {
    const plates = inventory('5,25,red,4\n10,50,blue,4');
    expect(target(50_000, 10_000, plates, 'barbell', 25).actualG).toBe(30_000);
    expect(target(50_000, 10_000, plates, 'barbell', 50).actualG).toBe(50_000);
    expect(target(50_000, 10_000, plates, 'barbell', 25).loading.every(({ plate }) => plate.diameterMm === 25)).toBe(true);
  });

  it('marks stages below bar weight as not achievable', () => {
    const stages = calculateSets(30_000, 20_000, 'barbell', 50, INVENTORY);
    expect(stages[0]).toMatchObject({ actualG: null, differenceUnits: null, loading: [] });
    expect(stages[1]!.actualG).toBe(20_000);
  });

  it('accepts an empty bar equal to the requested weight', () => {
    expect(target(20_000, 20_000, INVENTORY)).toMatchObject({ actualG: 20_000, differenceUnits: 0, loading: [] });
  });

  it('uses an empty bar when no plates are available, only below the target', () => {
    expect(target(35_000, 20_000, [])).toMatchObject({ actualG: 20_000, loading: [] });
    expect(target(10_000, 20_000, [])).toMatchObject({ actualG: null, loading: [] });
    expect(target(35_000, 20_000, inventory('5,50,red,0')).actualG).toBe(20_000);
  });

  it('applies percentages to full weight including the bar', () => {
    const stages = calculateSets(100_000, 20_000, 'barbell', 50, INVENTORY);
    expect(stages.map((stage) => stage.requestedUnits)).toEqual([5_000_000, 7_000_000, 9_000_000, 10_000_000]);
    expect(stages.map((stage) => stage.actualG)).toEqual([50_000, 70_000, 90_000, 100_000]);
    expect(stages.map((stage) => stage.reps)).toEqual(['5 reps', '3 reps', '1–2 reps', 'Target']);
  });

  it('reuses inventory independently at every stage', () => {
    const stages = calculateSets(40_000, 0, 'barbell', 50, inventory('10,50,green,4'));
    expect(stages.map((stage) => stage.actualG)).toEqual([20_000, 20_000, 20_000, 40_000]);
  });

  it('finds the exact solution when greedy heaviest-first would fail', () => {
    const result = target(16_000, 0, inventory('6,50,red,2\n4,50,blue,4'));
    expect(result.actualG).toBe(16_000);
    expect(result.loading.map(({ plate, count }) => [plate.weightG, count])).toEqual([[4_000, 2]]);
  });

  it('prefers fewer plates for the same achieved weight', () => {
    const result = target(20_000, 0, inventory('6,50,red,2\n4,50,blue,2\n10,50,green,2'));
    expect(result.loading.map(({ plate, count }) => [plate.weightG, count])).toEqual([[10_000, 1]]);
  });

  it('prefers heavier plates if plate count and achieved weight tie', () => {
    const result = target(16_000, 0, inventory('4,50,blue,4\n6,50,red,2\n2,50,green,2'));
    expect(result.loading.map(({ plate, count }) => [plate.weightG, count])).toEqual([[6_000, 1], [2_000, 1]]);
  });

  it('breaks equal-weight/color ties using original inventory order', () => {
    const plates = inventory('5,50,blue,2\n5,50,red,2');
    expect(target(10_000, 0, plates).loading[0]!.plate.color).toBe('blue');
    expect(target(20_000, 0, plates).loading.map(({ plate }) => plate.color)).toEqual(['blue', 'red']);
  });

  it('handles decimal weights exactly', () => {
    const result = target(7_600, 100, inventory('1.25,50,green,8'));
    expect(result.actualG).toBe(7_600);
    expect(result.loading[0]!.count).toBe(3);
    expect(target(7_599, 100, inventory('1.25,50,green,8')).actualG).toBe(5_100);
  });

  it('never rounds a fractional-gram percentage target upward', () => {
    const stages = calculateSets(1_999, 0, 'barbell', 50, inventory('0.5,50,black,4'));
    expect(stages[0]).toMatchObject({ requestedUnits: 99_950, actualG: 0 });
    for (const stage of stages) expect(stage.actualG! * 100).toBeLessThanOrEqual(stage.requestedUnits);
  });

  it.each([NaN, Infinity, -1, 1.1, 10_000_001])('rejects invalid integer-gram arguments: %s', (value) => {
    expect(() => calculateSets(value, 0, 'barbell', 50, [])).toThrow(RangeError);
    expect(() => calculateSets(1_000, value, 'barbell', 50, [])).toThrow(RangeError);
  });

  it('matches exhaustive enumeration across 160 varied inventories and both modes', () => {
    let seed = 53421;
    const random = (max: number) => { seed = (seed * 16807) % 2147483647; return seed % max; };
    for (let sample = 0; sample < 160; sample++) {
      const mode: Mode = sample % 2 ? 'barbell' : 'dumbbell';
      const group = mode === 'barbell' ? 2 : 4;
      const plates = inventory(Array.from({ length: 4 }, (_, i) => `${(random(30) + 1) / 8},50,${['red', 'blue', 'green', 'black'][i]},${random(10)}`).join('\n'));
      const totalG = random(40_000) + 1;
      const barG = random(4_000);
      const stages = calculateSets(totalG, barG, mode, 50, plates);
      const sorted = [...plates].sort((a, b) => b.weightG - a.weightG || a.id - b.id);
      const choices: { grams: number; counts: number[]; count: number }[] = [];
      const enumerate = (i: number, grams: number, counts: number[]) => {
        if (i === sorted.length) { choices.push({ grams, counts, count: counts.reduce((a, b) => a + b, 0) }); return; }
        const plate = sorted[i]!;
        for (let count = 0; count <= Math.floor(plate.quantity / group); count++) enumerate(i + 1, grams + 2 * count * plate.weightG, [...counts, count]);
      };
      enumerate(0, barG, []);
      for (const [index, stage] of stages.entries()) {
        const ranked = choices.filter(({ grams }) => grams * 100 <= totalG * STAGES[index]!.percent).sort((a, b) => {
          if (a.grams !== b.grams) return b.grams - a.grams;
          if (a.count !== b.count) return a.count - b.count;
          for (let i = 0; i < sorted.length; i++) if (a.counts[i] !== b.counts[i]) return b.counts[i]! - a.counts[i]!;
          return 0;
        });
        expect(stage.actualG).toBe(ranked[0]?.grams ?? null);
        if (stage.actualG !== null) {
          expect(stage.actualG * 100).toBeLessThanOrEqual(stage.requestedUnits);
          expect(stage.loading.map(({ plate, count }) => [plate.id, count])).toEqual(sorted.flatMap((plate, i) => ranked[0]!.counts[i] ? [[plate.id, ranked[0]!.counts[i]]] : []));
          for (const { plate, count } of stage.loading) expect(count * group).toBeLessThanOrEqual(plate.quantity);
        }
      }
    }
  });
});

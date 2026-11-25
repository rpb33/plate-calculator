import type { Diameter, Plate } from './inventory';
import { MAX_WEIGHT_KG } from './weight';

export type Mode = 'barbell' | 'dumbbell';
export const STAGES = [
  { percent: 50, reps: '5 reps' },
  { percent: 70, reps: '3 reps' },
  { percent: 90, reps: '1–2 reps' },
  { percent: 100, reps: 'Target' },
] as const;

export interface Loading { readonly plate: Plate; readonly count: number }
export interface StageResult {
  readonly percent: number;
  readonly reps: string;
  /** Hundredths of a gram; percentages can fall between whole grams. */
  readonly requestedUnits: number;
  readonly actualG: number | null;
  readonly differenceUnits: number | null;
  /** Counts for one side of a barbell or one end of one dumbbell. */
  readonly loading: readonly Loading[];
}
interface Configuration { readonly counts: readonly number[]; readonly plateCount: number }

// At equal weight: fewest physical plates, then most heavier plates, then CSV order.
// Sorted rows make lexicographic comparison implement the last two rules.
function preferred(candidate: Configuration, current: Configuration): boolean {
  if (candidate.plateCount !== current.plateCount) return candidate.plateCount < current.plateCount;
  for (let i = 0; i < candidate.counts.length; i++) {
    if (candidate.counts[i] !== current.counts[i]) return candidate.counts[i]! > current.counts[i]!;
  }
  return false;
}

/** Exact bounded knapsack. Each map entry is the best configuration at that weight. */
function solve(capacityG: number, plates: readonly Plate[], groupSize: number): readonly Loading[] {
  let states = new Map<number, Configuration>([[0, { counts: [], plateCount: 0 }]]);
  for (const plate of plates) {
    const next = new Map<number, Configuration>();
    const available = Math.floor(plate.quantity / groupSize);
    for (const [weight, state] of states) {
      const limit = Math.min(available, Math.floor((capacityG - weight) / plate.weightG));
      for (let count = 0; count <= limit; count++) {
        const total = weight + count * plate.weightG;
        const candidate = { counts: [...state.counts, count], plateCount: state.plateCount + count };
        const current = next.get(total);
        if (!current || preferred(candidate, current)) next.set(total, candidate);
      }
    }
    states = next;
  }
  let highest = 0;
  for (const weight of states.keys()) if (weight > highest) highest = weight;
  return states.get(highest)!.counts.flatMap((count, i) => count ? [{ plate: plates[i]!, count }] : []);
}

export function calculateSets(
  targetG: number,
  barG: number,
  mode: Mode,
  diameter: Diameter,
  inventory: readonly Plate[],
): readonly StageResult[] {
  for (const weight of [targetG, barG]) {
    if (!Number.isSafeInteger(weight) || weight < 0 || weight > MAX_WEIGHT_KG * 1_000) {
      throw new RangeError('Weights must be integer grams between 0 and 10000000.');
    }
  }
  if (mode !== 'barbell' && mode !== 'dumbbell') throw new RangeError('Unknown equipment mode.');
  if (diameter !== 30 && diameter !== 50) throw new RangeError('Plate diameter must be 30 or 50.');
  const groupSize = mode === 'barbell' ? 2 : 4;
  const plates = inventory.filter((plate) => plate.diameterMm === diameter && plate.quantity >= groupSize)
    .sort((a, b) => b.weightG - a.weightG || a.id - b.id);

  return STAGES.map(({ percent, reps }) => {
    const requestedUnits = targetG * percent;
    if (barG * 100 > requestedUnits) {
      return { percent, reps, requestedUnits, actualG: null, differenceUnits: null, loading: [] };
    }
    // Both modes have two loaded ends per displayed implement. Four plates are
    // reserved per dumbbell increment, but the displayed total is ONE dumbbell.
    const capacityG = Math.floor((requestedUnits - barG * 100) / 200);
    const loading = solve(capacityG, plates, groupSize);
    const actualG = barG + 2 * loading.reduce((sum, { plate, count }) => sum + plate.weightG * count, 0);
    return { percent, reps, requestedUnits, actualG, differenceUnits: requestedUnits - actualG * 100, loading };
  });
}

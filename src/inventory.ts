import { parseKg } from './weight';

export const PLATE_COLORS = ['red', 'green', 'blue', 'yellow', 'grey', 'black'] as const;
export type PlateColor = (typeof PLATE_COLORS)[number];
export type Diameter = 30 | 50;
export interface Plate {
  readonly id: number;
  readonly weightG: number;
  readonly diameterMm: Diameter;
  readonly color: PlateColor;
  /** Total individual physical plates, not pairs. */
  readonly quantity: number;
}

// EXAMPLE INVENTORY — replace these rows with your own physical plate counts.
// Multiple rows of the same weight with different colors are supported.
export const INVENTORY_CSV = `weightKg,diameterMm,color,quantity
1,30,grey,8
2,30,grey,4
2.5,30,grey,2
2,30,grey,4
1,30,grey,4
0.5,30,grey,4
20,50,grey,2
15,50,grey,2
10,50,grey,2
5,50,grey,4
2.5,50,grey,4
1.25,50,grey,4
10,50,grey,2
5,50,grey,4
2.5,50,grey,2
10,30,grey,2
10,30,grey,4
15,30,grey,2
5,30,grey,4
5,30,grey,2
5,30,grey,2
2.5,30,grey,2
0.115,50,black,2
0.225,50,blue,2
0.345,50,red,2
0.46,50,green,2`;

export function parseInventory(csv: string): Plate[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines[0]?.trim() !== 'weightKg,diameterMm,color,quantity') {
    throw new Error('Inventory line 1: expected header weightKg,diameterMm,color,quantity.');
  }
  const plates: Plate[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim()) continue;
    const fail = (message: string): never => { throw new Error(`Inventory line ${i + 1}: ${message}`); };
    const fields = line.split(',').map((field) => field.trim());
    if (fields.length !== 4) fail('expected exactly 4 comma-separated fields.');
    const [weight = '', diameter = '', color = '', quantityText = ''] = fields;
    const weightG = parseKg(weight);
    if (weightG === null || weightG === 0) fail('weightKg must be positive, at most 10000 kg, with up to 3 decimal places.');
    if (diameter !== '30' && diameter !== '50') fail('diameterMm must be 30 or 50.');
    if (!PLATE_COLORS.includes(color as PlateColor)) fail(`color must be one of ${PLATE_COLORS.join(', ')}.`);
    const quantity = Number(quantityText);
    if (!/^\d+$/.test(quantityText) || !Number.isSafeInteger(quantity)) fail('quantity must be a nonnegative safe integer of individual physical plates.');
    plates.push({ id: i - 1, weightG: weightG!, diameterMm: Number(diameter) as Diameter, color: color as PlateColor, quantity });
  }
  return plates;
}

export const INVENTORY = parseInventory(INVENTORY_CSV);

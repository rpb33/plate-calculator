import { parseKg } from './weight';

export const PLATE_COLORS = ['red', 'green', 'blue', 'yellow', 'grey', 'black'] as const;
export type PlateColor = (typeof PLATE_COLORS)[number];
export type Diameter = 25 | 50;
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
25,50,red,2
20,50,blue,2
15,50,yellow,2
10,50,green,4
5,50,grey,4
2.5,50,black,4
5,25,red,4
2.5,25,blue,4
1.25,25,green,8`;

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
    if (diameter !== '25' && diameter !== '50') fail('diameterMm must be 25 or 50.');
    if (!PLATE_COLORS.includes(color as PlateColor)) fail(`color must be one of ${PLATE_COLORS.join(', ')}.`);
    const quantity = Number(quantityText);
    if (!/^\d+$/.test(quantityText) || !Number.isSafeInteger(quantity)) fail('quantity must be a nonnegative safe integer of individual physical plates.');
    plates.push({ id: i - 1, weightG: weightG!, diameterMm: Number(diameter) as Diameter, color: color as PlateColor, quantity });
  }
  return plates;
}

export const INVENTORY = parseInventory(INVENTORY_CSV);

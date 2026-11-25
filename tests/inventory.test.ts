import { describe, expect, it } from 'vitest';
import { INVENTORY, parseInventory } from '../src/inventory';

const header = 'weightKg,diameterMm,color,quantity';
describe('static CSV inventory', () => {
  it('loads the documented example as physical individual quantities', () => {
    expect(INVENTORY).toHaveLength(9);
    expect(INVENTORY[0]).toEqual({ id: 0, weightG: 25_000, diameterMm: 50, color: 'red', quantity: 2 });
  });
  it('supports CRLF, whitespace, empty lines, duplicate weights and zero quantity', () => {
    expect(parseInventory(` ${header}\r\n5,50,red,2\r\n\r\n 5, 50, blue, 0 `)).toEqual([
      { id: 0, weightG: 5_000, diameterMm: 50, color: 'red', quantity: 2 },
      { id: 2, weightG: 5_000, diameterMm: 50, color: 'blue', quantity: 0 },
    ]);
  });
  it('accepts an inventory with no plate rows', () => expect(parseInventory(header)).toEqual([]));
  it('requires the documented header', () => expect(() => parseInventory('weight,color\n5,red')).toThrow('Inventory line 1'));
  it.each([
    ['5,50,red', 'exactly 4'], ['5,50,red,2,extra', 'exactly 4'],
    ['0,50,red,2', 'weightKg'], ['-1,50,red,2', 'weightKg'], ['NaN,50,red,2', 'weightKg'],
    ['0.0001,50,red,2', 'weightKg'], ['10001,50,red,2', 'weightKg'],
    ['5,30,red,2', 'diameterMm'], ['5,25.0,red,2', 'diameterMm'],
    ['5,50,purple,2', 'color'], ['5,50,RED,2', 'color'],
    ['5,50,red,-1', 'quantity'], ['5,50,red,2.5', 'quantity'], ['5,50,red,', 'quantity'],
    ['5,50,red,9007199254740992', 'quantity'],
  ])('rejects malformed row %s with line and field context', (row, field) => {
    expect(() => parseInventory(`${header}\n5,25,green,4\n${row}`)).toThrow(new RegExp(`Inventory line 3:.*${field}`));
  });
});

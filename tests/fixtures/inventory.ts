// Fixed test data: editing the app's inventory must not change unit expectations.
import { parseInventory } from '../../src/inventory';

export const TEST_INVENTORY_CSV = `weightKg,diameterMm,color,quantity
25,50,red,2
20,50,blue,2
15,50,yellow,2
10,50,green,4
5,50,grey,4
2.5,50,black,4
5,30,red,4
2.5,30,blue,4
1.25,30,green,8`;

export const TEST_INVENTORY = parseInventory(TEST_INVENTORY_CSV);

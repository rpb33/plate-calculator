import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { calculateSets } from '../src/calculator';
import type { Mode } from '../src/calculator';
import { INVENTORY } from '../src/inventory';
import type { Diameter } from '../src/inventory';
import { formatGrams, formatWeight } from '../src/weight';

// Unit fixtures verify optimization independently. Browser checks verify that
// inputs, totals, differences and badges use the currently configured inventory.
async function expectCalculatedSets(page: Page, targetG: number, barG: number, mode: Mode = 'barbell', diameter: Diameter = 50) {
  const stages = calculateSets(targetG, barG, mode, diameter, INVENTORY);
  const cards = page.locator('.set-card');
  await expect(cards).toHaveCount(stages.length);
  for (const [index, stage] of stages.entries()) {
    const card = cards.nth(index);
    await expect(card.locator('.achieved')).toHaveText(stage.actualG === null ? 'Not achievable' : `${formatGrams(stage.actualG)}kg`);
    await expect(card.locator('.set-meta > span').first()).toHaveText(`Requested ${formatWeight(stage.requestedUnits)} kg`);
    if (stage.actualG !== null) {
      await expect(card.locator('.difference')).toHaveText(stage.differenceUnits === 0 ? 'Exact' : `−${formatWeight(stage.differenceUnits!)} kg`);
      await expect(card.locator('.plate')).toHaveText(stage.loading.map(({ plate, count }) => `${count > 1 ? `${count} × ` : ''}${formatGrams(plate.weightG)}`));
      if (!stage.loading.length) await expect(card).toContainText('Empty bar');
    }
  }
}

test.beforeEach(async ({ page }) => { await page.goto('./'); });

test('loads production assets under a repository subpath without errors', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Plate Calculator', exact: true })).toBeVisible();
  await expect(page.locator('.set-card')).toHaveCount(4);
  await expectCalculatedSets(page, 100_000, 20_000);
  expect(errors).toEqual([]);
  for (const badge of await page.locator('.plate').all()) {
    expect(await badge.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  }
  await page.screenshot({ path: testInfo.outputPath('plate-calculator.png'), fullPage: true });
});

test('updates instantly and clears stale results for invalid inputs', async ({ page }) => {
  const input = page.getByRole('textbox', { name: 'Target weight' });
  await input.fill('103');
  await expectCalculatedSets(page, 103_000, 20_000);
  for (const value of ['', '-5', 'abc', '0', '10.0001']) {
    await input.fill(value);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#target-error')).toBeVisible();
    await expect(page.locator('.set-card')).toHaveCount(0);
  }
  await input.fill('100');
  await expect(page.locator('.set-card')).toHaveCount(4);
  await page.getByRole('textbox', { name: 'Bar weight' }).fill('-1');
  await expect(page.locator('#bar-error')).toBeVisible();
  await expect(page.locator('.set-card')).toHaveCount(0);
});

test('supports dumbbell pairs, diameter changes and per-end labels', async ({ page }) => {
  await page.getByRole('radio', { name: 'Dumbbell', exact: true }).check();
  await page.getByRole('radio', { name: '30 mm' }).check();
  await page.getByRole('textbox', { name: 'Target weight' }).fill('17.5');
  await page.getByRole('textbox', { name: 'Bar weight' }).fill('2.5');
  await expectCalculatedSets(page, 17_500, 2_500, 'dumbbell', 30);
  await expect(page.locator('.loading-label')).toHaveText(['Per end', 'Per end', 'Per end', 'Per end']);
  await expect(page.locator('#weight-context')).toContainText('one dumbbell');
});

test('explains impossible stages and empty bars', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Target weight' }).fill('20');
  await expect(page.locator('.achieved')).toHaveText(['Not achievable', 'Not achievable', 'Not achievable', '20kg']);
  await expect(page.locator('.set-card').last()).toContainText('Empty bar');
});

test('remembers valid selections after reload', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Target weight' }).fill('32.5');
  await page.getByRole('textbox', { name: 'Bar weight' }).fill('2.5');
  await page.getByRole('radio', { name: 'Dumbbell', exact: true }).check();
  await page.getByRole('radio', { name: '30 mm' }).check();
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Target weight' })).toHaveValue('32.5');
  await expect(page.getByRole('textbox', { name: 'Bar weight' })).toHaveValue('2.5');
  await expect(page.getByRole('radio', { name: 'Dumbbell', exact: true })).toBeChecked();
  await expect(page.getByRole('radio', { name: '30 mm' })).toBeChecked();
  // Older releases stored 25 mm as the smaller-diameter selection.
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('plate-calculator:v1')!);
    saved.diameter = 25;
    localStorage.setItem('plate-calculator:v1', JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.getByRole('radio', { name: '30 mm' })).toBeChecked();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('plate-calculator:v1')!).diameter)).toBe(30);
});

test('handles unavailable storage and malformed persisted settings', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('plate-calculator:v1', '{bad json'));
  await page.reload();
  await expect(page.locator('.set-card')).toHaveCount(4);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
  });
  await page.reload();
  await page.getByRole('textbox', { name: 'Target weight' }).fill('110');
  await expectCalculatedSets(page, 110_000, 20_000);
});

test('fits narrow phones without horizontal overflow and has large controls', async ({ page }) => {
  for (const width of [320, 360, 390, 430, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const control of await page.locator('.segmented label, .input-wrap input').all()) {
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('textbox', { name: 'Target weight' }).fill('9999.999');
    await page.getByRole('textbox', { name: 'Bar weight' }).fill('9999.998');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('supports keyboard navigation and radio arrow keys', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Keyboard behavior checked in a separate desktop context.');
  await page.getByRole('textbox', { name: 'Target weight' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Bar weight' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('radio', { name: 'Barbell', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Dumbbell', exact: true })).toBeChecked();
});

test('passes automated WCAG accessibility checks with valid and invalid input', async ({ page }) => {
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.getByRole('textbox', { name: 'Target weight' }).fill('');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
});

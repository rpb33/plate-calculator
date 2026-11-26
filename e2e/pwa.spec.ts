import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { calculateSets } from '../src/calculator';
import { INVENTORY } from '../src/inventory';
import { formatGrams } from '../src/weight';

async function waitForOfflineApp(page: Page) {
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toContain('/plate-calculator/sw.js');
}

test('provides an installable manifest and correctly sized app icons under a subpath', async ({ page, request, browserName, context }) => {
  await page.goto('./');
  await waitForOfflineApp(page);
  const manifestURL = await page.locator('link[rel="manifest"]').evaluate((element) => (element as HTMLLinkElement).href);
  const response = await request.get(manifestURL);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('application/manifest+json');
  const manifest = await response.json();
  expect(manifest.name).toBe('Plate Calculator');
  expect(manifest.display).toBe('standalone');
  const scope = new URL('./', manifestURL).href;
  expect(new URL(manifest.id, manifestURL).href).toBe(scope);
  expect(new URL(manifest.start_url, manifestURL).href).toBe(scope);
  expect(new URL(manifest.scope, manifestURL).href).toBe(scope);
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: '192x192', purpose: 'any' }),
    expect.objectContaining({ sizes: '512x512', purpose: 'any' }),
    expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
  ]));
  for (const icon of manifest.icons) {
    const url = new URL(icon.src, manifestURL);
    expect(url.href.startsWith(scope)).toBe(true);
    const response = await request.get(url.href);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
    const png = await response.body();
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(icon.sizes);
  }
  const appleIconURL = await page.locator('link[rel="apple-touch-icon"]').evaluate((element) => (element as HTMLLinkElement).href);
  const appleIcon = await (await request.get(appleIconURL)).body();
  expect([appleIcon.readUInt32BE(16), appleIcon.readUInt32BE(20)]).toEqual([180, 180]);
  if (browserName === 'chromium') {
    const session = await context.newCDPSession(page);
    await expect.poll(async () => (await session.send('Page.getInstallabilityErrors')).installabilityErrors).toEqual([]);
    await session.detach();
  }
});

test('reopens and calculates offline with saved inputs and both equipment modes', async ({ page, context }) => {
  await page.goto('./');
  await waitForOfflineApp(page);
  await page.getByRole('textbox', { name: 'Target weight' }).fill('103');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Target weight' })).toHaveValue('103');
  const barbell = calculateSets(103_000, 20_000, 'barbell', 50, INVENTORY);
  await expect(page.locator('.achieved')).toHaveText(barbell.map((set) => `${formatGrams(set.actualG!)}kg`));
  await page.getByRole('radio', { name: 'Dumbbell', exact: true }).check();
  await page.getByRole('radio', { name: '30 mm' }).check();
  await page.getByRole('textbox', { name: 'Target weight' }).fill('17.5');
  await page.getByRole('textbox', { name: 'Bar weight' }).fill('2.5');
  const dumbbell = calculateSets(17_500, 2_500, 'dumbbell', 30, INVENTORY);
  await expect(page.locator('.achieved')).toHaveText(dumbbell.map((set) => `${formatGrams(set.actualG!)}kg`));
  // The explicit HTML URL and query strings must also work when launched offline.
  const reopened = await context.newPage();
  await reopened.goto(new URL('index.html?source=homescreen', page.url()).href);
  await expect(reopened.getByRole('radio', { name: '30 mm' })).toBeChecked();
  await expect(reopened.locator('.achieved')).toHaveText(dumbbell.map((set) => `${formatGrams(set.actualG!)}kg`));
  await reopened.getByRole('textbox', { name: 'Target weight' }).fill('');
  await expect(reopened.locator('.set-card')).toHaveCount(0);
  await context.setOffline(false);
});

test('activates updates on request, preserves settings, and only cleans its own caches', async ({ page }) => {
  // An isolated origin serves two real worker versions without changing dist/
  // or interfering with the other browser tests running in parallel.
  let revision = 1;
  const root = resolve('dist');
  const prefix = '/plate-calculator/';
  const mime: Record<string, string> = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url!, 'http://localhost').pathname;
      if (!pathname.startsWith(prefix)) { response.writeHead(404).end(); return; }
      const path = resolve(root, pathname.slice(prefix.length) || 'index.html');
      if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
      let body: Buffer | string = await readFile(path);
      if (pathname.endsWith('/sw.js')) {
        body = body.toString().replace(/const BUILD_ID = "[a-f0-9]+";/, `const BUILD_ID = "test-version-${revision}";`);
      }
      response.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server has no port.');
  try {
    await page.goto(`http://127.0.0.1:${address.port}${prefix}`);
    await waitForOfflineApp(page);
    await page.getByRole('textbox', { name: 'Target weight' }).fill('103');
    await page.evaluate(async () => {
      await caches.open('another-app');
      await caches.open(`plate-calculator:${location.origin}/other-project/:old-build`);
    });
    await expect(page.getByRole('button', { name: 'Update app' })).toBeHidden();
    revision = 2;
    await page.evaluate(async () => { await (await navigator.serviceWorker.ready).update(); });
    await expect(page.getByRole('button', { name: 'Update app' })).toBeVisible();
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => navigator.serviceWorker.controller?.state)).toBe('activated');
    expect((await page.evaluate(() => caches.keys())).some((key) => key.endsWith('test-version-1'))).toBe(true);
    await page.getByRole('button', { name: 'Update app' }).click();
    await expect(page.getByRole('textbox', { name: 'Target weight' })).toHaveValue('103');
    await expect(page.getByRole('button', { name: 'Update app' })).toBeHidden();
    await expect.poll(() => page.evaluate(() => caches.keys())).toEqual(expect.arrayContaining([
      'another-app', `plate-calculator:http://127.0.0.1:${address.port}/other-project/:old-build`,
      `plate-calculator:http://127.0.0.1:${address.port}${prefix}:test-version-2`,
    ]));
    expect((await page.evaluate(() => caches.keys())).some((key) => key.endsWith('test-version-1'))).toBe(false);
  } finally {
    await page.close();
    await new Promise<void>((done, reject) => { server.close((error) => error ? reject(error) : done()); server.closeAllConnections(); });
  }
});

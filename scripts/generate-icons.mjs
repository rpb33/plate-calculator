// Regenerate install icons from the existing vector favicon. No extra dependencies.
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { readFile, mkdir, copyFile } from 'node:fs/promises';

const svg = (await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8'))
  .replace('rx="14"', 'rx="0"');
const directory = new URL('../public/icons/', import.meta.url);
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH || undefined,
});
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const size of [180, 192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
    const filename = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`;
    await page.locator('svg').screenshot({ path: fileURLToPath(new URL(filename, directory)) });
  }
  // The mark fits within the central 80% safe circle on this opaque square icon.
  await copyFile(new URL('icon-512.png', directory), new URL('maskable-512.png', directory));
} finally {
  await browser.close();
}

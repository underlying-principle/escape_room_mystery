/**
 * Map/boot smoke: boots into the map with a fully-completed save and verifies
 * every region renders its 10 nodes and no scrollbars appear.
 * Run: node scripts/map-e2e.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5199/';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2400);

// Seed a fully-completed save, then reload.
await page.evaluate(() => {
  const completed = {};
  for (let i = 1; i <= 60; i++) completed['S' + String(i).padStart(2, '0')] = { stars: 3, bestMoves: 10, bestTimeMs: 60000 };
  localStorage.setItem(
    'the-signal-save-v1',
    JSON.stringify({ version: 1, highestUnlocked: 60, completed, checkpoint: null, map: { x: -2900, y: -200, zoom: 0.8 }, settings: { muted: true }, stats: { totalMoves: 500, hintsUsed: 0, levelsCompleted: 60 }, savedAt: Date.now() }),
  );
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2600);
// Direct gameplay entry: a returning player boots into their latest level —
// press Home to reach the map.
await page.getByRole('button', { name: /Back to signal map/ }).click();
await page.waitForTimeout(1400);

const nodes = await page.locator('.map-node').count();
const locked = await page.locator('.map-node.locked').count();
const regions = await page.locator('.map-region-label').count();
const hasScrollbar = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth || document.documentElement.scrollHeight > window.innerHeight);
console.log('nodes:', nodes, '| locked:', locked, '| region labels:', regions, '| page scrollbars:', hasScrollbar);

// Pan drag works and moves the world.
const before = await page.evaluate(() => document.querySelector('.map-world').style.transform);
await page.mouse.move(640, 400);
await page.mouse.down();
await page.mouse.move(500, 340, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(300);
const after = await page.evaluate(() => document.querySelector('.map-world').style.transform);
console.log('pan works:', before !== after);

await page.screenshot({ path: 'gui-test-screenshots/m1-map-complete.png' });
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'No console errors.');
await browser.close();

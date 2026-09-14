/**
 * Visual smoke check with a real browser (system Edge via Playwright).
 * Captures: level map, a World 1 level, a World 3 reaction level, a new
 * World 6 level, letter-picker interaction, and a 360px mobile view.
 * Run: node scripts/visual-check.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173/';
const OUT = 'gui-test-screenshots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];

async function newPage(width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
  return page;
}

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });

// --- Desktop 16:9 ---
const page = await newPage(1280, 720);
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await shot(page, '01-map-desktop');

// unlock the whole campaign so any level can be opened directly
await page.evaluate(() => {
  const records = {};
  for (const id of ['w1-l1', 'w1-l2', 'w1-l3', 'w1-l4', 'w2-l5', 'w2-l6', 'w2-l7', 'w2-l8', 'w3-l9', 'w3-l10', 'w3-l11', 'w3-l12', 'w4-l13', 'w4-l14', 'w4-l15', 'w4-l16', 'w5-l17', 'w5-l18', 'w5-l19', 'w5-l20', 'w6-l21']) {
    records[id] = { stars: 3, bestMoves: 3, bestTimeMs: 1000, hintsUsed: 0 };
  }
  localStorage.setItem('wordshift-progress-v1', JSON.stringify({ records, lastLevelId: 'w1-l1', muted: true }));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);

// open level 3 (Cold Comfort) — the level from the user's screenshot
await page.getByRole('button', { name: /Level w1-l3/ }).click();
await page.waitForTimeout(1800);
await shot(page, '02-level3-centered');

// click the first tile (probe coordinates across the word band), then pick a letter
const canvas = page.locator('.word-board canvas');
const box = await canvas.boundingBox();
const cy = box.y + box.height / 2;
await shot(page, '03-before-pick');

// Instead of computing world->pixel, probe three x offsets for the first tile
const offsets = [-0.28, -0.22, -0.34, -0.18, -0.4];
let picked = false;
for (const frac of offsets) {
  await page.mouse.click(box.x + box.width * (0.5 + frac), cy);
  await page.waitForTimeout(400);
  if (await page.locator('.letter-panel').isVisible().catch(() => false)) {
    picked = true;
    break;
  }
}
await shot(page, picked ? '04-picker-open' : '04-picker-failed');
if (picked) {
  await page.locator('.letter-grid button', { hasText: 'R' }).first().click();
  await page.waitForTimeout(900);
  await shot(page, '05-after-letter');
}

// World 3 reaction level (w3-l9) and new World 6 level (w6-l22)
await page.getByRole('button', { name: /Back to level map/ }).click();
await page.waitForTimeout(900);
await shot(page, '06-map-unlocked');
await page.getByRole('button', { name: /Level w6-l22/ }).click();
await page.waitForTimeout(2200);
await shot(page, '07-level22-singularity');
await page.getByRole('button', { name: /Back to level map/ }).click();
await page.waitForTimeout(700);
await page.getByRole('button', { name: /Level w3-l9/ }).click();
await page.waitForTimeout(2000);
await shot(page, '08-level9-reaction');

// --- Mobile 360x640 ---
const mobile = await newPage(360, 640);
await mobile.goto(BASE, { waitUntil: 'domcontentloaded' });
await mobile.waitForTimeout(2000);
await shot(mobile, '09-mobile-map');
await mobile.evaluate(() => {
  const records = {};
  for (const id of ['w1-l1', 'w1-l2']) {
    records[id] = { stars: 3, bestMoves: 3, bestTimeMs: 1000, hintsUsed: 0 };
  }
  localStorage.setItem('wordshift-progress-v1', JSON.stringify({ records, lastLevelId: 'w1-l1', muted: true }));
});
await mobile.reload({ waitUntil: 'domcontentloaded' });
await mobile.waitForTimeout(1800);
await mobile.getByRole('button', { name: /Level w1-l3/ }).click();
await mobile.waitForTimeout(1800);
await shot(mobile, '10-mobile-level');
await mobile.close();

await page.close();
await browser.close();

console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'No console errors.');
console.log(`Screenshots in ${OUT}/`);

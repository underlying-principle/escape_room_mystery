/**
 * Win-flow check: solve level 2 (COLD→CARE, 3 moves) via keyboard input and
 * capture the completion panel. Level 1 is the Signal Cube and has its own
 * check (scripts/grid-visual-check.mjs).
 * Run: node scripts/win-flow-check.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5199/';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);
await page.evaluate(() => {
  const records = {
    'w1-l1': { stars: 3, bestMoves: 8, bestTimeMs: 20000, hintsUsed: 0 },
  };
  localStorage.setItem('wordshift-progress-v1', JSON.stringify({ records, lastLevelId: 'w1-l1', muted: true }));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1600);
await page.getByRole('button', { name: /Level w1-l2/ }).click();
await page.waitForTimeout(1600);

// 4-letter word at exact screen center; tile pitch measured from the fit math ≈ 183px
const cy = 360;
const xs = [365, 549, 732, 915];
// COLD→CARE: pos2 L→R, pos1 O→A, pos3 D→E
await page.mouse.click(xs[2], cy);
await page.waitForTimeout(350);
await page.keyboard.press('r');
await page.waitForTimeout(700);
await page.mouse.click(xs[1], cy);
await page.waitForTimeout(350);
await page.keyboard.press('a');
await page.waitForTimeout(700);
await page.mouse.click(xs[3], cy);
await page.waitForTimeout(350);
await page.keyboard.press('e');
await page.waitForTimeout(1600);
await page.screenshot({ path: 'gui-test-screenshots/11-win-panel.png' });

console.log(errors.length ? `PAGE ERRORS:\n${errors.join('\n')}` : 'No page errors.');
await browser.close();

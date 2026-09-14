/** Mobile 360x640 check for the level-1 grid cube. Run: node scripts/grid-mobile-check.mjs */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5199/';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.getByRole('button', { name: /Level w1-l1/ }).click();
await page.waitForTimeout(2000);
await page.screenshot({ path: 'gui-test-screenshots/g6-grid-mobile.png' });

// tap the centre tile and screenshot the selection state
await page.locator('.signal-tile').nth(4).click();
await page.waitForTimeout(400);
await page.screenshot({ path: 'gui-test-screenshots/g7-grid-mobile-select.png' });

console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'No console errors.');
await browser.close();

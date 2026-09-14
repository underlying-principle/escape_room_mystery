/**
 * Daily spin wheel verification with a mocked CrazyGames SDK:
 *  1) crystal chip visible top-left on level 1 and on the map
 *  2) free spin spins, awards crystals, starts the 24h lock
 *  3) film icon requests a 'rewarded' ad; on adFinished grants +1 spin
 *  4) bonus spin is spendable while free is locked; lock counts down
 * Run: node scripts/verify-spin-wheel.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5199/';
const OUT = 'gui-test-screenshots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

// Mock the portal-injected CrazyGames SDK before any page script runs.
await page.addInitScript(() => {
  window.adCalls = [];
  window.CrazyGames = {
    SDK: {
      init: () => Promise.resolve(),
      game: { gameplayStart() {}, gameplayStop() {}, happytime() {} },
      ad: {
        requestAd(type, cb) {
          window.adCalls.push(type);
          window.setTimeout(() => cb.adFinished(), 300);
        },
      },
    },
  };
});

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);

// 1) Chip on the game screen, top-left, count 0.
const chipBox = await page.locator('.crystal-chip').boundingBox();
const hudBox = await page.locator('.signal-header .home-button').boundingBox();
console.log('1) chip on level:', !!chipBox, chipBox ? `at (${Math.round(chipBox.x)},${Math.round(chipBox.y)})` : '');
console.log('   home button clear of chip:', hudBox && chipBox ? hudBox.x >= chipBox.x + chipBox.width - 2 : 'n/a');
await page.screenshot({ path: `${OUT}/s10-chip-on-level.png` });

// 2) Open the wheel: free spin ready.
await page.locator('.crystal-chip').click();
await page.waitForTimeout(400);
const statusReady = await page.locator('.spin-status').textContent();
console.log('2) wheel open, status:', statusReady?.trim());
await page.screenshot({ path: `${OUT}/s11-wheel-ready.png` });

// 3) Free spin: consumes the free spin, awards crystals, locks for 24h.
await page.locator('.spin-button').click();
await page.waitForTimeout(5200);
const statusAfter = (await page.locator('.spin-status').textContent())?.trim();
const crystals = await page.locator('.crystal-chip b').textContent();
const spinDisabled = await page.locator('.spin-button').isDisabled();
console.log('3) after free spin: crystals =', crystals, '| status:', statusAfter, '| spin disabled:', spinDisabled);
await page.screenshot({ path: `${OUT}/s12-wheel-after-free.png` });

// 4) Rewarded ad: film icon -> SDK 'rewarded' request -> +1 spin badge.
await page.locator('.spin-ad-button').click();
await page.waitForTimeout(900);
const adTypes = await page.evaluate(() => window.adCalls);
const badge = await page.locator('.spin-ad-badge').textContent().catch(() => null);
console.log('4) ad requested with types:', JSON.stringify(adTypes), '| expected ["rewarded"]:', JSON.stringify(adTypes) === '["rewarded"]', '| badge:', badge);
await page.screenshot({ path: `${OUT}/s13-wheel-bonus.png` });

// 5) Spend the bonus spin while the free one is still locked.
await page.locator('.spin-button').click();
await page.waitForTimeout(5200);
const crystals2 = await page.locator('.crystal-chip b').textContent();
const badgeAfter = await page.locator('.spin-ad-badge').count();
const statusLocked = (await page.locator('.spin-status').textContent())?.trim();
console.log('5) after bonus spin: crystals =', crystals2, '(grew:', Number(crystals2) > Number(crystals), ') badge gone:', badgeAfter === 0, '| status:', statusLocked);

// 6) Chip present on the map screen too.
await page.keyboard.press('Escape');
await page.locator('.spin-close').click();
await page.getByRole('button', { name: /Back to signal map/ }).click();
await page.waitForTimeout(700);
const chipOnMap = await page.locator('.crystal-chip').isVisible();
console.log('6) chip on map:', chipOnMap, '| crystals persisted:', await page.locator('.crystal-chip b').textContent());

// 7) Spin state persisted in the save.
const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('the-signal-save-v1')).spin);
console.log('7) saved spin state:', JSON.stringify({ ...persisted, lastFreeSpinAt: persisted.lastFreeSpinAt > 0 }));

console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();

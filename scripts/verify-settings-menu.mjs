/**
 * Wheel layout + settings menu verification:
 *  1) wheel fully inside the panel, centered
 *  2) bulbs spark on random clocks (not synchronized)
 *  3) settings gear opens menu; every button opens its own view
 *  4) game speed persists; Restart remounts level; To menu goes to map
 *  5) version stamp + Official button present
 * Run: node scripts/verify-settings-menu.mjs
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

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);

// 1) Wheel inside the box, centered.
await page.locator('.crystal-chip').click();
await page.waitForTimeout(400);
const geo = await page.evaluate(() => {
  const panel = document.querySelector('.spin-panel').getBoundingClientRect();
  const rig = document.querySelector('.spin-rig').getBoundingClientRect();
  const pointer = document.querySelector('.spin-pointer').getBoundingClientRect();
  const crystal = document.querySelector('.spin-slice-inner svg');
  return {
    panel: { w: Math.round(panel.width), top: Math.round(panel.top) },
    pointerInside: pointer.top >= panel.top - 1,
    rigCenteredX: Math.abs(rig.left + rig.width / 2 - (panel.left + panel.width / 2)) < 2,
    crystalSize: crystal ? crystal.getAttribute('width') : null,
  };
});
console.log('1) panel width:', geo.panel.w, '| pointer inside panel:', geo.pointerInside, '| wheel centered:', geo.rigCenteredX, '| crystal svg:', geo.crystalSize, '(expect 36)');
await page.screenshot({ path: `${OUT}/w1-wheel-centered.png` });

// 2) Bulbs: capture two frames, each should catch different lit bulbs.
const litBulbs = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.spin-bulb')]
      .map((b, i) => ({ i, o: Number(getComputedStyle(b).opacity) }))
      .filter((b) => b.o > 0.8)
      .map((b) => b.i),
  );
const lit1 = await litBulbs();
await page.waitForTimeout(900);
const lit2 = await litBulbs();
const different = JSON.stringify(lit1) !== JSON.stringify(lit2);
console.log('2) lit bulbs frame A:', JSON.stringify(lit1), '| frame B:', JSON.stringify(lit2), '| random pattern:', different);

// 3) Settings gear — top right, opens the menu.
await page.keyboard.press('Escape');
await page.locator('.spin-close').click();
const gearBox = await page.locator('.gear-button').boundingBox();
await page.locator('.gear-button').click();
await page.waitForTimeout(400);
const setTiles = await page.locator('.set-tile').count();
const version = await page.locator('.set-version').textContent();
console.log('3) gear at right:', gearBox ? gearBox.x > 1100 : false, '| tiles:', setTiles, '| version:', version?.trim());
await page.screenshot({ path: `${OUT}/w2-settings.png` });

// 4) Each sub-view opens.
for (const [label, probe] of [
  ['Language', 'English'],
  ['Credits', 'WordShift'],
  ['Help', 'Swap two neighbouring'],
  ['Official', 'crazygames.com'],
]) {
  await page.locator('.set-tile, .set-action.official').filter({ hasText: label }).first().click();
  await page.waitForTimeout(250);
  const found = await page.getByText(probe).first().isVisible().catch(() => false);
  console.log(`4) ${label} opens (${probe}):`, found);
  await page.screenshot({ path: `${OUT}/w3-settings-${label.toLowerCase()}.png` });
  await page.locator('.set-action', { hasText: '← Back' }).click();
  await page.waitForTimeout(200);
}

// 5) Delete shows a confirm (do NOT confirm).
await page.locator('.set-tile', { hasText: 'Delete' }).click();
await page.waitForTimeout(250);
const confirm = await page.getByText('Delete everything').isVisible().catch(() => false);
console.log('5) Delete opens confirm:', confirm);
await page.locator('.set-action', { hasText: 'Keep my save' }).click();
await page.waitForTimeout(200);

// 6) Game speed persists to the save.
await page.locator('.set-speed input').fill('2'); // x1.5
await page.waitForTimeout(400);
const speed = await page.evaluate(() => JSON.parse(localStorage.getItem('the-signal-save-v1')).settings.gameSpeed);
console.log('6) game speed saved:', speed, '| expected 1.5:', speed === 1.5);

// 7) Restart remounts the level (fresh timer), To menu goes to the map.
await page.locator('.set-action', { hasText: 'Restart' }).click();
await page.waitForTimeout(700);
const levelAfterRestart = await page.locator('.signal-game').getAttribute('data-level');
const timeText = await page.locator('.stat-pill .stat-value').nth(1).textContent();
console.log('7) restart: level', levelAfterRestart, '| timer reset to', timeText?.trim());
await page.locator('.gear-button').click();
await page.waitForTimeout(300);
await page.locator('.set-action', { hasText: 'To menu' }).click();
await page.waitForTimeout(700);
const onMap = await page.locator('.signal-map').isVisible();
console.log('8) To menu -> map visible:', onMap);
await page.screenshot({ path: `${OUT}/w4-gear-on-map.png` });

console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();

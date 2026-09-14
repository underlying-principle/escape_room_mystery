/**
 * THE SIGNAL end-to-end smoke: boots into Level 1, solves it via real clicks,
 * continues to Level 2, reloads for checkpoint resume, and checks the map.
 * Run: node scripts/signal-e2e.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5199/';
const OUT = 'gui-test-screenshots';
fs.mkdirSync(OUT, { recursive: true });

const defs = JSON.parse(fs.readFileSync('src/data/signalLevels.json', 'utf8'));
const s01 = defs.find((d) => d.id === 'S01');
const TARGET = s01.targets.map((t) => t.values.join('')).join('');

// BFS solver for the 3×3 word rows.
const EDGES = [];
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 3; c++) {
    const i = r * 3 + c;
    if (c < 2) EDGES.push([i, i + 1]);
    if (r < 2) EDGES.push([i, i + 3]);
  }
}
const swap = (s, a, b) => {
  const arr = s.split('');
  [arr[a], arr[b]] = [arr[b], arr[a]];
  return arr.join('');
};
const dist = new Map([[TARGET, 0]]);
{
  let frontier = [TARGET];
  let d = 0;
  while (frontier.length) {
    d++;
    const next = [];
    for (const s of frontier) {
      for (const [a, b] of EDGES) {
        const nb = swap(s, a, b);
        if (!dist.has(nb)) {
          dist.set(nb, d);
          next.push(nb);
        }
      }
    }
    frontier = next;
  }
}
const solve = (from) => {
  const path = [];
  let cur = from;
  while (cur !== TARGET) {
    const d = dist.get(cur);
    for (const [a, b] of EDGES) {
      const nb = swap(cur, a, b);
      if (dist.get(nb) === d - 1) {
        path.push([a, b]);
        cur = nb;
        break;
      }
    }
  }
  return path;
};

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

// 1) Boot — should land directly in Level 1 (new player).
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2600);
const levelId = await page.locator('.signal-game').getAttribute('data-level');
console.log('booted into:', levelId, '| expected S01:', levelId === 'S01');
await page.screenshot({ path: `${OUT}/s1-boot-level1.png` });

// 2) Solve Level 1 through real clicks.
const gridStr = (cells) => cells.map((id) => s01.solvedValues[parseInt(id.slice(1), 10)]).join('').toUpperCase();
let cells = [...s01.startCells];
let cur = gridStr(cells);
const path = solve(cur);
console.log('scramble:', cur, '| par:', dist.get(cur), '| replaying', path.length, 'moves');
for (const [a, b] of path) {
  await page.locator('.signal-tile').nth(a).click();
  await page.waitForTimeout(160);
  await page.locator('.signal-tile').nth(b).click();
  await page.waitForTimeout(420);
  cells = cells.map((id, i) => (i === a ? cells[b] : i === b ? cells[a] : id));
  cur = gridStr(cells);
}
console.log('final grid:', cur, '| solved:', cur === TARGET);
await page.waitForTimeout(1400);
const earnedStars = await page.locator('.result-stars .earned').count();
const routeText = await page.locator('.complete-panel > p').textContent();
console.log('stars earned:', earnedStars, '| expected 3 (solved at par):', earnedStars === 3, '| route:', routeText?.trim());
await page.screenshot({ path: `${OUT}/s2-win-panel.png` });

// 3) Continue to Level 2.
await page.getByRole('button', { name: /NEXT/ }).click();
await page.waitForTimeout(2200);
const l2 = await page.locator('.signal-game').getAttribute('data-level');
console.log('next level:', l2, '| expected S02:', l2 === 'S02');

// 4) Make one move, then reload — the checkpoint should resume with 1 move.
await page.locator('.signal-tile').nth(0).click();
await page.waitForTimeout(150);
await page.locator('.signal-tile').nth(1).click();
await page.waitForTimeout(700);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2600);
const l2b = await page.locator('.signal-game').getAttribute('data-level');
const movesText = await page.locator('.stat-pill .stat-value').first().textContent();
console.log('after reload:', l2b, '| moves display:', movesText.trim(), '| resumed with 1 move:', movesText.trim().startsWith('1/'));
await page.screenshot({ path: `${OUT}/s3-resume.png` });

// 5) Map: home → map shows completed node 01.
await page.getByRole('button', { name: /Back to signal map/ }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/s4-signal-map.png` });
const mapVisible = await page.locator('.signal-map').isVisible().catch(() => false);
const nodeCount = await page.locator('.map-node').count();
console.log('map visible:', mapVisible, '| nodes:', nodeCount);

console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'No console errors.');
await browser.close();

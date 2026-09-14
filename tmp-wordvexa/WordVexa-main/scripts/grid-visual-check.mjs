/**
 * Grid-mode (level 1) visual + interaction check against the 3D cube scene.
 * Click targets come from the DOM tiles' bounding boxes.
 * Run: node scripts/grid-visual-check.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5199/';
const TARGET = 'catdogsun';
const OUT = 'gui-test-screenshots';

// --- solver (full BFS from the target, fine in Node) ---
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

// --- browser ---
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);
await page.getByRole('button', { name: /Level w1-l1/ }).click();
await page.waitForTimeout(2200);
await page.screenshot({ path: `${OUT}/g1-grid-initial.png` });

const grid0 = await page.locator('.signal-game').getAttribute('data-grid');
console.log('scramble:', grid0, '| par:', dist.get(grid0));
if (!grid0 || grid0.length !== 9) throw new Error('data-grid attribute missing');

// DOM tiles: click targets come from the tiles' own bounding boxes
const cellCenter = async (i) => {
  const box = await page.locator('.signal-tile').nth(i).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

// 1) tap a tile → selection highlight; then a far tile → not-adjacent toast
const c0 = await cellCenter(0);
const c8 = await cellCenter(8);
await page.mouse.click(c0.x, c0.y);
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/g2-selected.png` });
await page.mouse.click(c8.x, c8.y);
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/g3-not-adjacent-toast.png` });

// 2) hint highlight then auto-apply
await page.getByRole('button', { name: /HINT/ }).click();
await page.waitForTimeout(350);
await page.screenshot({ path: `${OUT}/g4-hint-highlight.png` });
await page.getByRole('button', { name: /HINT/ }).click();
await page.waitForTimeout(700);
const gridAfterHint = await page.locator('.signal-game').getAttribute('data-grid');
console.log('after hint apply:', gridAfterHint, '(dist', dist.get(gridAfterHint) + ')');

// 3) undo restores the scramble
await page.getByRole('button', { name: /UNDO/ }).click();
await page.waitForTimeout(600);
const gridAfterUndo = await page.locator('.signal-game').getAttribute('data-grid');
console.log('after undo:', gridAfterUndo, '| restored scramble:', gridAfterUndo === grid0);

// 4) drag swap: drag cell 0 rightward
const c1 = await cellCenter(1);
await page.mouse.move(c0.x, c0.y);
await page.mouse.down();
await page.mouse.move((c0.x + c1.x) / 2, c0.y, { steps: 6 });
await page.mouse.move(c1.x, c1.y, { steps: 4 });
await page.mouse.up();
await page.waitForTimeout(650);
const gridAfterDrag = await page.locator('.signal-game').getAttribute('data-grid');
console.log('after drag:', gridAfterDrag, '| is swap(0,1):', gridAfterDrag === swap(grid0, 0, 1));

// 5) solve the rest with tap-tap swaps (row match → comet ring → grand animation → panel)
const path = solve(gridAfterDrag);
console.log('replaying', path.length, 'solver swaps…');
let cur = gridAfterDrag;
let ringShot = false;
for (const [a, b] of path) {
  const A = await cellCenter(a);
  const B = await cellCenter(b);
  await page.mouse.click(A.x, A.y);
  await page.waitForTimeout(220);
  await page.mouse.click(B.x, B.y);
  await page.waitForTimeout(560);
  cur = swap(cur, a, b);
  if (!ringShot && cur.slice(0, 3) === 'cat') {
    ringShot = true;
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/g4b-row-ring.png` });
  }
}
const finalGrid = await page.locator('.signal-game').getAttribute('data-grid');
console.log('final grid:', finalGrid, '| solved:', finalGrid === TARGET);
await page.waitForTimeout(450);
await page.screenshot({ path: `${OUT}/g5-victory-flash.png` });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/g6-complete-panel.png` });
await page.close();

// 6) timeout → SIGNAL LOST game over (QA time override)
const page2 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page2.on('pageerror', (err) => errors.push(err.message));
await page2.goto(`${BASE}?gridTimeMs=2000`, { waitUntil: 'domcontentloaded' });
await page2.waitForTimeout(2200);
await page2.getByRole('button', { name: /Level w1-l1/ }).click();
await page2.waitForTimeout(3200);
const overVisible = await page2.getByText('SIGNAL LOST').isVisible().catch(() => false);
console.log('game over shown after 2s time limit:', overVisible);
await page2.screenshot({ path: `${OUT}/g7-game-over.png` });
await page2.close();

console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'No console errors.');
await browser.close();

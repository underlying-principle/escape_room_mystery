/**
 * Map verification:
 *  - footer spans full viewport width
 *  - current-level ring exists on exactly the current node (never gates only)
 *  - no two nodes overlap anywhere on the map (all 60 bounding boxes)
 *  - world titles present for all six worlds (1/3/5 above, 2/4/6 below)
 *  - per-world background blobs render
 *  - premium hover state screenshots
 * Run: node scripts/verify-map-fixes.mjs
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

const openMapAt = async (unlocked, shot) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate((u) => {
    localStorage.setItem(
      'the-signal-save-v1',
      JSON.stringify({
        version: 1,
        highestUnlocked: u,
        completed: {},
        checkpoint: null,
        map: null,
        settings: { muted: true },
        stats: { totalMoves: 0, hintsUsed: 0, levelsCompleted: 0 },
        savedAt: Date.now(),
      }),
    );
  }, unlocked);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /Back to signal map/ }).click();
  await page.waitForTimeout(600);
  if (shot) await page.screenshot({ path: `${OUT}/${shot}` });
};

// 1) World 1 view (current level 13, like the user's screenshot).
await openMapAt(13, 'm1-map-current-centered.png');

// 2) Footer + ring + background checks.
const checks = await page.evaluate(() => {
  const fw = document.querySelector('.map-footer').getBoundingClientRect();
  const rings = [...document.querySelectorAll('.node-current-ring')];
  const ringNode = rings[0]?.closest('.map-node')?.querySelector('b')?.textContent ?? null;
  const blobs = document.querySelectorAll('.map-bg-blob').length;
  const nodes = [...document.querySelectorAll('.map-node')];
  const boxes = nodes.map((n) => {
    const r = n.getBoundingClientRect();
    return { label: n.querySelector('b')?.textContent, x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const overlaps = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ix > 0 && iy > 0) overlaps.push(`${a.label}∩${b.label}`);
    }
  }
  return {
    footerWidth: Math.round(fw.width),
    viewport: window.innerWidth,
    ringCount: rings.length,
    ringNode,
    blobs,
    overlapCount: overlaps.length,
    overlaps: overlaps.slice(0, 8),
  };
});
console.log('1) footer width:', checks.footerWidth, '/', checks.viewport, '| full width:', checks.footerWidth === checks.viewport);
console.log('2) current rings:', checks.ringCount, '| on node:', checks.ringNode, '| expected node 13:', checks.ringNode === '13');
console.log('3) background blobs:', checks.blobs, '| expected 6:', checks.blobs === 6);
console.log('4) overlapping node pairs:', checks.overlapCount, checks.overlaps.join(',') || '');

// 3) Premium hover screenshot on the current node.
const current = page.locator('.node-current-ring').locator('..');
await current.hover();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/m2-node-hover.png` });
console.log('5) hover screenshot captured');

// 4) Each world center: titles visible, above/below alternation.
for (const [world, unlocked] of [[1, 5], [2, 15], [3, 25], [4, 35], [5, 45], [6, 55]]) {
  await openMapAt(unlocked, `m3-world${world}.png`);
  const info = await page.evaluate((w) => {
    const label = [...document.querySelectorAll('.map-region-label')].find((l) =>
      l.querySelector('small')?.textContent === `WORLD 0${w}`,
    );
    if (!label) return { present: false };
    const r = label.getBoundingClientRect();
    // Only this world's own nodes decide above/below placement.
    const ownNodes = [...document.querySelectorAll('.map-node')]
      .map((n) => n.getBoundingClientRect())
      .filter((_, i) => Math.floor(i / 10) === w - 1);
    const nodeTop = Math.min(...ownNodes.map((b) => b.y));
    const nodeBottom = Math.max(...ownNodes.map((b) => b.y + b.height));
    const fullyOnScreen = r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight;
    return {
      present: true,
      name: label.querySelector('strong')?.textContent,
      fullyOnScreen,
      partiallyOnScreen: r.right > 0 && r.left < window.innerWidth && r.bottom > 40 && r.top < window.innerHeight - 40,
      aboveNodes: r.bottom < nodeTop,
      belowNodes: r.top > nodeBottom,
    };
  }, world);
  const wantAbove = world % 2 === 1;
  console.log(
    `world ${world}: present=${info.present} name=${info.name} onScreen(partial)=${info.partiallyOnScreen} ` +
      `placement=${wantAbove ? 'above' : 'below'} ok=${wantAbove ? info.aboveNodes : info.belowNodes}`,
  );
}

console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();

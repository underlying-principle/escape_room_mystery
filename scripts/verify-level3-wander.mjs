/**
 * Wander-mechanic verification (DOM board letters, real timers):
 *  1) fresh boot into S01 — no intro/heading text, clean target area
 *  2) S03 drift — E hops while GEM is incomplete
 *  3) S03 settle — GEM pre-solved -> E stays put
 *  4) S04 twin drift — Y hops (~5s) and C hops (~7.5s)
 *  5) S04 partial settle — SKY pre-solved -> Y stays put while C hops
 * Run: node scripts/verify-level3-wander.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5199/';
const OUT = 'gui-test-screenshots';
fs.mkdirSync(OUT, { recursive: true });
const defs = JSON.parse(fs.readFileSync('src/data/signalLevels.json', 'utf8'));
const def = (id) => defs.find((d) => d.id === id);

// tile tNN carries solvedValues[NN]; plant the given words at their home
// cells (rows top-down, left-to-right) on top of the shipped start.
const seedCells = (id, solvedWords) => {
  const d = def(id);
  const cells = [...d.startCells];
  solvedWords.forEach((word, row) => {
    [...word].forEach((ch, col) => {
      const targetCell = row * d.size + col;
      const tileId = `t${String(d.solvedValues.indexOf(ch)).padStart(2, '0')}`;
      const current = cells.indexOf(tileId);
      const displaced = cells[targetCell];
      cells[targetCell] = tileId;
      cells[current] = displaced;
    });
  });
  return cells;
};

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const boardLetters = () =>
  page.evaluate(() => [...document.querySelectorAll('.signal-tile .sr-only')].map((n) => n.textContent).join(''));

const bootInto = async (id, cells, shot) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  if (cells) {
    await page.evaluate((json) => {
      localStorage.setItem(
        'the-signal-save-v1',
        JSON.stringify({
          version: 1,
          highestUnlocked: 4,
          completed: { S01: { stars: 3, bestMoves: 8, bestTimeMs: 45000 }, S02: { stars: 2, bestMoves: 5, bestTimeMs: 52000 }, S03: { stars: 2, bestMoves: 7, bestTimeMs: 60000 } },
          checkpoint: { levelId: json.id, cells: json.cells, moves: 0, elapsedMs: 0, hintsUsed: 0, savedAt: Date.now() },
          map: null,
          settings: { muted: true },
          stats: { totalMoves: 0, hintsUsed: 0, levelsCompleted: 3 },
          savedAt: Date.now(),
        }),
      );
    }, { id, cells });
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const level = await page.locator('.signal-game').getAttribute('data-level');
  if (level !== id) throw new Error(`expected boot into ${id}, got ${level}`);
  if (shot) await page.screenshot({ path: `${OUT}/${shot}` });
};

// 1) Fresh boot — S01, clean headings.
await bootInto('S01', null, 'v1-boot-s01-clean.png');
const clean = await page.evaluate(() => ({
  intro: document.querySelectorAll('.signal-intro').length,
  caption: document.querySelectorAll('.signal-caption').length,
  title: document.querySelectorAll('.signal-title').length,
}));
console.log('1) S01 boot clean:', Object.values(clean).every((n) => n === 0), JSON.stringify(clean));

// 2) S03 drift — E hops while GEM incomplete.
await bootInto('S03', def('S03').startCells, 'v2-s03-load.png');
const s3a = await boardLetters();
await page.waitForTimeout(6200);
const s3b = await boardLetters();
console.log('2) S03 drift:', s3a, '->', s3b, '| E moved:', s3a.indexOf('E') !== s3b.indexOf('E'));

// 3) S03 settle — GEM solved at home -> E must not move.
await bootInto('S03', seedCells('S03', ['GEM']), 'v3-s03-settled.png');
const s3c = await boardLetters();
await page.waitForTimeout(6200);
const s3d = await boardLetters();
console.log('3) S03 settle (GEM done):', s3c, '->', s3d, '| board unchanged:', s3c === s3d);

// 4) S04 twin drift — Y hops ~5s, C hops ~7.5s.
await bootInto('S04', def('S04').startCells, 'v4-s04-load.png');
const s4a = await boardLetters();
await page.waitForTimeout(6200); // after Y's first hop, before C's
const s4b = await boardLetters();
await page.waitForTimeout(2600); // after C's first hop
const s4c = await boardLetters();
console.log('4) S04 drift:', s4a, '->', s4b, '->', s4c);
console.log('   Y moved by 6.2s:', s4a.indexOf('Y') !== s4b.indexOf('Y'), '| C moved by 8.8s:', s4b.indexOf('C') !== s4c.indexOf('C'));

// 5) S04 partial settle — SKY solved -> Y pinned, C still drifts (C's first
//    hop lands at ~7.5s thanks to the stagger).
await bootInto('S04', seedCells('S04', ['SKY']), 'v5-s04-sky-settled.png');
const s4d = await boardLetters();
await page.waitForTimeout(9200);
const s4e = await boardLetters();
console.log('5) S04 settle (SKY done):', s4d, '->', s4e);
console.log('   Y stayed:', s4d.indexOf('Y') === s4e.indexOf('Y'), '| C moved:', s4d.indexOf('C') !== s4e.indexOf('C'));

console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();

/**
 * Level-design helper: BFS from a start word and list every word reachable at
 * exactly distance D, each with one shortest path. Used to pick start/target
 * pairs whose true optimum matches the intended difficulty.
 *
 * Run: npm run levels:search -- <startWord> <distance> [maxShow] [--locked pos=pos,pos=...]
 * e.g. npm run levels:search -- cold 4 12 --locked 0=1
 *      (shows cold, distance 4, with position 0 locked and 1 wildcard)
 */
import fs from 'node:fs';
import { WordGraph } from '../src/engine/wordGraph';
import { solve } from '../src/engine/puzzleSolver';
import { describeMove } from '../src/engine/hintSystem';
import type { LevelData } from '../src/engine/types';

const raw = JSON.parse(fs.readFileSync('public/data/wordGraphCache.json', 'utf8')) as {
  graph: Record<string, string[]>;
};
const graph = new WordGraph(Object.keys(raw.graph), raw.graph);

const [start, distArg, maxShowArg = '10', lockedArg] = process.argv.slice(2);
const dist = parseInt(distArg, 10);
const maxShow = parseInt(maxShowArg, 10);

if (!start || !Number.isInteger(dist) || !graph.has(start)) {
  console.error('usage: npm run levels:search -- <startWord> <distance> [maxShow] [--locked pos=count,...]');
  console.error(`  "${start}" not in dictionary`);
  process.exit(1);
}

// Plain unconstrained BFS by layers from `start`.
const distTo = new Map<string, number>([[start, 0]]);
const parent = new Map<string, string>();
let frontier = [start];
while (frontier.length) {
  const next: string[] = [];
  for (const w of frontier) {
    const d = distTo.get(w)!;
    if (d >= dist) continue;
    for (const nb of graph.neighbors(w)) {
      if (distTo.has(nb)) continue;
      distTo.set(nb, d + 1);
      parent.set(nb, w);
      next.push(nb);
    }
  }
  frontier = next;
}

const hits = [...distTo.entries()].filter(([, d]) => d === dist).map(([w]) => w);

// Rank candidates: prefer words earlier in the frequency-ranked dictionary.
const rank = (w: string) => raw.graph[w] ? Object.keys(raw.graph).indexOf(w) : Number.MAX_SAFE_INTEGER;
hits.sort((a, b) => rank(a) - rank(b));

console.log(`"${start}" → distance ${dist}: ${hits.length} candidate targets (showing ${Math.min(maxShow, hits.length)})`);

const lockedPositions: number[] = [];
let wildcardCount = 0;
if (lockedArg?.startsWith('--locked')) {
  const spec = lockedArg.replace('--locked', '').trim(); // "0=1" → pos0 locked, 1 wildcard
  for (const part of spec.split(',')) {
    const [p, wc] = part.split('=');
    if (p !== '' && p !== undefined) lockedPositions.push(parseInt(p, 10));
    if (wc !== undefined) wildcardCount = parseInt(wc, 10);
  }
}

for (const target of hits.slice(0, maxShow)) {
  const lvl: LevelData = {
    id: 'probe',
    world: 1,
    name: 'probe',
    slots: [{ startWord: start, targetWord: target, lockedPositions }],
    wildcardCount,
    optimalMoveCount: 0,
  };
  const r = solve(lvl, graph);
  const unconstrained = solve({ ...lvl, slots: [{ ...lvl.slots[0], lockedPositions: [] }], wildcardCount: 0 }, graph);
  const tag =
    r === null
      ? 'UNREACHABLE under constraints'
      : `${r.path.length} moves (unconstrained: ${unconstrained?.path.length ?? '—'})`;
  console.log(`\n  ${start.toUpperCase()} → ${target.toUpperCase()}  [${tag}]`);
  if (r) for (const m of r.path) console.log(`     ${describeMove(lvl, m)}`);
}

/**
 * Check specific start→target pairs against the real shipped dictionary:
 * prints the true optimum (unconstrained and under optional constraints).
 * Run: npm run levels:search is for discovery; this is for verification.
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

const pairs: Array<[string, string, number[]?, number?]> = [
  ['cat', 'dog'],
  ['hate', 'love'],
  ['cold', 'warm'],
  ['dark', 'void'],
  ['pink', 'blue'],
  ['moon', 'star'],
  ['fire', 'coal'],
  ['rain', 'snow'],
  ['wave', 'tide'],
  ['sing', 'song'],
  ['wolf', 'bear'],
  ['fish', 'soup'],
  ['lock', 'open'],
  ['vault', 'safes'],
];

for (const [s, t, locked = [], wc = 0] of pairs) {
  if (!graph.has(s) || !graph.has(t)) {
    console.log(`${s.toUpperCase()} → ${t.toUpperCase()}  MISSING from dictionary (${!graph.has(s) ? s : t})`);
    continue;
  }
  const lvl: LevelData = {
    id: 'probe',
    world: 1,
    name: 'probe',
    slots: [{ startWord: s, targetWord: t, lockedPositions: [...locked] }],
    wildcardCount: wc,
    optimalMoveCount: 0,
  };
  const r = solve(lvl, graph);
  const free = solve({ ...lvl, slots: [{ ...lvl.slots[0], lockedPositions: [] }], wildcardCount: 0 }, graph);
  console.log(
    `${s.toUpperCase()} → ${t.toUpperCase()}: ${r ? r.path.length + ' moves' : 'UNREACHABLE'}` +
      `${locked.length ? ` [locked ${locked.join(',')}, wc=${wc}]` : ''} (free: ${free ? free.path.length : '—'})`
  );
  if (r) for (const m of r.path) console.log(`    ${describeMove(lvl, m)}`);
}

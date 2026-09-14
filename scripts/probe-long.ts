/**
 * Probe long ladders: BFS from a start word and print the distance histogram
 * plus sample targets at requested distances. Used to design levels 13-22.
 * Run: npx tsx scripts/probe-long.ts <startWord> [d1,d2,...]
 */
import fs from 'node:fs';
import { WordGraph } from '../src/engine/wordGraph';

const raw = JSON.parse(fs.readFileSync('public/data/wordGraphCache.json', 'utf8')) as {
  graph: Record<string, string[]>;
};
const graph = new WordGraph(Object.keys(raw.graph), raw.graph);
const rankOf = new Map(Object.keys(raw.graph).map((w, i) => [w, i]));

const start = process.argv[2] ?? 'stone';
const wanted = (process.argv[3] ?? '9,10,11,12,13,14,15').split(',').map(Number);

if (!graph.has(start)) {
  console.error(`"${start}" not in dictionary`);
  process.exit(1);
}

const dist = new Map<string, number>([[start, 0]]);
const parent = new Map<string, string>();
let frontier = [start];
let layer = 0;
const histogram: number[] = [];
while (frontier.length && layer < 30) {
  layer++;
  const next: string[] = [];
  for (const w of frontier) {
    for (const nb of graph.neighbors(w)) {
      if (dist.has(nb)) continue;
      dist.set(nb, layer);
      parent.set(nb, w);
      next.push(nb);
    }
  }
  histogram[layer] = next.length;
  frontier = next;
}
console.log(`"${start}" distance histogram:`, histogram.map((n, d) => (n ? `${d}:${n}` : '')).filter(Boolean).join(' '));

for (const d of wanted) {
  const words = [...dist.entries()]
    .filter(([, dd]) => dd === d)
    .sort((a, b) => (rankOf.get(a[0]) ?? 1e9) - (rankOf.get(b[0]) ?? 1e9))
    .slice(0, 6);
  console.log(`\n-- distance ${d}: ${words.length ? '' : 'NONE'} --`);
  for (const [w] of words) {
    const path = [w];
    let cur = w;
    while (parent.has(cur)) {
      cur = parent.get(cur)!;
      path.unshift(cur);
    }
    console.log(`  ${start} → ${w}: ${path.join(' → ')}`);
  }
}

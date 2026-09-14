/**
 * WORDSHIFT — offline word graph pipeline (Phase 0).
 *
 * Reads a curated common-English word list (rank-ordered by frequency),
 * filters to 3-6 letter alphabetic words, builds an adjacency graph where an
 * edge connects two words differing by exactly one letter at one position,
 * and serializes both assets to public/data/.
 *
 * Run: npm run graph
 */
import fs from 'node:fs';
import path from 'node:path';

const RAW_PATH = path.resolve('data/raw/google-10000-english-usa.txt');
const POPULAR_PATH = path.resolve('data/raw/popular.txt');
const OUT_DIR = path.resolve('public/data');

/**
 * Severe terms excluded from the playable dictionary to keep user-buildable
 * words inside PEGI 12. Kept minimal; this is a defensive filter only.
 */
const BLOCKLIST = new Set([
  'faggot',
  'fags',
  'kike',
  'kikes',
  'nigga',
  'nigger',
  'niggers',
  'spic',
  'spics',
  'wetback',
  'whore',
  'whores',
  'cocks',
  'cummed',
  'jizz',
  'rapist',
  'rape',
  'raped',
  'rapes',
  'porn',
  'porno',
  'nude',
  'nudes',
  'anal',
  'anus',
  'fuck',
  'fucks',
  'fucked',
  'fucker',
  'cock',
  'cocks',
  'dick',
  'dicks',
  'tits',
  'boob',
  'boobs',
  'slut',
  'sluts',
  'cunt',
  'cunts',
  'orgy',
  'piss',
  'shit',
  'shits',
  'suck',
  'sucks',
  'sexy',
  'xxx',
  'cum',
  'tgp',
  'bbw',
]);

function main() {
  // A word is playable only if it is BOTH frequency-common (google-10000) and
  // recognized by a curated English word list (popular.txt). The frequency
  // list alone is full of acronyms and web tokens (dvd, sql, ceo, dat…); the
  // intersection enforces the "common REAL words" fairness promise at the
  // data layer, exactly as the spec requires.
  const popular = new Set(
    fs
      .readFileSync(POPULAR_PATH, 'utf8')
      .split(/\r?\n/)
      .map((w) => w.trim().toLowerCase())
  );

  const raw = fs
    .readFileSync(RAW_PATH, 'utf8')
    .split(/\r?\n/)
    .map((w) => w.trim().toLowerCase());

  const seen = new Set<string>();
  const words: string[] = [];
  for (const w of raw) {
    if (!/^[a-z]{3,6}$/.test(w)) continue;
    if (!popular.has(w)) continue;
    if (BLOCKLIST.has(w)) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    words.push(w);
  }

  const wordSet = new Set(words);
  const A = 'a'.charCodeAt(0);
  const graph: Record<string, string[]> = {};
  for (const w of words) {
    const nbrs: string[] = [];
    for (let i = 0; i < w.length; i++) {
      for (let c = 0; c < 26; c++) {
        const ch = String.fromCharCode(A + c);
        if (ch === w[i]) continue;
        const cand = w.slice(0, i) + ch + w.slice(i + 1);
        if (wordSet.has(cand)) nbrs.push(cand);
      }
    }
    graph[w] = nbrs;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const dictionary = JSON.stringify({ format: 1, words });
  fs.writeFileSync(path.join(OUT_DIR, 'dictionary.json'), dictionary);
  const graphJson = JSON.stringify({ format: 1, graph });
  fs.writeFileSync(path.join(OUT_DIR, 'wordGraphCache.json'), graphJson);

  // ---- stats ----
  const byLen = new Map<number, string[]>();
  for (const w of words) {
    const arr = byLen.get(w.length) ?? [];
    arr.push(w);
    byLen.set(w.length, arr);
  }
  const lines: string[] = [];
  lines.push(`words total: ${words.length}`);
  let bytes = 0;
  for (const [len, ws] of [...byLen.entries()].sort((a, b) => a[0] - b[0])) {
    const subset = new Set(ws);
    // connected components within this length class
    const compOf = new Map<string, number>();
    let comps = 0;
    const sizes: number[] = [];
    for (const w of ws) {
      if (compOf.has(w)) continue;
      comps++;
      let size = 0;
      const q = [w];
      compOf.set(w, comps);
      while (q.length) {
        const cur = q.pop()!;
        size++;
        for (const n of graph[cur]) {
          if (subset.has(n) && !compOf.has(n)) {
            compOf.set(n, comps);
            q.push(n);
          }
        }
      }
      sizes.push(size);
    }
    sizes.sort((a, b) => b - a);
    const degs = ws.map((w) => graph[w].length);
    const avgDeg = degs.reduce((a, b) => a + b, 0) / ws.length;
    lines.push(
      `  ${len}-letter: ${ws.length} words | components: ${comps} | largest: ${sizes[0]} | avg degree: ${avgDeg.toFixed(1)}`
    );
  }
  bytes = Buffer.byteLength(dictionary) + Buffer.byteLength(graphJson);
  lines.push(`asset bytes (dictionary+graph): ${(bytes / 1024).toFixed(0)} KB`);
  console.log(lines.join('\n'));
}

main();

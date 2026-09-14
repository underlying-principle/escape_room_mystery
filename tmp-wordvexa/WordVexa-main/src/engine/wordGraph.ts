/**
 * Word adjacency graph: nodes are dictionary words, edges connect words that
 * differ by exactly one letter at exactly one position (same length).
 *
 * In production the graph is precomputed offline by scripts/build-word-graph.ts
 * and shipped as public/data/wordGraphCache.json — never rebuilt in the browser.
 * This module can also build a graph from a plain word list, which tests and
 * build scripts use.
 */
export class WordGraph {
  readonly words: ReadonlySet<string>;
  private readonly adj: ReadonlyMap<string, string[]>;

  constructor(words: Iterable<string>, adjacency?: Record<string, string[]>) {
    this.words = new Set(words);
    if (adjacency) {
      this.adj = new Map(Object.entries(adjacency));
    } else {
      const map = new Map<string, string[]>();
      for (const w of this.words) map.set(w, []);
      const A = 'a'.charCodeAt(0);
      for (const w of this.words) {
        const nbrs = map.get(w)!;
        for (let i = 0; i < w.length; i++) {
          for (let c = 0; c < 26; c++) {
            const ch = String.fromCharCode(A + c);
            if (ch === w[i]) continue;
            const cand = w.slice(0, i) + ch + w.slice(i + 1);
            if (this.words.has(cand)) nbrs.push(cand);
          }
        }
      }
      this.adj = map;
    }
  }

  has(word: string): boolean {
    return this.words.has(word);
  }

  neighbors(word: string): string[] {
    return this.adj.get(word) ?? [];
  }
}

/**
 * Position where a and b differ, assuming same length; -1 if they differ at
 * zero or more-than-one positions.
 */
export function diffPosition(a: string, b: string): number {
  if (a.length !== b.length) return -1;
  let diff = -1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      if (diff !== -1) return -1;
      diff = i;
    }
  }
  return diff;
}

/** Parse the shipped wordGraphCache.json shape: { format: 1, graph: {...} }. */
export function parseGraphJson(data: unknown): WordGraph {
  const d = data as { format?: number; graph?: Record<string, string[]>; words?: string[] };
  if (d && d.format === 1 && d.graph) {
    return new WordGraph(Object.keys(d.graph), d.graph);
  }
  if (d && d.format === 1 && d.words) {
    return new WordGraph(d.words);
  }
  throw new Error('Unrecognized word graph JSON shape');
}

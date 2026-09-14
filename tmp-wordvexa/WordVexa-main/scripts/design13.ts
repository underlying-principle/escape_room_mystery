/**
 * Candidate tester for levels 13-22. Prints the true constrained optimum for
 * each hand-built config and verifies World 5/6 reaction rules actually fire
 * on an optimal path and save at least one move.
 */
import fs from 'node:fs';
import { WordGraph } from '../src/engine/wordGraph';
import { solve } from '../src/engine/puzzleSolver';
import { validateLevel } from '../src/engine/puzzleValidator';
import { describeMove } from '../src/engine/hintSystem';
import type { LevelData } from '../src/engine/types';

const raw = JSON.parse(fs.readFileSync('public/data/wordGraphCache.json', 'utf8')) as {
  graph: Record<string, string[]>;
};
const graph = new WordGraph(Object.keys(raw.graph), raw.graph);

const rule = (tp: number, tl: string, rp: number, rl: string) => ({
  triggerSlot: 0,
  triggerPosition: tp,
  triggerLetter: tl,
  resultSlot: 1,
  resultPosition: rp,
  resultLetter: rl,
});

const slot = (s: string, t: string, locked: number[] = []) => ({
  startWord: s,
  targetWord: t,
  lockedPositions: locked,
});

const CANDIDATES: Array<Record<string, unknown>> = [
  { id: 'L13', slots: [slot('stone', 'start')], wc: 0 },
  { id: 'L14', slots: [slot('stone', 'smart', [2])], wc: 1 },
  { id: 'L15', slots: [slot('stone', 'years', [4])], wc: 1 },
  { id: 'L16', slots: [slot('stone', 'books')], wc: 0 },
  { id: 'L17', slots: [slot('fire', 'book'), slot('black', 'crack')], wc: 0, rules: [rule(0, 'c', 0, 'c')] },
  { id: 'L18', slots: [slot('stone', 'stats'), slot('share', 'years')], wc: 0, rules: [rule(3, 'k', 3, 'k')] },
  { id: 'L19', slots: [slot('stone', 'stars'), slot('share', 'reads')], wc: 0, rules: [rule(3, 'k', 3, 'k')] },
  { id: 'L20', slots: [slot('stone', 'stars'), slot('share', 'ready')], wc: 0, rules: [rule(3, 'k', 3, 'k')] },
  { id: 'L21', slots: [slot('stone', 'beats', [2]), slot('share', 'meant')], wc: 1, rules: [rule(3, 'k', 3, 'k')] },
  { id: 'L22a', slots: [slot('stone', 'smart', [2]), slot('share', 'roads', [4])], wc: 1, rules: [rule(3, 'k', 3, 'k')] },
  { id: 'L22b', slots: [slot('stone', 'smart', [2]), slot('share', 'roads')], wc: 1, rules: [rule(3, 'k', 3, 'k')] },
];

for (const c of CANDIDATES) {
  const level: LevelData = {
    id: c.id as string,
    world: 4,
    name: c.id as string,
    slots: c.slots as LevelData['slots'],
    wildcardCount: c.wc as number,
    reactionRules: c.rules as LevelData['reactionRules'],
    optimalMoveCount: 0,
  };
  const r = solve(level, graph);
  const v = validateLevel({ ...level, intendedMoveCount: r?.path.length }, graph);
  const world = level.slots.length === 2 ? 5 : 4;
  let reactionInfo = '';
  if (level.reactionRules?.length) {
    const fires = (v.optimalPath ?? []).some((m) => (m.reactions?.length ?? 0) > 0);
    const without = validateLevel({ ...level, reactionRules: [], world }, graph);
    const saved = (without.optimalMoveCount ?? 0) - (v.optimalMoveCount ?? 0);
    reactionInfo = ` | reaction fires: ${fires ? 'YES' : 'NO'} | saves: ${saved}`;
  }
  console.log(
    `${c.id}: optimum ${v.optimalMoveCount ?? 'UNREACHABLE'} (free ${(() => {
      const f = validateLevel({ ...level, slots: level.slots.map((s) => ({ ...s, lockedPositions: [] })), wildcardCount: 0, world }, graph);
      return f.optimalMoveCount ?? '—';
    })()})${reactionInfo} | wcRequired: ${v.wildcardRequired}`,
  );
  if (v.optimalPath && (c.id === 'L14' || c.id === 'L17' || c.id === 'L21' || c.id === 'L22')) {
    for (const m of v.optimalPath) console.log(`    ${describeMove(level, m)}`);
  }
}

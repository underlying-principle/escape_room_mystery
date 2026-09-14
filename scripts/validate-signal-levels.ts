/**
 * Release gate: validates ALL 60 signal levels from src/data/signalLevels.json.
 * Run: npm run validate:levels
 */
import fs from 'node:fs';
import {
  applyMoves,
  createBoard,
  isSolved,
  mulberry32,
  hashSeed,
  scrambleFromSolved,
  solveBFS,
  swapCells,
  type SignalLevelDef,
} from '../src/engine/signalEngine';

const raw = JSON.parse(fs.readFileSync('src/data/signalLevels.json', 'utf8')) as SignalLevelDef[];
const errors: string[] = [];

if (!Array.isArray(raw) || raw.length !== 60) {
  errors.push(`expected 60 levels, found ${raw?.length ?? 0}`);
}

for (const def of raw) {
  const tag = `${def.id} ${def.name}`;
  try {
    if (def.solvedValues.length !== def.size * def.size) throw new Error('board size mismatch');
    if (def.size < 3 || def.size > 10) throw new Error(`grid size ${def.size} out of range`);
    if (def.targets.length === 0) throw new Error('no targets');
    if (def.solvedValues.some((v) => typeof v !== 'string' || v.length === 0)) throw new Error('empty tile value');
    if (def.lockedCells.some((c) => c < 0 || c >= def.size * def.size)) throw new Error('locked cell out of range');

    // The shipped def carries the scrambled startCells; the SOLVED layout is
    // created by stripping them.
    const solved = createBoard({ ...def, startCells: undefined });
    if (!isSolved(solved, def)) throw new Error('solved board fails its targets');

    // locked tiles must sit on their solved cells (they can never move)
    for (const c of def.lockedCells) {
      const tile = solved.tiles[solved.cells[c]];
      if (tile.value !== def.solvedValues[c]) throw new Error(`locked cell ${c} not on its solved value`);
    }

    if (!Array.isArray(def.startCells) || def.startCells.length !== def.size * def.size) {
      throw new Error('startCells missing or wrong length');
    }
    if ([...def.startCells].sort().join() !== Object.keys(solved.tiles).sort().join()) {
      throw new Error('startCells is not a permutation of the tile ids');
    }
    const start = createBoard(def);
    if (isSolved(start, def)) throw new Error('shipped start already solved');

    const rng = mulberry32(hashSeed(`validate-${def.id}`));
    const { state, path } = scrambleFromSolved(def, def.parMoves, rng);
    if (isSolved(state, def)) throw new Error('scrambled start already solved');
    let cur = state;
    for (let m = path.length - 1; m >= 0; m--) cur = swapCells(cur, path[m].a, path[m].b);
    if (!isSolved(cur, def)) throw new Error('inverse scramble does not solve');
    if (path.length > def.maxMoves) throw new Error('scramble exceeds maxMoves');
    if (def.maxMoves < def.parMoves) throw new Error('maxMoves below par');
    if (def.timeLimitMs < 30_000) throw new Error('timer below floor');
    if (def.starMoves.three < def.parMoves) throw new Error('3-star threshold below par');

    if (def.size <= 3) {
      const optimal = solveBFS(state, def);
      if (optimal === null) throw new Error('BFS could not confirm solvability on a small board');
      if (optimal.length > def.maxMoves) throw new Error(`optimal ${optimal.length} exceeds maxMoves ${def.maxMoves}`);
    }

    console.log(`${def.id} ${def.name} (${def.size}×${def.size}, par ${def.parMoves}, ${Math.round(def.timeLimitMs / 1000)}s) OK`);
  } catch (e) {
    errors.push(`${tag}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

if (errors.length > 0) {
  console.error(`\n${errors.length} validation error(s):\n${errors.join('\n')}`);
  process.exit(1);
}
console.log(`\nAll ${raw.length} signal levels validated.`);

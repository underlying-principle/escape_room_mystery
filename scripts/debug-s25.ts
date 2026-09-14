import { createBoard, isSolved, type SignalLevelDef } from '../src/engine/signalEngine';

function mirror5(word: string): string[] {
  return [...word, ...[...word].reverse().slice(1)];
}

const grid = [
  ...'RADAR',
  ...'ADARS',
  'G1', 'G2', 'G3', 'G4', 'G5',
  ...'QWERT',
  ...'ZXCVB',
].map((v) => v.toUpperCase());
console.log('len', grid.length);
console.log('row0 =', grid.slice(0, 5).join(','));
console.log('row2 =', grid.slice(10, 15).join(','));
console.log('row4 =', grid.slice(20, 25).join(','));

const def: SignalLevelDef = {
  id: 'S28',
  chapter: 3,
  index: 28,
  name: 'x',
  subtitle: 'x',
  size: 5,
  solvedValues: grid.slice(0, 25),
  lockedCells: [],
  wildcardCells: [],
  targets: [
    { kind: 'line', orientation: 'row', index: 0, values: [...mirror5('RADAR').slice(0, 5)] },
    { kind: 'line', orientation: 'col', index: 0, values: ['R', 'S', 'O', 'F', 'A'] },
  ],
  maxMoves: 30,
  parMoves: 20,
  timeLimitMs: 180_000,
  starMoves: { three: 20, two: 30 },
  difficulty: 'medium',
  background: 'mirror-08',
};

console.log('solved =', isSolved(createBoard(def), def));

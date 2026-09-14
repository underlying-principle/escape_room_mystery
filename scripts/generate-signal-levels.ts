/**
 * THE SIGNAL — level content generator (60 levels / 6 chapters).
 *
 * Every level is generated FROM a known solved state, scrambled with legal
 * adjacent swaps (so a solution always exists), and validated before being
 * written to src/data/signalLevels.json. It also emits LEVEL_CONTENT_AUDIT.md.
 *
 * Run: npx tsx scripts/generate-signal-levels.ts
 */
import fs from 'node:fs';
import {
  applyMoves,
  createBoard,
  estimateTimeLimit,
  hashSeed,
  isSolved,
  mulberry32,
  scrambleFromSolved,
  solveBFS,
  swapCells,
  type SignalLevelDef,
  type SignalTarget,
} from '../src/engine/signalEngine';

interface LevelSpec {
  name: string;
  subtitle: string;
  size: number;
  difficulty: SignalLevelDef['difficulty'];
  background: string;
  build: () => {
    solvedValues: string[];
    lockedCells: number[];
    wildcardCells: number[];
    targets: SignalTarget[];
    wanderers?: SignalLevelDef['wanderers'];
  };
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const DECOY_LETTERS = 'bdghjklmpqvwxz'.split('');

function rngFor(id: string) {
  return mulberry32(hashSeed(`signal-${id}`));
}

function pick(rng: () => number, arr: string[]): string {
  return arr[Math.floor(rng() * arr.length)];
}

function placeRow(values: string[], size: number, row: number, startCol = 0): { cells: number[]; values: string[] } {
  const cells = values.map((_, i) => row * size + startCol + i);
  return { cells, values };
}

function placeCol(values: string[], size: number, col: number, startRow = 0): { cells: number[]; values: string[] } {
  const cells = values.map((_, i) => (startRow + i) * size + col);
  return { cells, values };
}

/** Snake path through the whole grid — classic sequence course. */
function snakePath(size: number): number[] {
  const path: number[] = [];
  for (let r = 0; r < size; r++) {
    for (let i = 0; i < size; i++) {
      path.push(r * size + (r % 2 === 0 ? i : size - 1 - i));
    }
  }
  return path;
}

function fillDecoys(grid: string[], empty: number[], rng: () => number, alphabet: string[]): void {
  for (const cell of empty) grid[cell] = pick(rng, alphabet);
}

function decoyAlphabet(values: string[], size: number): string[] {
  const used = new Set(values);
  const pool = [...DECOY_LETTERS.map((c) => c.toUpperCase())];
  if (size >= 5) pool.push('R', 'N', 'T', 'S', 'L');
  return pool.filter((v) => !used.has(v));
}

const GLYPHS = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'];
const ARROWS = ['↑', '→', '↓', '←'];

function specs(): LevelSpec[] {
  const S: LevelSpec[] = [];
  const add = (
    index: number,
    name: string,
    subtitle: string,
    size: number,
    difficulty: SignalLevelDef['difficulty'],
    background: string,
    build: LevelSpec['build'],
  ) => S.push({ name, subtitle, size, difficulty, background, build });

  // ---------------- CHAPTER 1 — THE SIGNAL (3×3) ----------------
  add(1, 'Signal Cube', 'Swap adjacent tiles until every row spells a target word.', 3, 'very easy', 'signal-01', () => {
    const grid = [...'catdogs un'.replace(' ', '')].map((c) => c);
    return {
      solvedValues: grid,
      lockedCells: [],
      wildcardCells: [],
      targets: [
        { kind: 'line', orientation: 'row', index: 0, values: [...'CAT'] },
        { kind: 'line', orientation: 'row', index: 1, values: [...'DOG'] },
        { kind: 'line', orientation: 'row', index: 2, values: [...'SUN'] },
      ],
    };
  });
  add(2, 'COLD SIGNAL', 'The center node is frozen in place.', 3, 'very easy', 'signal-02', () => {
    const grid = [...'coldarewar'.slice(0, 9)];
    grid[4] = 'L'; // C O L / D A R E / W A R → center anchor L
    // simpler: rows COLD? 3-letter words: rows "COL"? Use COL / ARE / WAR with center locked.
    return {
      solvedValues: ['C', 'O', 'L', 'A', 'R', 'E', 'W', 'A', 'R'],
      lockedCells: [4],
      wildcardCells: [],
      targets: [
        { kind: 'line', orientation: 'row', index: 0, values: [...'COL'] },
        { kind: 'line', orientation: 'row', index: 2, values: [...'WAR'] },
      ],
    };
  });
  add(3, 'RESTLESS SIGNAL', 'One node is sealed. One letter never rests.', 3, 'medium', 'signal-03', () => {
    const grid = [...'gemurnoak'];
    return {
      solvedValues: grid,
      lockedCells: [0],
      wildcardCells: [],
      targets: [
        { kind: 'line', orientation: 'row', index: 0, values: [...'GEM'] },
        { kind: 'line', orientation: 'row', index: 1, values: [...'URN'] },
        { kind: 'line', orientation: 'row', index: 2, values: [...'OAK'] },
      ],
      wanderers: [{ letter: 'E', intervalMs: 5000 }],
    };
  });
  add(4, 'TWIN DRIFT', 'Two restless letters. Settle a word to pin one.', 3, 'medium', 'signal-04', () => {
    const grid = [...'skyiceark'];
    return {
      solvedValues: grid,
      lockedCells: [8],
      wildcardCells: [],
      targets: [
        { kind: 'line', orientation: 'row', index: 0, values: [...'SKY'] },
        { kind: 'line', orientation: 'row', index: 1, values: [...'ICE'] },
        { kind: 'line', orientation: 'row', index: 2, values: [...'ARK'] },
      ],
      wanderers: [
        { letter: 'Y', intervalMs: 5000 },
        { letter: 'C', intervalMs: 5000 },
      ],
    };
  });
  add(5, 'LOCKS ADRIFT', 'Two seals hold. Two letters never rest.', 3, 'hard', 'signal-05', () => {
    const grid = [...'vanjigowe'];
    return {
      solvedValues: grid,
      lockedCells: [2, 6],
      wildcardCells: [],
      targets: [
        { kind: 'line', orientation: 'row', index: 0, values: [...'VAN'] },
        { kind: 'line', orientation: 'row', index: 1, values: [...'JIG'] },
        { kind: 'line', orientation: 'row', index: 2, values: [...'OWE'] },
      ],
      wanderers: [
        { letter: 'A', intervalMs: 5000 },
        { letter: 'W', intervalMs: 5000 },
      ],
    };
  });
  add(6, 'DECODE', 'A numeric transmission. Reassemble it.', 3, 'easy', 'signal-06', () => {
    const grid = [...'204'.concat('8gx'), ...[]];
    return {
      solvedValues: ['2', '0', '4', '8', 'G', '1', 'X', '9', 'K'],
      lockedCells: [],
      wildcardCells: [],
      targets: [{ kind: 'line', orientation: 'row', index: 0, values: [...'204'] }],
    };
  });
  add(7, 'THE ARROW', 'Route the beam. Form the path.', 3, 'easy', 'signal-07', () => {
    const grid = ['↑', '→', '↓', '←', 'G', '1', '→', '↑', '←'];
    return {
      solvedValues: grid,
      lockedCells: [],
      wildcardCells: [],
      targets: [
        { kind: 'sequence', cells: [0, 1, 2], values: ['↑', '→', '↓'] },
      ],
    };
  });
  add(8, 'BROKEN WORD', 'A decoy hides in the noise.', 3, 'easy', 'signal-08', () => {
    const grid = ['S', 'T', 'A', 'R', 'S', 'U', 'N', 'K', 'W'];
    return {
      solvedValues: grid,
      lockedCells: [],
      wildcardCells: [],
      targets: [{ kind: 'line', orientation: 'row', index: 0, values: [...'STA'] }],
    };
  });
  add(9, 'ECHO', 'Tune the primary. Then its echo.', 3, 'easy', 'signal-09', () => {
    const grid = [...'zipfunlog'];
    return {
      solvedValues: grid,
      lockedCells: [],
      wildcardCells: [],
      targets: [
        { kind: 'line', orientation: 'row', index: 0, values: [...'ZIP'] },
        { kind: 'line', orientation: 'row', index: 1, values: [...'FUN'] },
      ],
    };
  });
  add(10, 'THE FIRST GATE', 'Letters, numbers, signs. The gate opens.', 3, 'easy', 'signal-10', () => {
    const grid = ['7', 'A', 'C', 'T', '3', '↑', 'I', 'V', 'Y'];
    return {
      solvedValues: grid,
      lockedCells: [],
      wildcardCells: [],
      targets: [
        { kind: 'line', orientation: 'row', index: 0, values: ['7', 'A', 'C'] },
        { kind: 'sequence', cells: [3, 4, 5], values: ['T', '3', '↑'] },
        { kind: 'line', orientation: 'row', index: 2, values: [...'IVY'] },
      ],
    };
  });

  // ---------------- CHAPTER 2 — THE VAULT (4×4) ----------------
  const vaultWord = (word: string, other: string, row: number) => (grid: string[]) => {
    [...word].forEach((c, i) => (grid[row * 4 + i] = c));
    [...other].forEach((c, i) => grid.push(c));
    return grid;
  };
  add(11, 'Vault Entry', 'The vault remembers every pattern.', 4, 'easy', 'vault-01', () => {
    const grid = [...'codegateironwind'];
    return {
      solvedValues: grid,
      lockedCells: [],
      wildcardCells: [],
      targets: [
        { kind: 'line', orientation: 'row', index: 0, values: [...'CODE'] },
        { kind: 'line', orientation: 'row', index: 1, values: [...'GATE'] },
      ],
    };
  });
  add(12, 'Four Corners', 'The corners hold the seal.', 4, 'easy', 'vault-02', () => {
    const grid = [...'gat ecod ir nw in d'.replace(/ /g, '')].slice(0, 16);
    while (grid.length < 16) grid.push('K');
    const cells = [0, 3, 12, 15];
    const values = ['G', 'E', 'W', 'D'];
    cells.forEach((c, i) => (grid[c] = values[i]));
    return {
      solvedValues: grid,
      lockedCells: [],
      wildcardCells: [],
      targets: [{ kind: 'pattern', cells, values }],
    };
  });
  add(13, 'Locked Archive', 'Two seals never move.', 4, 'medium', 'vault-03', () => {
    const grid = [...'lockarchtombwind'];
    return {
      solvedValues: grid,
      lockedCells: [0, 1],
      wildcardCells: [],
      targets: [
        { kind: 'line', orientation: 'row', index: 0, values: [...'LOCK'] },
        { kind: 'line', orientation: 'row', index: 2, values: [...'TOMB'] },
      ],
    };
  });
  add(14, 'Code 4821', 'The vault speaks in numbers.', 4, 'medium', 'vault-04', () => {
    const grid = [...'4821ab cd9k7z2q'.replace(/ /g, '')].slice(0, 16);
    while (grid.length < 16) grid.push('Z');
    return {
      solvedValues: grid.slice(0, 16),
      lockedCells: [],
      wildcardCells: [],
      targets: [{ kind: 'line', orientation: 'row', index: 0, values: [...'4821'] }],
    };
  });
  add(15, 'Broken Key', 'One blank key fits every lock.', 4, 'medium', 'vault-05', () => {
    const grid = [...'P?THIRONWINDSTARMOON'.slice(0, 16)];
    return {
      solvedValues: grid,
      lockedCells: [],
      wildcardCells: [1],
      targets: [{ kind: 'line', orientation: 'row', index: 0, values: [...'PATH'] }],
    };
  });
  add(16, 'Mirror Code', 'What the vault stores, it mirrors.', 4, 'medium', 'vault-06', () => {
    const grid = [...'noonracewindkeep'].slice(0, 16);
    return {
      solvedValues: grid,
      lockedCells: [],
      wildcardCells: [],
      targets: [
        { kind: 'line', orientation: 'row', index: 0, values: [...'NOON'] },
        { kind: 'line', orientation: 'row', index: 1, values: [...'RACE'] },
      ],
    };
  });
  add(17, 'Vault Mark', 'An older alphabet guards this door.', 4, 'medium', 'vault-07', () => {
    const grid = ['G1', 'G2', 'G3', 'G4', 'K', 'A', 'W', 'D', 'G5', 'G6', 'G7', 'G8', 'R', 'N', 'T', 'S'];
    return {
      solvedValues: grid,
      lockedCells: [],
      wildcardCells: [],
      targets: [
        { kind: 'line', orientation: 'row', index: 0, values: ['G1', 'G2', 'G3', 'G4'] },
        { kind: 'line', orientation: 'row', index: 2, values: ['G5', 'G6', 'G7', 'G8'] },
      ],
    };
  });
  add(18, 'Double Lock', 'Two sequences. One keyway.', 4, 'medium', 'vault-08', () => {
    const grid = [...'WIGANDTERUNEMLPS'];
    return {
      solvedValues: grid,
      lockedCells: [],
      wildcardCells: [],
      targets: [
        { kind: 'sequence', cells: [0, 1, 4, 5], values: ['W', 'I', 'N', 'D'] },
        { kind: 'sequence', cells: [8, 9, 10, 11], values: ['R', 'U', 'N', 'E'] },
      ],
    };
  });
  add(19, 'Archive Memory', 'An old pattern returns, rearranged.', 4, 'medium', 'vault-09', () => {
    const grid = [...'starmoongatewind'];
    return {
      solvedValues: grid,
      lockedCells: [],
      wildcardCells: [],
      targets: [
        { kind: 'line', orientation: 'row', index: 0, values: [...'STAR'] },
        { kind: 'line', orientation: 'row', index: 1, values: [...'MOON'] },
      ],
    };
  });
  add(20, 'Vault Door', 'The final seal of the archive.', 4, 'medium', 'vault-10', () => {
    const grid = ['1', '5', '9', '2', 'S', 'E', 'A', 'L', 'G9', 'G10', 'G11', 'G12', 'W', 'I', 'N', 'D'];
    return {
      solvedValues: grid,
      lockedCells: [],
      wildcardCells: [],
      targets: [
        { kind: 'line', orientation: 'row', index: 0, values: [...'1592'] },
        { kind: 'line', orientation: 'row', index: 1, values: [...'SEAL'] },
        { kind: 'line', orientation: 'row', index: 2, values: ['G9', 'G10', 'G11', 'G12'] },
      ],
    };
  });

  // ---------------- CHAPTER 3 — THE MIRROR (5×5) ----------------
  const mirror5 = (word: string): string[] => [...word, ...[...word].reverse().slice(1)];
  add(21, 'Reflection', 'Every signal casts a mirror.', 5, 'medium', 'mirror-01', () => {
    const grid = [...mirror5('LIGHT'), ...'stone'.split(''), ...'ocean'.split(''), ...'abcde'.split(''), ...'fghij'.split('')];
    return {
      solvedValues: grid.slice(0, 25),
      lockedCells: [],
      wildcardCells: [],
      targets: [{ kind: 'line', orientation: 'row', index: 0, values: [...mirror5('LIGHT').slice(0, 5)] }],
    };
  });
  add(22, 'Reverse', 'Read it backwards to pass.', 5, 'medium', 'mirror-02', () => {
    const grid = [...'stone'.split(''), ...[...'STONE'].reverse(), ...'ocean'.split(''), ...'abcde'.split(''), ...'fghij'.split('')];
    return {
      solvedValues: grid.slice(0, 25),
      lockedCells: [],
      wildcardCells: [],
      targets: [
        { kind: 'line', orientation: 'row', index: 0, values: [...'STONE'] },
        { kind: 'sequence', cells: [5, 6, 7, 8, 9], values: [...'ENOTS'] },
      ],
    };
  });
  add(23, 'Mirror Word', 'The word is its own reflection.', 5, 'medium', 'mirror-03', () => {
    const grid = [...mirror5('LEVEL'), ...'stone'.split(''), ...'ocean'.split(''), ...'abcde'.split(''), ...'fghij'.split('')];
    return {
      solvedValues: grid.slice(0, 25),
      lockedCells: [],
      wildcardCells: [],
      targets: [{ kind: 'line', orientation: 'row', index: 0, values: [...mirror5('LEVEL').slice(0, 5)] }],
    };
  });
  add(24, 'Twin Paths', 'Two routes through the mirror.', 5, 'medium', 'mirror-04', () => {
    // snakePath row 1 runs right-to-left, so EARTH is laid down reversed.
    const grid = [...'prismhtraecloudabcdefghij'.split('')].slice(0, 25);
    const path = snakePath(5);
    return {
      solvedValues: grid,
      lockedCells: [],
      wildcardCells: [],
      targets: [
        { kind: 'sequence', cells: path.slice(0, 5), values: [...'PRISM'] },
        { kind: 'sequence', cells: path.slice(5, 10), values: [...'EARTH'] },
      ],
    };
  });
  add(25, 'False Reflection', 'One of these reflections lies.', 5, 'medium', 'mirror-05', () => {
    // Row 1 continues the mirror but is NOT a target — that is the false
    // reflection the player must ignore.
    const grid = [...mirror5('GHOST'), ...'ocean'.split(''), ...'flame'.split(''), ...'abcde'.split(''), ...'fghij'.split('')];
    return {
      solvedValues: grid.slice(0, 25),
      lockedCells: [],
      wildcardCells: [],
      targets: [{ kind: 'line', orientation: 'row', index: 0, values: [...mirror5('GHOST').slice(0, 5)] }],
    };
  });
  add(26, 'Broken Symmetry', 'Restore balance across the axis.', 5, 'medium', 'mirror-06', () => {
    const grid = [...'stone'.split(''), ...'ocean'.split(''), ...'flame'.split(''), ...'abcde'.split(''), ...'fghij'.split('')];
    const cells = [10, 11, 12, 13, 14];
    const values = [...'FLAME'];
    return {
      solvedValues: grid,
      lockedCells: [],
      wildcardCells: [],
      targets: [{ kind: 'pattern', cells, values }],
    };
  });
  add(27, 'Diagonal Signal', 'Not every signal travels straight.', 5, 'medium', 'mirror-07', () => {
    const grid = [...'orbitstonecloudfghijabcde'];
    const diag = [0, 6, 12, 18, 24];
    diag.forEach((c, i) => (grid[c] = [...'ORBIT'][i]));
    return {
      solvedValues: grid,
      lockedCells: [],
      wildcardCells: [],
      targets: [{ kind: 'sequence', cells: diag, values: [...'ORBIT'] }],
    };
  });
  add(28, 'Double Mirror', 'Two axes. One truth.', 5, 'medium', 'mirror-08', () => {
    // Row 0 mirrors RADAR; column 0 relays a second R-word through the shared
    // corner (the grid is built explicitly so every row stays 5 cells).
    const grid = [
      ...'RADAR',
      ...'EQWER',
      ...'LZXCV',
      ...'ABNMK',
      ...'YPOIU',
    ];
    return {
      solvedValues: grid,
      lockedCells: [],
      wildcardCells: [],
      targets: [
        { kind: 'line', orientation: 'row', index: 0, values: [...'RADAR'] },
        { kind: 'line', orientation: 'col', index: 0, values: [...'RELAY'] },
      ],
    };
  });
  add(29, 'Infinite Echo', 'The reflection echoes back twice.', 5, 'medium', 'mirror-09', () => {
    const grid = [...'ocean'.split(''), ...'tides'.split(''), ...'stone'.split(''), ...'abcde'.split(''), ...'fghij'.split('')];
    return {
      solvedValues: grid.slice(0, 25),
      lockedCells: [],
      wildcardCells: [],
      targets: [
        { kind: 'line', orientation: 'row', index: 0, values: [...'OCEAN'] },
        { kind: 'line', orientation: 'row', index: 1, values: [...'TIDES'] },
      ],
    };
  });
  add(30, 'The Mirror Gate', 'Word, symbol and symmetry in one.', 5, 'medium', 'mirror-10', () => {
    // Built row-by-row: a palindromic mirror row, filler, a glyph band, then a
    // bottom sequence. Every row is exactly 5 cells.
    const grid = [
      ...'KAYAK',
      ...'WQRTY',
      'G1', 'G2', 'G3', 'G4', 'G5',
      ...'ZXCVB',
      ...'QWERT',
    ];
    return {
      solvedValues: grid,
      lockedCells: [],
      wildcardCells: [],
      targets: [
        { kind: 'line', orientation: 'row', index: 0, values: [...'KAYAK'] },
        { kind: 'line', orientation: 'row', index: 2, values: ['G1', 'G2', 'G3', 'G4', 'G5'] },
        { kind: 'sequence', cells: [20, 21, 22, 23, 24], values: [...'QWERT'] },
      ],
    };
  });

  // ---------------- CHAPTER 4 — THE DEPTHS (6×6) ----------------
  const depths = [
    { i: 31, n: 'Dive', s: 'Descend until the signal disappears.', rows: ['SIGNAL', 'MARKER'] },
    { i: 32, n: 'Current', s: 'The trench pulls everything sideways.', rows: ['SHADOW', 'VORTEX'] },
    { i: 33, n: 'Pressure', s: 'It builds the deeper you rearrange.', rows: ['ANCHOR', 'BEACON'] },
    { i: 34, n: 'Abyss Code', s: 'Numbers scrawled in the deep.', rows: ['314159', '906420'] },
    { i: 35, n: 'Deep Marker', s: 'Someone marked the path down here.', rows: ['CIPHER', 'FATHOM'] },
    { i: 36, n: 'Sunken Pattern', s: 'A pattern sunk with its ship.', rows: ['NEBULA', 'KRAKEN'] },
    { i: 37, n: 'Pressure Lock', s: 'Two seals. No way around them.', rows: ['SUNKEN', 'GRAVEL'], locked: 2 },
    { i: 38, n: 'Black Signal', s: 'A transmission with no source.', rows: ['SHROUD', 'WRAITH'] },
    { i: 39, n: 'The Trench', s: 'Follow the trench to its end.', rows: ['TRENCH', 'DEPTHS'] },
    { i: 40, n: 'Depth Gate', s: 'The gate to the storm zone.', rows: ['GROTTO', 'LAGOON'] },
  ];
  depths.forEach((d, k) => {
    add(d.i, d.n.toUpperCase(), d.s, 6, k < 4 ? 'medium' : 'hard', `depths-${String(k + 1).padStart(2, '0')}`, () => {
      const size = 6;
      const grid: string[] = Array.from({ length: size * size }, () => '');
      const alphabet = decoyAlphabet([...d.rows[0], ...d.rows[1]], size);
      const rng = rngFor(`depths-${d.i}`);
      const empty: number[] = [];
      d.rows.forEach((word, r) => {
        [...word].forEach((c, i) => (grid[r * size + i] = c));
      });
      const targets: SignalTarget[] = d.rows.map((word, r) => ({
        kind: 'line',
        orientation: 'row',
        index: r,
        values: [...word],
      }));
      // Every third level also carries a glyph chain on reserved cells; the
      // chain set rotates so no glyph sequence repeats across the campaign.
      if (k % 3 === 2) {
        const glyphCells = [size * 3, size * 3 + 1, size * 3 + 2, size * 3 + 3];
        const chain = k === 2 ? ['G2', 'G5', 'G8', 'G11'] : k === 5 ? ['G3', 'G6', 'G9', 'G12'] : ['G1', 'G4', 'G7', 'G10'];
        glyphCells.forEach((c, i) => (grid[c] = chain[i]));
        targets.push({ kind: 'sequence', cells: glyphCells, values: chain });
      }
      for (let c = 0; c < size * size; c++) if (!grid[c]) empty.push(c);
      fillDecoys(grid, empty, rng, alphabet);
      const lockedCells: number[] = [];
      if (d.locked) lockedCells.push(8, 9);
      return { solvedValues: grid, lockedCells, wildcardCells: [], targets };
    });
  });

  // ---------------- CHAPTER 5 — THE STORM (7×7 / 8×8) ----------------
  const storm = [
    { i: 41, n: 'Static', size: 7, rows: ['CURRENT', 'ECLIPSE'] },
    { i: 42, n: 'Crosscurrent', size: 7, rows: ['PHANTOM', 'VOLTAGE'] },
    { i: 43, n: 'Lightning', size: 7, rows: ['TEMPEST', 'VERTIGO'] },
    { i: 44, n: 'Moving Signal', size: 7, rows: ['CASCADE', 'SPECTER'] },
    { i: 45, n: 'Storm Code', size: 7, rows: ['9064207', 'NEUTRAL'] },
    { i: 46, n: 'Charged', size: 7, rows: ['CYCLONE', 'ARCHONS'] },
    { i: 47, n: 'Blackout', size: 8, rows: ['DISTANCE', 'SUNLIGHT'] },
    { i: 48, n: 'Eye of the Storm', size: 8, rows: ['EQUATION', 'LATITUDE'] },
    { i: 49, n: 'Final Transmission', size: 8, rows: ['SYMMETRY', 'HORIZONS'] },
    { i: 50, n: 'Storm Gate', size: 8, rows: ['PATHWAYS', 'KEYSTONE'] },
  ];
  storm.forEach((d, k) => {
    add(d.i, d.n.toUpperCase(), k < 5 ? 'Ride the storm.' : 'The eye is calm. Everything around it is not.', d.size, 'hard', `storm-${String(k + 1).padStart(2, '0')}`, () => {
      const size = d.size;
      const grid: string[] = Array.from({ length: size * size }, () => '');
      const rng = rngFor(`storm-${d.i}`);
      d.rows.forEach((word, r) => {
        [...word].forEach((c, i) => (grid[r * size + i] = c));
      });
      if (k >= 5) {
        // The bolted corner pair rotates per level so the pattern target and
        // its glyphs are never a repeat of an earlier storm.
        const cornerGlyph = ['G9', 'G10', 'G11', 'G12', 'G8'][k - 5];
        const cornerArrow = ['↑', '→', '↓', '←', '↑'][k - 5];
        grid[size * (size - 1)] = cornerGlyph;
        grid[size * size - 1] = cornerArrow;
      }
      const empty: number[] = [];
      for (let c = 0; c < size * size; c++) if (!grid[c]) empty.push(c);
      const alphabet = [...'BCDFGHJKLMNPQRSTVWXZ'.split(''), ...(k % 2 === 0 ? GLYPHS.slice(0, 6) : ARROWS)];
      fillDecoys(grid, empty, rng, alphabet);
      const targets: SignalTarget[] = d.rows.map((word, r) => ({
        kind: 'line',
        orientation: 'row',
        index: r,
        values: [...word],
      }));
      if (k >= 5) {
        const cornerGlyph = ['G9', 'G10', 'G11', 'G12', 'G8'][k - 5];
        const cornerArrow = ['↑', '→', '↓', '←', '↑'][k - 5];
        targets.push({ kind: 'pattern', cells: [size * (size - 1), size * size - 1], values: [cornerGlyph, cornerArrow] });
      }
      return { solvedValues: grid, lockedCells: [], wildcardCells: [], targets };
    });
  });

  // ---------------- CHAPTER 6 — THE ORIGIN (8×8 → 10×10) ----------------
  const origin = [
    { i: 51, n: 'Ancient Signal', size: 8 },
    { i: 52, n: 'The Map', size: 8 },
    { i: 53, n: 'The Messenger', size: 9 },
    { i: 54, n: 'The Code', size: 9 },
    { i: 55, n: 'The Language', size: 9 },
    { i: 56, n: 'The Machine', size: 10 },
    { i: 57, n: 'The Origin', size: 10 },
    { i: 58, n: 'The Last Cipher', size: 10 },
    { i: 59, n: 'The Final Pattern', size: 10 },
    { i: 60, n: 'THE SIGNAL', size: 10 },
  ];
  origin.forEach((d, k) => {
    add(d.i, d.n.toUpperCase(), k === 9 ? 'The oldest signal is still transmitting.' : 'The origin speaks in a lost alphabet.', d.size, k < 4 ? 'expert' : 'master', `origin-${String(k + 1).padStart(2, '0')}`, () => {
      const size = d.size;
      const grid: string[] = Array.from({ length: size * size }, () => '');
      const rng = rngFor(`origin-${d.i}`);
      const path = snakePath(size);
      const targets: SignalTarget[] = [];

      // Zone 1 — row 0: the transmission word (one distinct word per level).
      const words = ['MERIDIAN', 'CONTOURS', 'LIGHTNING', 'MACHINERY', 'STARLIGHT', 'WAVELENGTH', 'OSCILLATOR', 'AMPLIFIERS', 'SUPERNOVAS', 'RESONATORS'];
      const word = words[k];
      [...word].forEach((c, i) => (grid[i] = c));
      targets.push({ kind: 'line', orientation: 'row', index: 0, values: [...word] });

      // Zone 2 — row 2: the glyph band.
      const glyphBandRow = 2;
      for (let i = 0; i < size; i++) {
        grid[glyphBandRow * size + i] = GLYPHS[(i + k) % GLYPHS.length];
      }
      targets.push({
        kind: 'line',
        orientation: 'row',
        index: glyphBandRow,
        values: Array.from({ length: size }, (_, i) => GLYPHS[(i + k) % GLYPHS.length]),
      });

      // Zone 3 — a number sequence along the snake path inside row 1. Each
      // level reads a different mathematical constant (e, π, φ, √2, √3, …).
      const digits = ['27182818', '31415926', '161803398', '141421356', '173205080', '2302585093', '8539734222', '5772156649', '2236067977', '4669201609'][k].slice(0, size).split('');
      const digitCells = path.slice(size, size + digits.length); // row 1
      digitCells.forEach((c, i) => (grid[c] = digits[i]));
      targets.push({ kind: 'sequence', cells: digitCells, values: digits });

      // Zone 4 — bottom-row corners: a glyph pattern, unique per level.
      const corners = [size * (size - 1), size * (size - 1) + size - 1, size * size - size + (size > 2 ? 1 : 0), size * size - 2];
      const cornerValues = [
        ['G2', 'G6', 'G10', 'G12'],
        ['G3', 'G7', 'G11', 'G1'],
        ['G4', 'G8', 'G12', 'G2'],
        ['G5', 'G9', 'G1', 'G3'],
        ['G6', 'G10', 'G2', 'G4'],
        ['G7', 'G11', 'G1', 'G5'],
        ['G8', 'G12', 'G2', 'G6'],
        ['G9', 'G1', 'G3', 'G7'],
        ['G10', 'G2', 'G4', 'G8'],
        ['G11', 'G3', 'G5', 'G9'],
      ][k];
      corners.forEach((c, i) => (grid[c] = cornerValues[i]));
      targets.push({ kind: 'pattern', cells: corners, values: cornerValues });

      // Fill the rest.
      const empty: number[] = [];
      for (let c = 0; c < size * size; c++) if (!grid[c]) empty.push(c);
      const alphabet = [...'ABCDEFGHKLMNPRSTUVZ'.split(''), ...GLYPHS, ...['2', '4', '7', '9']];
      fillDecoys(grid, empty, rng, alphabet);
      const wildcardCells = k % 3 === 1 ? [Math.floor(size * size / 2)] : [];
      wildcardCells.forEach((c) => (grid[c] = '?'));
      return { solvedValues: grid, lockedCells: [], wildcardCells, targets };
    });
  });

  return S;
}

// ---------------------------------------------------------------------------
// Assembly: from spec → validated SignalLevelDef
// ---------------------------------------------------------------------------

function parFor(size: number, chapter: number, rng: () => number): number {
  const base = Math.round((size - 1) * size * 0.5) + (chapter - 1) * 2;
  return Math.max(4, base + Math.floor(rng() * 4));
}

function assemble(index: number, spec: LevelSpec): SignalLevelDef {
  const id = `S${String(index).padStart(2, '0')}`;
  const chapter = Math.ceil(index / 10) as 1 | 2 | 3 | 4 | 5 | 6;
  const rng = rngFor(id);
  const raw = spec.build();
  // Normalize: every displayed value is uppercase (glyph ids and symbols unaffected).
  const design = { ...raw, solvedValues: raw.solvedValues.map((v) => v.toUpperCase()) };
  const size = spec.size;

  if (design.solvedValues.length !== size * size) {
    throw new Error(`${id}: solved board has ${design.solvedValues.length} cells, expected ${size * size}`);
  }

  const probeDef = emptyDef(id, spec, design, size, chapter);
  const solved = createBoard(probeDef);
  if (!isSolved(solved, probeDef)) {
    throw new Error(`${id}: solved board does not satisfy its own targets`);
  }

  // Scramble until the start is genuinely unsolved (never ship a pre-solved level).
  // Level 1 must be byte-identical to the shipped GitHub version: the original
  // seeded scramble (GON/CTA/SUD at rest), name "Signal Cube", par 8, max 12, 90s.
  if (index === 1) {
    const originalStartCells = ['t05', 't04', 't08', 't00', 't02', 't01', 't06', 't07', 't03'];
    const base: Omit<SignalLevelDef, 'timeLimitMs'> = {
      id,
      chapter,
      index,
      name: 'Signal Cube',
      subtitle: 'Swap adjacent tiles until every row spells a target word.',
      size,
      solvedValues: design.solvedValues,
      startCells: originalStartCells,
      lockedCells: design.lockedCells,
      wildcardCells: design.wildcardCells,
      targets: design.targets,
      maxMoves: 12,
      parMoves: 8,
      starMoves: { three: 8, two: 11 },
      difficulty: spec.difficulty,
      background: spec.background,
      storyBeat: spec.subtitle,
    };
    return { ...base, timeLimitMs: 90_000 };
  }
  let parMoves = parFor(size, chapter, rng);
  let scramble = scrambleFromSolved(probeDef, parMoves, rng);
  let attempts = 0;
  while (isSolved(scramble.state, probeDef) && attempts < 25) {
    attempts++;
    scramble = scrambleFromSolved(probeDef, parMoves, rng);
  }

  // Small boards get an exact optimal via BFS; par becomes the true optimum.
  // A scramble whose optimum is trivially short is replaced by a deeper one
  // (minimum respectable optimum: 4 moves) so timers and stars stay fair.
  if (size <= 3) {
    let depth = parMoves;
    for (let attempt = 0; attempt < 30; attempt++) {
      const path = solveBFS(scramble.state, probeDef);
      if (path && path.length >= 4) {
        parMoves = path.length;
        break;
      }
      depth += 1;
      scramble = scrambleFromSolved(probeDef, depth, rng);
      if (isSolved(scramble.state, probeDef)) scramble = scrambleFromSolved(probeDef, depth + 1, rng);
    }
    const finalPath = solveBFS(scramble.state, probeDef);
    if (finalPath) parMoves = Math.max(4, finalPath.length);
    if (isSolved(scramble.state, probeDef)) throw new Error(`${id}: could not produce a non-solved scramble`);
  }

  // Wandering letters keep breaking rows mid-solve — widen the star windows
  // and the move ceiling so the chase stays fair.
  const starMoves = design.wanderers?.length
    ? { three: parMoves + 4, two: parMoves * 2 + 4 }
    : { three: parMoves, two: Math.ceil(parMoves * 1.5) };
  const maxMoves =
    (index === 1 ? 12 : parMoves + Math.ceil(parMoves * 0.35) + 3) + (design.wanderers?.length ? 6 : 0);

  const base: Omit<SignalLevelDef, 'timeLimitMs'> = {
    id,
    chapter,
    index,
    name: spec.name,
    subtitle: spec.subtitle,
    size,
    solvedValues: design.solvedValues,
    startCells: [...scramble.state.cells],
    lockedCells: design.lockedCells,
    wildcardCells: design.wildcardCells,
    targets: design.targets,
    wanderers: design.wanderers,
    maxMoves,
    parMoves,
    starMoves,
    difficulty: spec.difficulty,
    background: spec.background,
    storyBeat: spec.subtitle,
  };
  const timeLimitMs = index === 1 ? 90_000 : estimateTimeLimit(base);
  return { ...base, timeLimitMs };
}

function emptyDef(
  id: string,
  spec: LevelSpec,
  design: { targets: SignalTarget[]; solvedValues: string[]; lockedCells: number[]; wildcardCells: number[] },
  size: number,
  chapter: 1 | 2 | 3 | 4 | 5 | 6,
): SignalLevelDef {
  return {
    id,
    chapter,
    index: parseInt(id.slice(1), 10),
    name: spec.name,
    subtitle: spec.subtitle,
    size,
    solvedValues: design.solvedValues,
    lockedCells: design.lockedCells ?? [],
    wildcardCells: design.wildcardCells ?? [],
    targets: design.targets,
    maxMoves: 99,
    parMoves: 8,
    timeLimitMs: 90_000,
    starMoves: { three: 8, two: 12 },
    difficulty: spec.difficulty,
    background: spec.background,
  };
}

// ---------------------------------------------------------------------------
// Run generation + embedded validation
// ---------------------------------------------------------------------------

const levels: SignalLevelDef[] = specs().map((spec, i) => assemble(i + 1, spec));

// Validation pass (fail loudly — never ship an invalid level).
const errors: string[] = [];
const seenWords = new Map<string, string>(); // target word -> owning level id
for (let i = 0; i < levels.length; i++) {
  const def = levels[i];
  const tag = def.id;
  try {
    if (def.solvedValues.length !== def.size * def.size) throw new Error('board size mismatch');
    if (def.solvedValues.some((v) => typeof v !== 'string' || v.length === 0)) throw new Error('empty tile value');
    if (def.targets.length === 0) throw new Error('no targets');
    // Every target word must be unique across the whole campaign and within
    // its own level — a word the player already solved must never be asked
    // for again.
    for (const t of def.targets) {
      const word = t.values.join('');
      const owner = seenWords.get(word);
      if (owner === def.id) throw new Error(`target word '${word}' appears twice inside ${def.id}`);
      if (owner !== undefined) throw new Error(`duplicate target word '${word}' (first in ${owner})`);
      seenWords.set(word, def.id);
    }
    if (def.wanderers?.length) {
      const letters = new Set<string>();
      for (const w of def.wanderers) {
        if (letters.has(w.letter)) throw new Error(`wander letter '${w.letter}' declared twice`);
        letters.add(w.letter);
        const occurrences = def.solvedValues.filter((v) => v === w.letter).length;
        if (occurrences !== 1) throw new Error(`wander letter '${w.letter}' occurs ${occurrences} times, expected exactly 1`);
        const wanderCell = def.solvedValues.indexOf(w.letter);
        if (def.lockedCells.includes(wanderCell)) throw new Error(`wander letter '${w.letter}' sits on a locked cell`);
      }
    }
    const solved = createBoard({ ...def, startCells: undefined });
    if (!isSolved(solved, def)) throw new Error('solved board fails its targets');
    const shippedStart = createBoard(def);
    if (isSolved(shippedStart, def)) throw new Error('shipped start already solved');
    if (def.startCells && [...def.startCells].sort().join() !== Object.keys(solved.tiles).sort().join()) {
      throw new Error('startCells is not a permutation of the tile ids');
    }
    const rng = mulberry32(hashSeed(`validate-${tag}`));
    const { state, path } = scrambleFromSolved(def, def.parMoves, rng);
    if (isSolved(state, def)) throw new Error('scrambled start already solved');
    // solution path: inverse of the scramble is legal and reaches solved
    let cur = state;
    for (let m = path.length - 1; m >= 0; m--) {
      cur = swapCells(cur, path[m].a, path[m].b);
    }
    if (!isSolved(cur, def)) throw new Error('inverse scramble does not solve');
    if (def.maxMoves < def.parMoves) throw new Error('maxMoves below par');
    if (def.timeLimitMs < 30_000) throw new Error('timer below floor');
    if (def.starMoves.three < def.parMoves) throw new Error('3-star below par');
    if (def.size >= 2 && def.size <= 3) {
      const optimal = solveBFS(state, def);
      if (optimal === null) throw new Error('BFS could not confirm solvability on a small board');
      if (optimal.length > def.maxMoves) throw new Error(`optimal ${optimal.length} exceeds maxMoves ${def.maxMoves}`);
    }
  } catch (e) {
    errors.push(`${tag}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

if (levels.length !== 60) errors.push(`expected 60 levels, generated ${levels.length}`);
if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync('src/data/signalLevels.json', `${JSON.stringify(levels, null, 1)}\n`);

// LEVEL_CONTENT_AUDIT.md
const rows = levels.map((l) =>
  [
    l.id,
    l.name,
    `CH${l.chapter}`,
    `${l.size}×${l.size}`,
    l.targets.map((t) => t.kind).join('+'),
    l.parMoves,
    l.maxMoves,
    `${Math.round(l.timeLimitMs / 1000)}s`,
    l.difficulty,
    l.background,
    'solution-validated',
    `3★ ≤ ${l.starMoves.three} moves`,
  ].join(' | '),
);
const audit = [
  '| ID | Name | Ch | Grid | Target types | Par | Max moves | Timer | Difficulty | Background | Solution | 3-star |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows,
].join('\n');
fs.writeFileSync('LEVEL_CONTENT_AUDIT.md', `# LEVEL_CONTENT_AUDIT\n\nGenerated from src/data/signalLevels.json. Every level is scrambled-from-solved and solution-validated.\n\n${audit}\n`);

console.log(`Generated ${levels.length} levels → src/data/signalLevels.json`);
console.log(levels.map((l) => `${l.id} ${l.name} (${l.size}×${l.size}, par ${l.parMoves}, ${Math.round(l.timeLimitMs / 1000)}s)`).join('\n'));

/**
 * One-shot authoring pass for the 22-level campaign:
 *  - assigns a themed backdrop to every level,
 *  - appends levels 13-22 (worlds 4-6) with the solver-verified configs.
 * Optimal paths/counts are baked afterwards by `npm run validate`.
 */
import fs from 'node:fs';

const LEVELS_PATH = 'src/data/levels.json';
const levels = JSON.parse(fs.readFileSync(LEVELS_PATH, 'utf8')) as Array<Record<string, unknown>>;

const BACKDROPS: Record<string, string> = {
  'w1-l1': 'temple',
  'w1-l2': 'arctic',
  'w1-l3': 'glacier',
  'w1-l4': 'library',
  'w2-l5': 'icecave',
  'w2-l6': 'archive',
  'w2-l7': 'citynight',
  'w2-l8': 'volcano',
  'w3-l9': 'coast',
  'w3-l10': 'aurora',
  'w3-l11': 'lighthouse',
  'w3-l12': 'study',
  'w4-l13': 'summit',
  'w4-l14': 'storm',
  'w4-l15': 'jungle',
  'w4-l16': 'shipwreck',
  'w5-l17': 'mine',
  'w5-l18': 'orbit',
  'w5-l19': 'manor',
  'w5-l20': 'observatory',
  'w6-l21': 'reactor',
  'w6-l22': 'singularity',
};

const link = (tp: number, tl: string, rp: number, rl: string) => ({
  triggerSlot: 0,
  triggerPosition: tp,
  triggerLetter: tl,
  resultSlot: 1,
  resultPosition: rp,
  resultLetter: rl,
});
const slot = (startWord: string, targetWord: string, lockedPositions: number[] = []) => ({
  startWord,
  targetWord,
  lockedPositions,
});

const NEW_LEVELS: Array<Record<string, unknown>> = [
  {
    id: 'w4-l13', world: 4, name: 'Base Camp', backdrop: 'summit',
    blurb: 'The component gets deep. Nine shifts from stone to a running start.',
    slots: [slot('stone', 'start')], wildcardCount: 0, intendedMoveCount: 9, optimalMoveCount: 0,
  },
  {
    id: 'w4-l14', world: 4, name: 'Fault Line', backdrop: 'storm',
    blurb: 'A locked fault blocks the middle. The wildcard must break it exactly once.',
    slots: [slot('stone', 'smart', [2])], wildcardCount: 1, intendedMoveCount: 10, optimalMoveCount: 0,
  },
  {
    id: 'w4-l15', world: 4, name: 'Old Growth', backdrop: 'jungle',
    blurb: 'Eleven shifts through the canopy. The last tile is sealed — spend the wildcard well.',
    slots: [slot('stone', 'years', [4])], wildcardCount: 1, intendedMoveCount: 11, optimalMoveCount: 0,
  },
  {
    id: 'w4-l16', world: 4, name: 'Off the Shelf', backdrop: 'shipwreck',
    blurb: 'Twelve shifts across the sunken library. No locks. No excuses.',
    slots: [slot('stone', 'books')], wildcardCount: 0, intendedMoveCount: 12, optimalMoveCount: 0,
  },
  {
    id: 'w5-l17', world: 5, name: 'Black Seams', backdrop: 'mine',
    blurb: 'Two shafts, one trigger: turning the top word to C slams the bottom word to C too.',
    slots: [slot('fire', 'book'), slot('black', 'crack')],
    wildcardCount: 0, reactionRules: [link(0, 'c', 0, 'c')], intendedMoveCount: 13, optimalMoveCount: 0,
  },
  {
    id: 'w5-l18', world: 5, name: 'Cold Orbit', backdrop: 'orbit',
    blurb: 'Both words travel the same early road. Time the shared K-shift to save a move.',
    slots: [slot('stone', 'stats'), slot('share', 'years')],
    wildcardCount: 0, reactionRules: [link(3, 'k', 3, 'k')], intendedMoveCount: 14, optimalMoveCount: 0,
  },
  {
    id: 'w5-l19', world: 5, name: 'Echo Manor', backdrop: 'manor',
    blurb: 'The manor repeats you. Sync the K-shift, then split for the finale.',
    slots: [slot('stone', 'stars'), slot('share', 'reads')],
    wildcardCount: 0, reactionRules: [link(3, 'k', 3, 'k')], intendedMoveCount: 15, optimalMoveCount: 0,
  },
  {
    id: 'w5-l20', world: 5, name: 'Night Watch', backdrop: 'observatory',
    blurb: 'Sixteen shifts to first light. The trigger only helps if the bottom word is still home.',
    slots: [slot('stone', 'stars'), slot('share', 'ready')],
    wildcardCount: 0, reactionRules: [link(3, 'k', 3, 'k')], intendedMoveCount: 16, optimalMoveCount: 0,
  },
  {
    id: 'w6-l21', world: 6, name: 'Meltdown', backdrop: 'reactor',
    blurb: 'A sealed core tile, one wildcard, and a linked reaction. Seventeen shifts to shutdown.',
    slots: [slot('stone', 'beats', [2]), slot('share', 'meant')],
    wildcardCount: 1, reactionRules: [link(3, 'k', 3, 'k')], intendedMoveCount: 17, optimalMoveCount: 0,
  },
  {
    id: 'w6-l22', world: 6, name: 'Event Horizon', backdrop: 'singularity',
    blurb: 'The final collapse: eighteen shifts, two sealed tiles, one wildcard, one reaction.',
    slots: [slot('stone', 'smart', [2]), slot('share', 'roads')],
    wildcardCount: 1, reactionRules: [link(3, 'k', 3, 'k')], intendedMoveCount: 18, optimalMoveCount: 0,
  },
];

for (const level of levels) {
  const id = level.id as string;
  level.backdrop = BACKDROPS[id] ?? level.backdrop ?? 'arctic';
}

const existing = new Set(levels.map((l) => l.id as string));
for (const level of NEW_LEVELS) {
  if (!existing.has(level.id as string)) levels.push(level);
}

fs.writeFileSync(LEVELS_PATH, `${JSON.stringify(levels, null, 2)}\n`);
console.log(`levels.json now holds ${levels.length} levels.`);

/**
 * Core data shapes shared by the engine, build scripts and UI.
 */

/**
 * A scripted Word Reaction: when the player edits `triggerSlot`'s letter at
 * `triggerPosition` to `triggerLetter`, the engine forces `resultSlot`'s
 * letter at `resultPosition` to become `resultLetter` in the same move.
 * The forced result must be a valid dictionary word for the move to be legal.
 *
 * Reactions are authored per level (never derived at runtime) and are allowed
 * to override locked positions — they are world physics, not player edits.
 * Designed levels should not rely on that override; the validator warns if
 * they might.
 */
export interface ReactionRule {
  triggerSlot: number;
  triggerPosition: number;
  triggerLetter: string;
  resultSlot: number;
  resultPosition: number;
  resultLetter: string;
}

export interface SlotData {
  startWord: string;
  targetWord: string;
  /** Positions that cannot be changed by the player. */
  lockedPositions: number[];
}

/**
 * One level. Worlds 1-2 have exactly one slot; World 3+ ("The Mirror" lineage)
 * has two slots plus reaction rules. `backdrop` names the themed real-place
 * scene rendered behind the board (see src/three/backdrop.ts).
 *
 * `optimalMoveCount` and `optimalPath` are filled in by scripts/validate-levels.ts
 * (the validator), never hand-guessed.
 */
export interface LevelData {
  id: string;
  world: 1 | 2 | 3 | 4 | 5 | 6;
  name: string;
  /** One-line flavor/mechanic text shown in the level intro. */
  blurb?: string;
  backdrop?: string;
  slots: SlotData[];
  /** Number of one-time lock-breaking wildcard uses allowed. World 2+. */
  wildcardCount: number;
  reactionRules?: ReactionRule[];
  /** Designer's intended solution length; validator rejects shorter optima. */
  intendedMoveCount?: number;
  optimalMoveCount: number;
  optimalPath?: PlayerMove[];
  /** Computed by the validator: is the wildcard mandatory for any solution? */
  wildcardRequired?: boolean;
}

/** Full puzzle state: one word per slot + wildcard budget consumed. */
export interface GameState {
  words: string[];
  wildUsed: number;
}

/** Side effect applied by a reaction rule. */
export interface ReactionEffect {
  slot: number;
  position: number;
  fromLetter: string;
  toLetter: string;
}

/** One player action: change one letter in one slot. */
export interface PlayerMove {
  slot: number;
  position: number;
  fromLetter: string;
  toLetter: string;
  usedWildcard: boolean;
  reactions?: ReactionEffect[];
}

export type MoveErrorReason =
  | 'out-of-range'
  | 'not-a-change'
  | 'locked-position'
  | 'no-wildcard-left'
  | 'invalid-word'
  | 'reaction-invalid-word';

export type MoveResult =
  | { ok: true; nextState: GameState; move: PlayerMove }
  | { ok: false; reason: MoveErrorReason };

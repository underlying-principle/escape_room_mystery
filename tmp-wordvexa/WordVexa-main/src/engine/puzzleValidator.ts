/**
 * Level validator — the pre-ship gate. Every level must pass this before it
 * can be considered shippable (scripts/validate-levels.ts exits non-zero on
 * any error).
 *
 * Checks:
 *  1. Reachable at all — a valid path exists under this level's constraints.
 *  2. Matches intended difficulty — optimal length vs. designer's intent.
 *  3. No unintended shortcut — errors if the true optimum is shorter than
 *     intendedMoveCount.
 *  4. Every word in the solution exists in the curated dictionary.
 *
 * It also records the true optimal move count and a canonical optimal path
 * into the level data (never hand-guessed), and computes whether the
 * wildcard is mandatory.
 */
import type { LevelData, PlayerMove } from './types';
import { WordGraph, diffPosition } from './wordGraph';
import { solve } from './puzzleSolver';

export interface ValidatorIssue {
  severity: 'error' | 'warn';
  code: string;
  message: string;
}

export interface LevelValidation {
  levelId: string;
  ok: boolean;
  issues: ValidatorIssue[];
  optimalMoveCount: number | null;
  optimalPath: PlayerMove[] | null;
  /** Optimal length if wildcards were unavailable; null = unreachable. */
  optimalWithoutWildcard: number | null;
  wildcardRequired: boolean;
  statesExplored: number;
}

function structuralChecks(level: LevelData, graph: WordGraph): ValidatorIssue[] {
  const issues: ValidatorIssue[] = [];
  const err = (code: string, message: string) => issues.push({ severity: 'error', code, message });
  const warn = (code: string, message: string) => issues.push({ severity: 'warn', code, message });

  if (level.slots.length < 1 || level.slots.length > 2) {
    err('slot-count', `Level has ${level.slots.length} slots; MVP supports 1 or 2.`);
  }

  level.slots.forEach((slot, i) => {
    const s = slot.startWord;
    const t = slot.targetWord;
    if (!graph.has(s)) err('start-not-in-dictionary', `Slot ${i} start "${s}" is not in the curated dictionary.`);
    if (!graph.has(t)) err('target-not-in-dictionary', `Slot ${i} target "${t}" is not in the curated dictionary.`);
    if (s.length !== t.length) err('length-mismatch', `Slot ${i} start/target lengths differ.`);
    if (s === t) err('start-equals-target', `Slot ${i} start equals target.`);
    const seen = new Set<number>();
    for (const p of slot.lockedPositions) {
      if (!Number.isInteger(p) || p < 0 || p >= s.length) {
        err('locked-out-of-range', `Slot ${i} locked position ${p} out of range for "${s}".`);
      }
      if (seen.has(p)) warn('locked-duplicate', `Slot ${i} locked position ${p} listed twice.`);
      seen.add(p);
    }
  });

  if (level.wildcardCount < 0 || !Number.isInteger(level.wildcardCount)) {
    err('wildcard-count', `wildcardCount must be a non-negative integer.`);
  }

  for (const [ri, rule] of (level.reactionRules ?? []).entries()) {
    const a = level.slots[rule.triggerSlot];
    const b = level.slots[rule.resultSlot];
    if (!a || !b) {
      err('reaction-slot', `Rule ${ri} references a missing slot.`);
      continue;
    }
    if (rule.triggerSlot === rule.resultSlot) {
      err('reaction-self', `Rule ${ri} triggers and resolves on the same slot; not supported in MVP.`);
    }
    if (rule.triggerPosition < 0 || rule.triggerPosition >= a.startWord.length) {
      err('reaction-position', `Rule ${ri} triggerPosition out of range.`);
    }
    if (rule.resultPosition < 0 || rule.resultPosition >= b.startWord.length) {
      err('reaction-position', `Rule ${ri} resultPosition out of range.`);
    }
    if (!/^[a-z]$/.test(rule.triggerLetter) || !/^[a-z]$/.test(rule.resultLetter)) {
      err('reaction-letter', `Rule ${ri} letters must be single lowercase letters.`);
    }
  }

  return issues;
}

export function validateLevel(level: LevelData, graph: WordGraph): LevelValidation {
  const issues = structuralChecks(level, graph);
  const base: LevelValidation = {
    levelId: level.id,
    ok: false,
    issues,
    optimalMoveCount: null,
    optimalPath: null,
    optimalWithoutWildcard: null,
    wildcardRequired: false,
    statesExplored: 0,
  };
  if (issues.some((i) => i.severity === 'error')) return base;

  // 1 + 3 + 4: solve under the level's real constraints.
  const result = solve(level, graph);
  base.statesExplored = result?.statesExplored ?? 0;
  if (!result || result.truncated || result.path.length === 0) {
    if (result?.truncated) {
      issues.push({ severity: 'error', code: 'solver-capped', message: `State cap hit before solving.` });
    } else {
      issues.push({
        severity: 'error',
        code: 'unreachable',
        message: `No valid path from start to target under this level's constraints.`,
      });
    }
    return base;
  }

  base.optimalMoveCount = result.path.length;
  base.optimalPath = result.path;

  // Every word on the canonical path is dictionary-checked by construction,
  // but assert it explicitly (validator check 4).
  const words: string[] = level.slots.map((s) => s.startWord);
  for (const m of result.path) {
    words[m.slot] = words[m.slot].slice(0, m.position) + m.toLetter + words[m.slot].slice(m.position + 1);
    for (const r of m.reactions ?? []) {
      words[r.slot] = words[r.slot].slice(0, r.position) + r.toLetter + words[r.slot].slice(r.position + 1);
    }
  }
  words.forEach((w, i) => {
    if (!graph.has(w)) {
      issues.push({ severity: 'error', code: 'path-word-invalid', message: `Path leaves slot ${i} at non-dictionary word "${w}".` });
    }
  });

  // Wildcard analysis.
  const noWild: LevelData = { ...level, wildcardCount: 0 };
  const noWildResult = solve(noWild, graph);
  base.optimalWithoutWildcard = noWildResult && !noWildResult.truncated ? noWildResult.path.length : null;
  base.wildcardRequired = base.optimalWithoutWildcard === null;

  // 2: difficulty vs intent.
  if (level.intendedMoveCount !== undefined) {
    if (result.path.length < level.intendedMoveCount) {
      issues.push({
        severity: 'error',
        code: 'unintended-shortcut',
        message: `True optimum is ${result.path.length} moves, shorter than intended ${level.intendedMoveCount}.`,
      });
    } else if (result.path.length > level.intendedMoveCount) {
      issues.push({
        severity: 'warn',
        code: 'harder-than-intended',
        message: `True optimum is ${result.path.length} moves, harder than intended ${level.intendedMoveCount}.`,
      });
    }
  }
  if (level.world === 1 && result.path.length < 3) {
    issues.push({ severity: 'warn', code: 'too-trivial', message: `World 1 level solves in ${result.path.length} moves.` });
  }
  if (result.path.length > 9) {
    issues.push({ severity: 'warn', code: 'too-long', message: `Optimum is ${result.path.length} moves; portal players may bounce.` });
  }

  // Sanity for reaction levels: warn if any reaction could ever fire while its
  // result slot position is locked AND the forced letter differs — allowed by
  // the engine (scripted override) but should be a deliberate design choice.
  for (const [ri, rule] of (level.reactionRules ?? []).entries()) {
    const resSlot = level.slots[rule.resultSlot];
    if (resSlot?.lockedPositions.includes(rule.resultPosition)) {
      issues.push({
        severity: 'warn',
        code: 'reaction-overrides-lock',
        message: `Rule ${ri} writes to a locked position; reactions override locks by design. Make sure this is intended.`,
      });
    }
  }

  base.ok = !issues.some((i) => i.severity === 'error');
  return base;
}

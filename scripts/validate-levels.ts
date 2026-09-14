import fs from 'node:fs';
import path from 'node:path';
import { validateLevel } from '../src/engine/puzzleValidator';
import { parseGraphJson } from '../src/engine/wordGraph';
import type { GameState, LevelData, PlayerMove } from '../src/engine/types';

const root = process.cwd();
const graphPath = path.join(root, 'public/data/wordGraphCache.json');
const levelsPath = path.join(root, 'src/data/levels.json');

function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function applyPath(level: LevelData, pathMoves: PlayerMove[]): GameState[] {
  const states: GameState[] = [{ words: level.slots.map((slot) => slot.startWord), wildUsed: 0 }];
  for (const move of pathMoves) {
    const previous = states[states.length - 1];
    const words = previous.words.slice();
    words[move.slot] = words[move.slot].slice(0, move.position) + move.toLetter + words[move.slot].slice(move.position + 1);
    for (const reaction of move.reactions ?? []) {
      words[reaction.slot] = words[reaction.slot].slice(0, reaction.position) + reaction.toLetter + words[reaction.slot].slice(reaction.position + 1);
    }
    states.push({ words, wildUsed: previous.wildUsed + (move.usedWildcard ? 1 : 0) });
  }
  return states;
}

if (!fs.existsSync(graphPath)) fail(`Missing graph cache at ${graphPath}`);
if (!fs.existsSync(levelsPath)) fail(`Missing levels file at ${levelsPath}`);

let levels: LevelData[];
try {
  const graph = parseGraphJson(JSON.parse(fs.readFileSync(graphPath, 'utf8')));
  levels = JSON.parse(fs.readFileSync(levelsPath, 'utf8')) as LevelData[];
  if (!Array.isArray(levels)) fail('levels.json must contain an array.');

  const errors: string[] = [];
  const seenIds = new Set<string>();
  const worldCounts = new Map<number, number>();
  const optima: Array<number | null> = [];

  for (const level of levels) {
    if (seenIds.has(level.id)) errors.push(`${level.id}: duplicate level id.`);
    seenIds.add(level.id);
    worldCounts.set(level.world, (worldCounts.get(level.world) ?? 0) + 1);

    const validation = validateLevel(level, graph);
    for (const issue of validation.issues) {
      const message = `${level.id} [${issue.severity}] ${issue.code}: ${issue.message}`;
      if (issue.severity === 'error') errors.push(message);
      else console.warn(message);
    }
    if (!validation.ok || validation.optimalMoveCount === null || validation.optimalPath === null) continue;

    level.optimalMoveCount = validation.optimalMoveCount;
    level.optimalPath = validation.optimalPath;
    level.wildcardRequired = validation.wildcardRequired;
    optima.push(validation.optimalMoveCount);

    if (level.world === 1) {
      if (level.slots.length !== 1 || level.wildcardCount !== 0 || level.slots[0].lockedPositions.length !== 0) {
        errors.push(`${level.id}: World 1 must have one unconstrained slot and no wildcard.`);
      }
    } else if (level.world === 2) {
      if (level.slots.length !== 1 || level.wildcardCount !== 1 || level.slots[0].lockedPositions.length === 0) {
        errors.push(`${level.id}: World 2 must have one locked slot and exactly one wildcard.`);
      }
      if (!validation.wildcardRequired) errors.push(`${level.id}: World 2 wildcard is not mandatory.`);
    } else if (level.world === 4) {
      if (level.slots.length !== 1) errors.push(`${level.id}: World 4 must have one slot.`);
      if (level.wildcardCount > 2) errors.push(`${level.id}: World 4 allows at most two wildcards.`);
      if ((validation.optimalMoveCount ?? 0) < 9) errors.push(`${level.id}: World 4 optima must be at least 9 moves.`);
    } else if (level.world === 3 || level.world === 5 || level.world === 6) {
      if (level.slots.length !== 2 || !level.reactionRules?.length) {
        errors.push(`${level.id}: Worlds 3/5/6 must have two slots and at least one reaction rule.`);
      }
      const states = applyPath(level, validation.optimalPath);
      const reactions = validation.optimalPath.flatMap((move) => move.reactions ?? []);
      if (reactions.length === 0) errors.push(`${level.id}: No reaction fires on the canonical optimal path.`);
      for (const reaction of reactions) {
        const resultingWord = states.find((state) => state.words[reaction.slot][reaction.position] === reaction.toLetter)?.words[reaction.slot];
        if (resultingWord && !graph.has(resultingWord)) errors.push(`${level.id}: Reaction produced invalid word ${resultingWord}.`);
      }
      const withoutReactions = validateLevel({ ...level, reactionRules: [], intendedMoveCount: undefined }, graph);
      if (withoutReactions.optimalMoveCount === null || withoutReactions.optimalMoveCount - validation.optimalMoveCount < 1) {
        errors.push(`${level.id}: Reactions do not save at least one move.`);
      }
      if (level.world === 5 && (validation.optimalMoveCount ?? 0) < 13) {
        errors.push(`${level.id}: World 5 optima must be at least 13 moves.`);
      }
      if (level.world === 6) {
        const lockedCount = level.slots.reduce((n, s) => n + s.lockedPositions.length, 0);
        if (lockedCount < 1) errors.push(`${level.id}: World 6 must lock at least one position.`);
        if (level.wildcardCount < 1) errors.push(`${level.id}: World 6 must include a wildcard.`);
        if ((validation.optimalMoveCount ?? 0) < 17) errors.push(`${level.id}: World 6 optima must be at least 17 moves.`);
      }
    }

    console.log(`${level.id} ${level.name}: ${validation.optimalMoveCount} moves`);
  }

  const expectedCounts: Record<number, number> = { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 2 };
  for (const [world, count] of Object.entries(expectedCounts)) {
    if (worldCounts.get(Number(world)) !== count) {
      errors.push(`World ${world} has ${worldCounts.get(Number(world)) ?? 0} levels; expected ${count}.`);
    }
  }
  if (levels.length !== 22) errors.push(`Found ${levels.length} levels; expected 22.`);

  // Difficulty gate: levels 13-22 must each be strictly harder than the
  // previous level (level 12 ships at 8 moves, so the whole back half sits
  // above it and keeps climbing).
  for (let i = 13; i < levels.length; i++) {
    const prev = optima[i - 1];
    const cur = optima[i];
    if (prev === null || cur === null || prev === undefined || cur === undefined) continue;
    if (cur <= prev) errors.push(`${levels[i].id}: optimum ${cur} must exceed level ${i}'s optimum ${prev}.`);
  }

  if (errors.length > 0) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exit(1);
  }

  fs.writeFileSync(levelsPath, `${JSON.stringify(levels, null, 2)}\n`);
  console.log(`Validated and updated ${levels.length} levels.`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

import type { LevelData } from './types';
import levelsJson from '../data/levels.json';

export interface LevelPack {
  format: 1;
  levels: LevelData[];
}

/**
 * Levels are imported into the bundle so the CrazyGames ZIP has no extra
 * request that can fail under an iframe/CDN path. The offline validator edits
 * this source JSON before every release build.
 */
export async function loadLevelPack(): Promise<LevelPack> {
  const levels = levelsJson as LevelData[];
  if (!Array.isArray(levels) || levels.length !== 22) throw new Error('Invalid level pack');
  return { format: 1, levels };
}

export function worldName(world: 1 | 2 | 3 | 4 | 5 | 6): string {
  return (
    world === 1
      ? 'THE SIGNAL'
      : world === 2
        ? 'THE VAULT'
        : world === 3
          ? 'THE MIRROR'
          : world === 4
            ? 'THE DEPTHS'
            : world === 5
              ? 'THE STORM'
              : 'THE CORE'
  );
}

export function worldColor(world: 1 | 2 | 3 | 4 | 5 | 6): string {
  return (
    world === 1
      ? '#4ee1ff'
      : world === 2
        ? '#f7bd4a'
        : world === 3
          ? '#bc72ff'
          : world === 4
            ? '#43e97b'
            : world === 5
              ? '#ff6b6b'
              : '#ffe66d'
  );
}

export function allWorlds(levels: LevelData[]): Array<1 | 2 | 3 | 4 | 5 | 6> {
  return [...new Set(levels.map((l) => l.world))].sort((a, b) => a - b) as Array<1 | 2 | 3 | 4 | 5 | 6>;
}

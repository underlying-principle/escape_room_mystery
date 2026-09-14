import type { LevelData } from './types';

const STORAGE_KEY = 'wordshift-progress-v1';

export interface LevelRecord {
  stars: 1 | 2 | 3;
  bestMoves: number;
  bestTimeMs: number;
  hintsUsed: number;
}

export interface ProgressData {
  records: Record<string, LevelRecord>;
  lastLevelId: string;
  muted: boolean;
}

const EMPTY: ProgressData = { records: {}, lastLevelId: '01', muted: false };

export function loadProgress(): ProgressData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY, records: {} };
    const parsed = JSON.parse(raw) as Partial<ProgressData>;
    return {
      records: parsed.records ?? {},
      lastLevelId: parsed.lastLevelId ?? '01',
      muted: parsed.muted ?? false,
    };
  } catch {
    return { ...EMPTY, records: {} };
  }
}

export function saveProgress(progress: ProgressData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage can be denied inside privacy-restricted iframes. Gameplay still works.
  }
}

export function recordCompletion(
  progress: ProgressData,
  levelId: string,
  stars: 1 | 2 | 3,
  moves: number,
  timeMs: number,
  hintsUsed: number,
): ProgressData {
  const old = progress.records[levelId];
  const next: LevelRecord = {
    stars: Math.max(old?.stars ?? 0, stars) as 1 | 2 | 3,
    bestMoves: Math.min(old?.bestMoves ?? Number.POSITIVE_INFINITY, moves),
    bestTimeMs: Math.min(old?.bestTimeMs ?? Number.POSITIVE_INFINITY, timeMs),
    hintsUsed: Math.min(old?.hintsUsed ?? Number.POSITIVE_INFINITY, hintsUsed),
  };
  const result = { ...progress, records: { ...progress.records, [levelId]: next } };
  saveProgress(result);
  return result;
}

export function isLevelUnlocked(levels: LevelData[], index: number, progress: ProgressData): boolean {
  return index === 0 || Boolean(progress.records[levels[index - 1]?.id]);
}

export function totalStars(progress: ProgressData): number {
  return Object.values(progress.records).reduce((sum, r) => sum + r.stars, 0);
}

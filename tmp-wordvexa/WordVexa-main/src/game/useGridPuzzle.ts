import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  areAdjacent,
  completedRows,
  gridDistance,
  gridIsSolved,
  gridNextSwap,
  shuffledGrid,
  solvedLines,
  swapped,
  GRID_TARGETS,
} from '../engine/gridLevel';
import type { SoundManager } from '../audio/sound';

/** Matches the 450ms glide animation — input is locked while tiles travel. */
const SWAP_LOCK_MS = 500;

export interface GridPuzzle {
  grid: string;
  selected: number | null;
  moves: number;
  par: number;
  hintsUsed: number;
  hintCells: [number, number] | null;
  hintStage: 0 | 1;
  lines: number[];
  lastSwap: [number, number] | null;
  canUndo: boolean;
  solved: boolean;
  selectCell(cell: number): void;
  dragCell(cell: number, dir: 'up' | 'down' | 'left' | 'right'): void;
  undo(): void;
  hint(): void;
  restart(): void;
}

const DRAG_DELTA: Record<'up' | 'down' | 'left' | 'right', number> = {
  up: -3,
  down: 3,
  left: -1,
  right: 1,
};

/**
 * State and rules for the level-1 3x3 tile puzzle: selection, adjacent-swap
 * validation, move history/undo, solver-derived hints, and par from the
 * bidirectional BFS solver. A solve is a full row match OR a full column
 * match. `frozen` blocks input (time expired / level finished).
 */
export function useGridPuzzle(
  levelId: string,
  sound: SoundManager,
  onSolved: (moves: number, hintsUsed: number, par: number) => void,
  onMessage: (message: string, isError?: boolean) => void,
  frozen = false,
): GridPuzzle {
  const initial = useMemo(() => shuffledGrid(levelId), [levelId]);
  const par = useMemo(() => gridDistance(initial), [initial]);
  const [grid, setGrid] = useState(initial);
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintStage, setHintStage] = useState<0 | 1>(0);
  const [hintCells, setHintCells] = useState<[number, number] | null>(null);
  const [lastSwap, setLastSwap] = useState<[number, number] | null>(null);
  const lockRef = useRef(0);
  const gridRef = useRef(grid);
  gridRef.current = grid;
  const solvedRef = useRef(false);
  const frozenRef = useRef(frozen);
  frozenRef.current = frozen;
  const onSolvedRef = useRef(onSolved);
  onSolvedRef.current = onSolved;

  useEffect(() => {
    setGrid(initial);
    setSelected(null);
    setMoves(0);
    setHistory([]);
    setHintsUsed(0);
    setHintStage(0);
    setHintCells(null);
    setLastSwap(null);
    solvedRef.current = false;
  }, [initial]);

  const clearHint = () => {
    setHintStage(0);
    setHintCells(null);
  };

  const applySwap = useCallback(
    (a: number, b: number, announce = true) => {
      if (solvedRef.current || frozenRef.current) return;
      if (Date.now() < lockRef.current) return;
      lockRef.current = Date.now() + SWAP_LOCK_MS;
      const before = gridRef.current;
      const next = swapped(before, a, b);
      setHistory((h) => [...h, before]);
      setGrid(next);
      gridRef.current = next;
      setMoves((m) => m + 1);
      setSelected(null);
      setLastSwap([a, b]);
      sound.play('valid');
      clearHint();
      if (announce) {
        const beforeLines = solvedLines(before);
        solvedLines(next).forEach((line) => {
          if (!beforeLines.includes(line)) {
            onMessage(line < 3 ? `ROW LOCKED — ${GRID_TARGETS[line].toUpperCase()}` : `COLUMN LOCKED — ${GRID_TARGETS[line - 3].toUpperCase()}`);
          }
        });
      }
      if (gridIsSolved(next)) {
        solvedRef.current = true;
        onSolvedRef.current(history.length + 1, hintsUsed, par);
      }
    },
    [hintsUsed, history.length, onMessage, par, sound],
  );

  const selectCell = useCallback(
    (cell: number) => {
      if (solvedRef.current || frozenRef.current || Date.now() < lockRef.current) return;
      sound.play('select');
      if (selected === null) {
        setSelected(cell);
        return;
      }
      if (selected === cell) {
        setSelected(null);
        return;
      }
      if (areAdjacent(selected, cell)) {
        applySwap(selected, cell);
      } else {
        setSelected(cell);
        onMessage('Tiles must be adjacent to swap.', true);
      }
    },
    [applySwap, onMessage, selected, sound],
  );

  const dragCell = useCallback(
    (cell: number, dir: 'up' | 'down' | 'left' | 'right') => {
      if (solvedRef.current || frozenRef.current || Date.now() < lockRef.current) return;
      const target = cell + DRAG_DELTA[dir];
      if (target < 0 || target > 8 || !areAdjacent(cell, target)) {
        onMessage('Tiles must be adjacent to swap.', true);
        return;
      }
      applySwap(cell, target);
    },
    [applySwap, onMessage],
  );

  const undo = useCallback(() => {
    if (!history.length || solvedRef.current || frozenRef.current) return;
    const prev = history[history.length - 1];
    const diff = grid
      .split('')
      .map((ch, i) => (ch !== prev[i] ? i : -1))
      .filter((i) => i >= 0);
    setHistory((h) => h.slice(0, -1));
    setGrid(prev);
    gridRef.current = prev;
    setMoves((m) => m - 1);
    setSelected(null);
    setLastSwap(diff.length === 2 ? [diff[0], diff[1]] : null);
    clearHint();
    sound.play('select');
    onMessage('SWAP REVERSED');
  }, [grid, history.length, onMessage, sound]);

  const hint = useCallback(() => {
    if (solvedRef.current || frozenRef.current) return;
    const next = gridNextSwap(grid);
    if (!next) {
      onMessage('No route from here. Reverse a swap.', true);
      sound.play('invalid');
      return;
    }
    setHintsUsed((n) => n + 1);
    sound.play('hint');
    if (hintStage === 0) {
      setHintCells(next);
      setHintStage(1);
      onMessage('SIGNAL FOUND — swap the highlighted tiles.');
    } else {
      setHintStage(0);
      setHintCells(null);
      applySwap(next[0], next[1], false);
      onMessage('HINT SWAP APPLIED');
    }
  }, [applySwap, grid, hintStage, onMessage, sound]);

  const restart = useCallback(() => {
    setGrid(initial);
    gridRef.current = initial;
    setSelected(null);
    setMoves(0);
    setHistory([]);
    setHintsUsed(0);
    setHintStage(0);
    setHintCells(null);
    setLastSwap(null);
    solvedRef.current = false;
  }, [initial]);

  return {
    grid,
    selected,
    moves,
    par,
    hintsUsed,
    hintCells,
    hintStage,
    lines: solvedLines(grid),
    lastSwap,
    canUndo: history.length > 0,
    solved: gridIsSolved(grid),
    selectCell,
    dragCell,
    undo,
    hint,
    restart,
  };
}

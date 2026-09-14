import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameState, LevelData, MoveErrorReason, PlayerMove } from '../engine/types';
import { isGoal, tryMove } from '../engine/transformEngine';
import { optimalContinuation } from '../engine/hintSystem';
import { starsFor } from '../engine/scoreSystem';
import {
  GRID_LEVEL_ID,
  GRID_TARGETS,
  gridNeighbor,
} from '../engine/gridLevel';
import { buildLevelGraph, optimalPathKeys, stateKeyOf, type LevelGraph } from '../engine/graphLayout';
import { worldColor, worldName } from '../engine/levelManager';
import { WordBoard } from '../three/WordBoard';
import SignalLevel01 from './SignalLevel01';
import { useGridPuzzle } from '../game/useGridPuzzle';
import { HUD, formatTime } from './HUD';
import { LetterPicker } from './LetterPicker';
import { CompletePanel } from './CompletePanel';
import type { WordGraph } from '../engine/wordGraph';
import type { SoundManager } from '../audio/sound';

const ERROR_TEXT: Record<MoveErrorReason, string> = {
  'out-of-range': 'That tile cannot be shifted.',
  'not-a-change': 'Choose a different letter.',
  'locked-position': 'LOCKED — this tile cannot move.',
  'no-wildcard-left': 'Wildcard already consumed.',
  'invalid-word': 'No signal. That is not a valid word.',
  'reaction-invalid-word': 'Reaction unstable. Try another route.',
};

interface HistoryEntry {
  state: GameState;
  move: PlayerMove;
}

export interface CompletionData {
  stars: 1 | 2 | 3;
  moves: number;
  elapsedMs: number;
  hintsUsed: number;
}

const initial = (level: LevelData): GameState => ({
  words: level.slots.map((s) => s.startWord),
  wildUsed: 0,
});

/** Level 1 must be solved within 1:30 or the cube goes dark (QA override: ?gridTimeMs=). */
const GRID_TIME_LIMIT_MS =
  Number(new URLSearchParams(window.location.search).get('gridTimeMs')) || 90_000;

export function GameScreen({
  level,
  index,
  graph,
  sound,
  muted,
  onToggleMuted,
  onHome,
  onNext,
  onComplete,
  hasNext,
}: {
  level: LevelData;
  index: number;
  graph: WordGraph;
  sound: SoundManager;
  muted: boolean;
  onToggleMuted(): void;
  onHome(): void;
  onNext(): void;
  onComplete(data: CompletionData): void;
  hasNext: boolean;
}) {
  const isGrid = level.id === GRID_LEVEL_ID;
  const [state, setState] = useState(() => initial(level));
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selected, setSelected] = useState<{ slot: number; position: number } | null>(null);
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);
  const [hintStage, setHintStage] = useState(0);
  const [hintMove, setHintMove] = useState<PlayerMove | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [completed, setCompleted] = useState<CompletionData | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [timeLeftMs, setTimeLeftMs] = useState(GRID_TIME_LIMIT_MS);
  const deadlineRef = useRef(performance.now() + GRID_TIME_LIMIT_MS);
  const startTimeRef = useRef(performance.now());
  const reducedMotion = useMemo(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    [],
  );

  const notify = useCallback((text: string, isError = false) => {
    setMessage(text);
    setMessageIsError(isError);
    if (isError) sound.play('invalid');
    window.setTimeout(() => setMessage(''), 1800);
  }, [sound]);

  const handleGridSolved = useCallback(
    (movesUsed: number, hints: number, par: number) => {
      if (completed || gameOver) return;
      const time = Math.min(performance.now() - startTimeRef.current, GRID_TIME_LIMIT_MS);
      const data: CompletionData = {
        stars: starsFor(movesUsed, par),
        moves: movesUsed,
        elapsedMs: time,
        hintsUsed: hints,
      };
      setElapsedMs(time);
      setCompleted(data);
      sound.play('win');
      onComplete(data);
      // Let the grand victory animation breathe before the title card lands.
      window.setTimeout(() => setPanelVisible(true), 1000);
    },
    [completed, gameOver, onComplete, sound],
  );

  const frozen = isGrid && (gameOver || completed !== null);
  const gridPuzzle = useGridPuzzle(level.id, sound, handleGridSolved, notify, frozen);
  // The puzzle API has per-render identity; keep restart free of it so the
  // level-change effect below doesn't re-run (and reset) on every render.
  const gridApiRef = useRef(gridPuzzle);
  gridApiRef.current = gridPuzzle;

  // The playable word-graph constellation behind the board, derived once per level.
  const levelGraph = useMemo<LevelGraph | null>(() => {
    if (isGrid) return null;
    try {
      return buildLevelGraph(level, graph);
    } catch {
      return null;
    }
  }, [isGrid, level, graph]);
  const revealKeys = useMemo(() => (isGrid ? [] : optimalPathKeys(level)), [isGrid, level]);
  const trailKeys = useMemo(() => {
    if (isGrid) return [];
    const words = level.slots.map((s) => s.startWord);
    let wild = 0;
    const keys = [stateKeyOf(words, wild)];
    for (const h of history) {
      words[h.move.slot] =
        words[h.move.slot].slice(0, h.move.position) + h.move.toLetter + words[h.move.slot].slice(h.move.position + 1);
      for (const r of h.move.reactions ?? []) {
        words[r.slot] = words[r.slot].slice(0, r.position) + r.toLetter + words[r.slot].slice(r.position + 1);
      }
      wild += h.move.usedWildcard ? 1 : 0;
      keys.push(stateKeyOf(words, wild));
    }
    return keys;
  }, [isGrid, level, history]);
  const lastEdge = useMemo(() => {
    if (isGrid) return null;
    const last = history[history.length - 1];
    if (!last) return null;
    return {
      a: stateKeyOf(last.state.words, last.state.wildUsed),
      b: stateKeyOf(state.words, state.wildUsed),
    };
  }, [isGrid, history.length, state]);

  const restart = useCallback(() => {
    setState(initial(level));
    setHistory([]);
    setSelected(null);
    setMessage('');
    setHintStage(0);
    setHintMove(null);
    setHintsUsed(0);
    setElapsedMs(0);
    setCompleted(null);
    setGameOver(false);
    setPanelVisible(false);
    setTimeLeftMs(GRID_TIME_LIMIT_MS);
    deadlineRef.current = performance.now() + GRID_TIME_LIMIT_MS;
    startTimeRef.current = performance.now();
    if (isGrid) gridApiRef.current.restart();
  }, [isGrid, level]);

  useEffect(() => restart(), [level.id, restart]);

  useEffect(() => {
    if (completed || gameOver) return;
    if (isGrid) {
      const tick = () => {
        const left = deadlineRef.current - performance.now();
        setTimeLeftMs(Math.max(0, left));
        if (left <= 0) {
          setGameOver(true);
          sound.play('invalid');
        }
      };
      tick();
      const id = window.setInterval(tick, 200);
      return () => window.clearInterval(id);
    }
    const tick = () => setElapsedMs(performance.now() - startTimeRef.current);
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [completed, gameOver, isGrid, level.id, sound]);

  const finish = useCallback((nextState: GameState, nextMoves: number, nextHints: number) => {
    if (isGrid || !isGoal(level, nextState) || completed) return;
    const time = performance.now() - startTimeRef.current;
    const data: CompletionData = {
      stars: starsFor(nextMoves, level.optimalMoveCount),
      moves: nextMoves,
      elapsedMs: time,
      hintsUsed: nextHints,
    };
    setElapsedMs(time);
    setCompleted(data);
    sound.play('win');
    onComplete(data);
  }, [completed, isGrid, level, onComplete, sound]);

  const apply = useCallback((slot: number, position: number, letter: string) => {
    const result = tryMove(level, state, slot, position, letter, graph);
    if (!result.ok) {
      notify(ERROR_TEXT[result.reason], true);
      return false;
    }
    setHistory((h) => [...h, { state, move: result.move }]);
    setState(result.nextState);
    setSelected(null);
    setHintMove(null);
    setHintStage(0);
    setMessage(
      result.move.reactions?.length
        ? 'WORD REACTION — linked signal shifted!'
        : result.move.usedWildcard
          ? 'WILDCARD CONSUMED — lock broken.'
          : result.nextState.words[slot].toUpperCase(),
    );
    setMessageIsError(false);
    sound.play(result.move.reactions?.length ? 'reaction' : 'valid');
    const nextMoves = history.length + 1;
    window.setTimeout(() => setMessage(''), 1700);
    finish(result.nextState, nextMoves, hintsUsed);
    return true;
  }, [finish, graph, hintsUsed, history.length, level, notify, sound, state]);

  const selectTile = (slot: number, position: number) => {
    if (completed) return;
    setSelected({ slot, position });
    sound.play('select');
  };

  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (isGrid) {
        if (e.key === 'Escape') {
          if (gridPuzzle.selected !== null) gridPuzzle.selectCell(gridPuzzle.selected);
          return;
        }
        if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          gridPuzzle.undo();
          return;
        }
        const dirs: Record<string, 'up' | 'down' | 'left' | 'right'> = {
          ArrowUp: 'up',
          ArrowDown: 'down',
          ArrowLeft: 'left',
          ArrowRight: 'right',
        };
        const dir = dirs[e.key];
        if (!dir) return;
        e.preventDefault();
        if (gridPuzzle.selected === null) {
          gridPuzzle.selectCell(4); // start keyboard play from the centre tile
          return;
        }
        if (gridNeighbor(gridPuzzle.selected, dir) !== null) gridPuzzle.dragCell(gridPuzzle.selected, dir);
        return;
      }
      if (e.key === 'Escape') return setSelected(null);
      if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        undo();
        return;
      }
      if (selected && /^[a-zA-Z]$/.test(e.key)) apply(selected.slot, selected.position, e.key.toLowerCase());
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });

  const undo = () => {
    if (!history.length || completed) return;
    const last = history[history.length - 1];
    setState(last.state);
    setHistory((h) => h.slice(0, -1));
    setSelected(null);
    setHintMove(null);
    setHintStage(0);
    notify('SHIFT REVERSED');
  };

  const useHint = () => {
    const path = optimalContinuation(level, state, graph, 1);
    if (!path?.[0]) {
      notify('No route from here. Reverse a shift.', true);
      return;
    }
    const move = path[0];
    const stage = hintMove && hintMove.slot === move.slot && hintMove.position === move.position ? hintStage : 0;
    setHintsUsed((n) => n + 1);
    sound.play('hint');
    if (stage === 0) {
      setHintMove(move);
      setHintStage(1);
      setMessage(`SIGNAL FOUND — highlight tile ${move.position + 1}.`);
      setMessageIsError(false);
    } else if (stage === 1) {
      setHintStage(2);
      setMessage(`SHIFT ${move.fromLetter.toUpperCase()} → ${move.toLetter.toUpperCase()}.`);
      setMessageIsError(false);
    } else {
      const nextHints = hintsUsed + 1;
      setHintStage(0);
      setHintMove(null);
      const result = tryMove(level, state, move.slot, move.position, move.toLetter, graph);
      if (result.ok) {
        setHistory((h) => [...h, { state, move: result.move }]);
        setState(result.nextState);
        setMessage('HINT SHIFT APPLIED');
        setMessageIsError(false);
        sound.play(result.move.reactions?.length ? 'reaction' : 'valid');
        finish(result.nextState, history.length + 1, nextHints);
      }
    }
    window.setTimeout(() => setMessage(''), 2500);
  };

  const targets = isGrid ? GRID_TARGETS : level.slots.map((s) => s.targetWord);
  void targets;
  const selectedLocked = selected ? level.slots[selected.slot].lockedPositions.includes(selected.position) : false;
  const wildAvailable = state.wildUsed < level.wildcardCount;

  // Level 1 renders the dedicated Signal Cube screen (Three.js backdrop world
  // + DOM tile board) with the shared overlays on top.
  if (isGrid) {
    return (
      <main className="game-screen">
        <SignalLevel01
          levelName={level.name}
          levelCode={level.id.toUpperCase()}
          grid={gridPuzzle.grid}
          selected={gridPuzzle.selected}
          hintCells={gridPuzzle.hintCells}
          lines={gridPuzzle.lines}
          victory={gridPuzzle.solved}
          moves={gridPuzzle.moves}
          par={gridPuzzle.par}
          timeLabel={formatTime(timeLeftMs)}
          timeCritical={timeLeftMs < 15_000 && !completed && !gameOver}
          hintStage={gridPuzzle.hintStage}
          canUndo={gridPuzzle.canUndo}
          muted={muted}
          message={message}
          messageIsError={messageIsError}
          onHome={onHome}
          onRestart={restart}
          onToggleMuted={onToggleMuted}
          onUndo={gridPuzzle.undo}
          onHint={gridPuzzle.hint}
          onCellTap={gridPuzzle.selectCell}
          onCellDrag={gridPuzzle.dragCell}
        />
        {gameOver && (
          <div className="modal-backdrop">
            <section className="complete-panel game-over screen-enter" role="dialog" aria-label="Time expired">
              <small>1:30 ELAPSED</small>
              <h2 className="title-card shake">SIGNAL LOST</h2>
              <p className="over-note">The cube went dark before every word locked in. One more run?</p>
              <button className="primary danger" onClick={restart}>↻ TRY AGAIN</button>
              <div className="modal-actions">
                <button onClick={onHome}>⌂ LEVEL MAP</button>
              </div>
            </section>
          </div>
        )}
        {completed && panelVisible && (
          <CompletePanel
            levelName={level.name}
            stars={completed.stars}
            moves={completed.moves}
            optimal={gridPuzzle.par}
            elapsedMs={completed.elapsedMs}
            hasNext={hasNext}
            onNext={onNext}
            onReplay={restart}
            onMap={onHome}
          />
        )}
      </main>
    );
  }

  return (
    <main className="game-screen screen-enter" style={{ '--world': worldColor(level.world) } as React.CSSProperties}>
      <div className="vignette" />
      <HUD
        level={index + 1}
        moves={history.length}
        optimal={level.optimalMoveCount}
        elapsedMs={elapsedMs}
        worldName={worldName(level.world)}
        onHome={onHome}
        onRestart={restart}
        muted={muted}
        onToggleMuted={onToggleMuted}
      />
      <section className="puzzle-header">
        <small>SIGNAL {level.id}</small>
        <h1>{level.name}</h1>
        <p>{level.blurb}</p>
      </section>
      <section className="target-strip">
        <small>TARGET{targets.length > 1 ? 'S' : ''}</small>
        {targets.map((t, i) => <b key={i}>{t.toUpperCase()}</b>)}
      </section>
      <div className="board-wrap">
        {level.slots.length > 1 && <div className="mirror-axis"><span>LINKED</span></div>}
        <WordBoard
          words={state.words}
          targets={targets}
          lockedPositions={level.slots.map((s) => s.lockedPositions)}
          selected={selected}
          hint={hintMove ? { slot: hintMove.slot, position: hintMove.position } : null}
          world={level.world}
          reducedMotion={reducedMotion}
          backdrop={level.backdrop ?? 'arctic'}
          graph={levelGraph}
          activeKey={stateKeyOf(state.words, state.wildUsed)}
          trailKeys={trailKeys}
          lastEdge={lastEdge}
          reveal={completed !== null}
          revealKeys={revealKeys}
          onTileSelect={selectTile}
        />
        {message && <div className={`toast ${messageIsError ? 'error' : ''}`}>{message}</div>}
      </div>
      <div className="game-controls">
        <button onClick={undo} disabled={!history.length}>↶ <span>UNDO</span></button>
        <div className="wild-status" data-active={wildAvailable && level.wildcardCount > 0}>
          <i>◆</i><span>WILDCARD<small>{level.wildcardCount === 0 ? 'OFFLINE' : wildAvailable ? 'READY' : 'USED'}</small></span>
        </div>
        <button onClick={useHint}>◇ <span>HINT {hintStage ? `${hintStage}/3` : ''}</span></button>
      </div>
      <LetterPicker
        visible={Boolean(selected)}
        current={selected ? state.words[selected.slot][selected.position] : ''}
        wildcard={Boolean(selectedLocked && wildAvailable)}
        onPick={(letter) => selected && apply(selected.slot, selected.position, letter)}
        onClose={() => setSelected(null)}
      />
      {completed && (
        <CompletePanel
          levelName={level.name}
          stars={completed.stars}
          moves={completed.moves}
          optimal={level.optimalMoveCount}
          elapsedMs={completed.elapsedMs}
          hasNext={hasNext}
          onNext={onNext}
          onReplay={restart}
          onMap={onHome}
        />
      )}
    </main>
  );
}

/**
 * THE LAST LOOP — React bridge. Owns the rAF loop, input, audio mapping and
 * HUD snapshots. The simulation itself stays pure (see core/simulation.ts).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LOOP_MS, VIEW_H, VIEW_W, loopLengthFromParams } from './core/constants';
import { createLoopState, objectiveFor, queueInteract, step, interactionPromptFor, submitTimelineOrder, submitExitCode, markRecorderPlayed, closePanel } from './core/simulation';
import { restartLevel as resetLevel, restartLoop as resetCurrentLoop } from './core/simulation';
import type { GameEvent, InputState, LoopState, Objective, PanelType, InvestigationState } from './core/types';
import { renderFrame } from './render/render';
import { LoopAudio } from './services/audio';
import { gameplayStart, gameplayStop, happytime, initCrazyGames, isCrazyGamesReady } from './services/crazygames';
import { applyLevel01Checkpoint, captureLevel01Checkpoint, flushLoopSave, loadLoopSave, recordResult, saveLoopSave, saveLoopSaveNow, type LastLoopSave } from './services/save';

export interface HudSnapshot {
  loop: number; // 1-based
  remainingMs: number;
  phase: LoopState['phase'];
  objective: Objective;
  hasCard: boolean;
  ghosts: number;
  warningLevel: number;
  doorOpen: boolean;
  paused: boolean;
  prompt: string | null;
  panel: PanelType;
  panelMessage: string | null;
  investigation: InvestigationState;
}

export interface WinInfo {
  loops: number;
  timeMs: number;
  bestTimeMs: number | null;
  bestLoops: number | null;
}

export function useTheLastLoop(save: LastLoopSave, onChange: (s: LastLoopSave) => void) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const initialState = useMemo(() => {
    const state = createLoopState(loopLengthFromParams(window.location.search));
    state.investigation = { ...state.investigation, ...save.level01Investigation };
    state.hasCard = state.investigation.accessCard;
    if (save.checkpoint) {
      try { applyLevel01Checkpoint(state, save.checkpoint); } catch { /* ignore malformed checkpoint */ }
    }
    return state;
  }, []);
  const stateRef = useRef<LoopState>(initialState);
  const audioRef = useRef<LoopAudio | null>(null);
  const inputRef = useRef<InputState>({ up: false, down: false, left: false, right: false });
  const pausedRef = useRef(false);
  const rafRef = useRef(0);
  const lastFrameRef = useRef(0);
  const hudClockRef = useRef(0);
  const autosaveClockRef = useRef(0);
  const wonRef = useRef(false);

  const [hud, setHud] = useState<HudSnapshot>({
    loop: 1,
    remainingMs: LOOP_MS,
    phase: 'playing',
    objective: 'findSwitch',
    hasCard: false,
    ghosts: 0,
    warningLevel: 0,
    doorOpen: false,
    paused: false,
    prompt: null,
    panel: 'none',
    panelMessage: null,
    investigation: { note: false, clock: false, accessCard: false, terminal: false, cctv: false, badge07: false, suspectMara: false, timeline: false, recorder: false, finalRecording: false, exitCodeSolved: false },
  });
  const [win, setWin] = useState<WinInfo | null>(null);
  const [panel, setPanel] = useState<PanelType>('none');
  const [panelMessage, setPanelMessage] = useState<string | null>(null);
  const [paused, setPausedState] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const audio = useMemo(() => {
    const a = new LoopAudio();
    a.musicOn = save.settings.music;
    a.sfxOn = save.settings.sfx;
    return a;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  audioRef.current = audio;

  const setPaused = useCallback(
    (on: boolean) => {
      if (stateRef.current.phase === 'complete') return;
      pausedRef.current = on;
      setPausedState(on);
      if (on) gameplayStop();
      else gameplayStart();
    },
    [],
  );

  const handleEvents = useCallback(
    (events: GameEvent[]) => {
      const a = audioRef.current!;
      for (const event of events) {
        switch (event.type) {
          case 'switchOn':
            a.switchClick();
            a.hum();
            break;
          case 'boxUnlocked':
            a.glassUnlock();
            break;
          case 'cardTaken':
            a.cardPickup();
            break;
          case 'doorUnlocked':
            a.doorUnlock();
            break;
          case 'doorOpen':
            a.doorOpen();
            break;
          case 'clueFound':
            a.clue();
            onChangeRef.current(saveLoopSave((s) => ({ ...s, level01Investigation: { ...stateRef.current.investigation } })));
            break;
          case 'openPanel':
            stateRef.current.panel = event.panel;
            pausedRef.current = true;
            gameplayStop();
            setPanel(event.panel);
            setPanelMessage(null);
            break;
          case 'timelineSolved':
            a.discovery();
            onChangeRef.current(saveLoopSave((s) => ({ ...s, level01Investigation: { ...stateRef.current.investigation } })));
            break;
          case 'finalRecording':
            a.finalRecording();
            onChangeRef.current(saveLoopSave((s) => ({ ...s, level01Investigation: { ...stateRef.current.investigation } })));
            setPanel('none');
            break;
          case 'loopReset':
            a.loopReset();
            setPanel('none');
            setPanelMessage(null);
            break;
          case 'ghostAppear':
            a.ghostAppear();
            break;
          case 'warning':
            a.warning(event.level === 2);
            break;
          case 'footstep':
            a.footstep();
            break;
          case 'complete':
            a.success();
            break;
        }
      }
    },
    [],
  );

  // Main loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    const ctx = canvas.getContext('2d')!;

    void initCrazyGames().then(() => {
      if (isCrazyGamesReady()) gameplayStart();
    });
    gameplayStart();

    let mounted = true;
    const frame = (now: number) => {
      if (!mounted) return;
      rafRef.current = requestAnimationFrame(frame);
      const state = stateRef.current;
      const dt = lastFrameRef.current ? now - lastFrameRef.current : 16.7;
      lastFrameRef.current = now;
      if (!pausedRef.current && state.phase !== 'complete') {
        handleEvents(step(state, dt));
      }
      renderFrame(ctx, state);

      hudClockRef.current += dt;
      autosaveClockRef.current += dt;
      if (hudClockRef.current > 120) {
        hudClockRef.current = 0;
        setHud({
          loop: state.loop + 1,
          remainingMs: Math.max(0, state.loopLengthMs - state.t),
          phase: state.phase,
          objective: objectiveFor(state),
          hasCard: state.hasCard,
          ghosts: state.ghosts.length,
          warningLevel: state.warningFired,
          doorOpen: state.door === 'open',
          paused: pausedRef.current,
          prompt: interactionPromptFor(state),
          panel: state.panel,
          panelMessage: state.panelMessage,
          investigation: { ...state.investigation },
        });
        if (state.panel === 'none') { setPanel('none'); setPanelMessage(null); }
      }

      if (autosaveClockRef.current >= 2000 && state.phase === 'playing') {
        autosaveClockRef.current = 0;
        onChangeRef.current(saveLoopSave((s) => ({
          ...s,
          currentLevel: 1,
          level01Investigation: { ...state.investigation },
          checkpoint: captureLevel01Checkpoint(state),
        })));
      }

      if (state.phase === 'complete' && !wonRef.current) {
        wonRef.current = true;
        gameplayStop();
        happytime();
        const loops = state.loop + 1;
        const timeMs = Math.round(state.totalTimeMs);
        const updated = saveLoopSaveNow((s) => recordResult(s, 1, timeMs, loops));
        onChangeRef.current(updated);
        setWin({
          loops,
          timeMs,
          bestTimeMs: updated.results['1'].bestTimeMs,
          bestLoops: updated.results['1'].bestLoops,
        });
      }
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      mounted = false;
      cancelAnimationFrame(rafRef.current);
      flushLoopSave();
    };
  }, [handleEvents]);

  // Input.
  useEffect(() => {
    const keyMap: Record<string, keyof InputState | 'interact' | 'restart' | 'pause'> = {
      KeyW: 'up',
      ArrowUp: 'up',
      KeyS: 'down',
      ArrowDown: 'down',
      KeyA: 'left',
      ArrowLeft: 'left',
      KeyD: 'right',
      ArrowRight: 'right',
      KeyE: 'interact',
      KeyR: 'restart',
      Escape: 'pause',
    };
    const audio = audioRef.current!;
    const down = (e: KeyboardEvent) => {
      const mapped = keyMap[e.code];
      if (!mapped) return;
      e.preventDefault();
      audio.unlock();
      if (mapped === 'interact') {
        if (!pausedRef.current) queueInteract(stateRef.current);
        return;
      }
      if (mapped === 'restart') {
        if (!pausedRef.current && stateRef.current.phase === 'playing') resetCurrentLoop(stateRef.current);
        return;
      }
      if (mapped === 'pause') {
        setPaused(!pausedRef.current);
        return;
      }
      if (pausedRef.current) return;
      inputRef.current[mapped] = true;
      stateRef.current.input[mapped] = true;
    };
    const up = (e: KeyboardEvent) => {
      const mapped = keyMap[e.code];
      if (mapped && mapped !== 'interact' && mapped !== 'restart' && mapped !== 'pause') {
        inputRef.current[mapped] = false;
        stateRef.current.input[mapped] = false;
      }
    };
    const clearDirections = () => {
      inputRef.current.up = inputRef.current.down = inputRef.current.left = inputRef.current.right = false;
      stateRef.current.input.up = stateRef.current.input.down = stateRef.current.input.left = stateRef.current.input.right = false;
    };
    const visibility = () => { if (document.hidden) clearDirections(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clearDirections);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clearDirections);
      document.removeEventListener('visibilitychange', visibility);
      clearDirections();
    };
  }, [setPaused]);

  const restartLoop = useCallback(() => {
    if (stateRef.current.phase === 'playing') {
      resetCurrentLoop(stateRef.current);
      onChange(saveLoopSave((s) => ({ ...s, level01Investigation: { ...stateRef.current.investigation }, checkpoint: captureLevel01Checkpoint(stateRef.current) })));
    }
  }, [onChange]);

  const restartLevel = useCallback(() => {
    resetLevel(stateRef.current);
    wonRef.current = false;
    setWin(null);
    setPaused(false);
    pausedRef.current = false;
    onChange(saveLoopSaveNow((s) => ({
      ...s,
      currentLevel: 1,
      level01Investigation: { ...stateRef.current.investigation },
      checkpoint: null,
    })));
    gameplayStart();
  }, [setPaused, onChange]);

  const pressDir = useCallback((dir: keyof InputState, on: boolean) => {
    audioRef.current?.unlock();
    inputRef.current[dir] = on;
    stateRef.current.input[dir] = on;
  }, []);

  const pressInteract = useCallback(() => {
    audioRef.current?.unlock();
    queueInteract(stateRef.current);
  }, []);

  const toggleMusic = useCallback(() => {
    const on = !save.settings.music;
    audio.setMusic(on);
    onChange(saveLoopSave((s) => ({ ...s, settings: { ...s.settings, music: on } })));
  }, [audio, onChange, save.settings.music]);

  const toggleSfx = useCallback(() => {
    const on = !save.settings.sfx;
    audio.setSfx(on);
    onChange(saveLoopSave((s) => ({ ...s, settings: { ...s.settings, sfx: on } })));
  }, [audio, onChange, save.settings.sfx]);

  const submitTimeline = useCallback((order: string[]) => {
    const ok = submitTimelineOrder(stateRef.current, order);
    if (ok) {
      closePanel(stateRef.current);
      pausedRef.current = false;
      setPausedState(false);
      gameplayStart();
      setPanel('none');
      setPanelMessage(null);
      onChange(saveLoopSave((s) => ({ ...s, level01Investigation: { ...stateRef.current.investigation } })));
    } else {
      setPanelMessage(stateRef.current.panelMessage);
    }
    return ok;
  }, [onChange]);

  const submitCode = useCallback((code: string) => {
    const ok = submitExitCode(stateRef.current, code);
    if (ok) {
      closePanel(stateRef.current);
      pausedRef.current = false;
      setPausedState(false);
      gameplayStart();
      setPanel('none');
      setPanelMessage(null);
      onChange(saveLoopSave((s) => ({ ...s, level01Investigation: { ...stateRef.current.investigation } })));
    } else {
      setPanelMessage(stateRef.current.panelMessage);
    }
    return ok;
  }, [onChange]);

  const closeStoryPanel = useCallback(() => {
    closePanel(stateRef.current);
    pausedRef.current = false;
    setPausedState(false);
    gameplayStart();
    setPanel('none');
    setPanelMessage(null);
  }, []);

  const playFinalRecording = useCallback(() => {
    markRecorderPlayed(stateRef.current);
    closePanel(stateRef.current);
    pausedRef.current = false;
    setPausedState(false);
    gameplayStart();
    setPanel('none');
    onChange(saveLoopSave((s) => ({ ...s, level01Investigation: { ...stateRef.current.investigation } })));
  }, [onChange]);

  return {
    canvasRef,
    hud,
    win,
    paused,
    setPaused,
    restartLoop,
    restartLevel,
    pressDir,
    pressInteract,
    toggleMusic,
    toggleSfx,
    panel,
    panelMessage,
    submitTimeline,
    submitCode,
    closeStoryPanel,
    playFinalRecording,
    loopSeconds: Math.round(stateRef.current.loopLengthMs / 1000),
  };
}

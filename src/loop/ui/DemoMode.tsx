
/**

 * THE LAST LOOP — Level 0: the tutorial cinematic.

 *

 * A full-screen "video game intro" that plays the real Level 01 through its

 * first two loops with a scripted player (see demo/director.ts), narrated by

 * cinematic captions. Skippable at any time; ends with a handoff into the

 * actual level. Story panels stay visible but non-interactive (it is a show,

 * not a play).

 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { VIEW_H, VIEW_W } from '../core/constants';

import { createLoopState, closePanel, objectiveFor, interactionPromptFor, submitExitCode, submitTimelineOrder, markRecorderPlayed } from '../core/simulation';

import type { GameEvent, LoopState, PanelType } from '../core/types';

import { renderFrame } from '../render/render';

import { LoopAudio } from '../services/audio';

import { DemoDirector, type DemoCaption } from '../demo/director';

import { HUD } from './HUD';

import { StoryPanels, ResetFlash } from './Overlays';

import type { HudSnapshot } from '../useGame';

function snapshot(state: LoopState): HudSnapshot {

  return {

    loop: state.loop + 1,

    remainingMs: Math.max(0, state.loopLengthMs - state.t),

    phase: state.phase,

    objective: objectiveFor(state),

    hasCard: state.hasCard,

    ghosts: state.ghosts.length,

    warningLevel: state.warningFired,

    doorOpen: state.door === 'open',

    paused: false,

    prompt: interactionPromptFor(state),

    panel: state.panel,

    panelMessage: state.panelMessage,

    investigation: { ...state.investigation },

  };

}

function playSfx(a: LoopAudio, ev: GameEvent): void {

  switch (ev.type) {

    case 'switchOn': a.switchClick(); a.hum(); break;

    case 'boxUnlocked': a.glassUnlock(); break;

    case 'cardTaken': a.cardPickup(); break;

    case 'doorUnlocked': a.doorUnlock(); break;

    case 'doorOpen': a.doorOpen(); break;

    case 'clueFound': a.clue(); break;

    case 'timelineSolved': a.discovery(); break;

    case 'finalRecording': a.finalRecording(); break;

    case 'loopReset': a.loopReset(); break;

    case 'ghostAppear': a.ghostAppear(); break;

    case 'warning': a.warning(ev.level === 2); break;

    case 'footstep': a.footstep(); break;

    case 'complete': a.success(); break;

    default: break;

  }

}

const fmt = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

type DemoPhase = 'intro' | 'run' | 'outro';

export function DemoMode({ onDone }: { onDone(): void }): JSX.Element {

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const stateRef = useRef<LoopState | null>(null);

  if (!stateRef.current) stateRef.current = createLoopState();

  const directorRef = useRef<DemoDirector | null>(null);

  const audioRef = useRef<LoopAudio | null>(null);

  if (!audioRef.current) audioRef.current = new LoopAudio();

  const phaseRef = useRef<DemoPhase>('intro');

  const doneRef = useRef(false);

  const [phase, setPhaseState] = useState<DemoPhase>('intro');

  const [caption, setCaption] = useState<DemoCaption | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(() => snapshot(stateRef.current!));

  const [panel, setPanel] = useState<PanelType>('none');

  const [panelMessage, setPanelMessage] = useState<string | null>(null);

  const [outro, setOutro] = useState({ loops: 1, ms: 0 });

  const setPhase = (p: DemoPhase) => {

    phaseRef.current = p;

    setPhaseState(p);

  };

  const finish = useCallback(() => {

    if (doneRef.current) return;

    doneRef.current = true;

    audioRef.current?.setMusic(false);

    onDone();

  }, [onDone]);

  const start = useCallback(() => {

    if (phaseRef.current !== 'intro') return;

    const audio = audioRef.current!;

    audio.unlock();

    directorRef.current = new DemoDirector(stateRef.current!, (out) => {

      if (out.type === 'caption') setCaption(out.cap);

      else if (out.type === 'clearCaption') setCaption(null);

      else if (out.type === 'outro') {

        const s = stateRef.current!;

        setOutro({ loops: s.loop + 1, ms: Math.round(s.totalTimeMs) });

        setPhase('outro');

      } else if (out.type === 'error') {

        // Broken geometry would stall the show — hand over to the level.

        finish();

      }

    });

    setPhase('run');

  }, [finish]);

  // rAF: render every frame; tick the director while running.

  useEffect(() => {

    const canvas = canvasRef.current;

    if (!canvas) return;

    canvas.width = VIEW_W;

    canvas.height = VIEW_H;

    const ctx = canvas.getContext('2d')!;

    let raf = 0;

    let last = 0;

    let hudClock = 0;

    let lastPanel: PanelType = 'none';

    let mounted = true;

    const frame = (now: number) => {

      if (!mounted) return;

      raf = requestAnimationFrame(frame);

      const dt = last ? Math.min(now - last, 100) : 16.7;

      last = now;

      const state = stateRef.current!;

      const director = directorRef.current;

      if (phaseRef.current === 'run' && director && !director.atEnd) {

        const events = director.tick(dt);

        if (events.length) for (const ev of events) playSfx(audioRef.current!, ev);

      }

      renderFrame(ctx, state);

      if (state.panel !== lastPanel) {

        lastPanel = state.panel;

        setPanel(state.panel);

        setPanelMessage(state.panelMessage);

      }

      hudClock += dt;

      if (hudClock > 100) {

        hudClock = 0;

        setHud(snapshot(state));

      }

    };

    raf = requestAnimationFrame(frame);

    return () => {

      mounted = false;

      cancelAnimationFrame(raf);

      audioRef.current?.setMusic(false);

    };

  }, []);

  // Demo keyboard: ENTER starts / confirms, ESC skips. (The level's own keys

  // are harmless behind the overlay — the level is paused.)

  useEffect(() => {

    const down = (e: KeyboardEvent) => {

      const p = phaseRef.current;

      if (p === 'intro' && (e.code === 'Enter' || e.code === 'Space')) {

        e.preventDefault();

        start();

      } else if (p === 'run' && e.code === 'Escape') {

        e.preventDefault();

        finish();

      } else if (p === 'outro' && (e.code === 'Enter' || e.code === 'KeyE' || e.code === 'Space')) {

        e.preventDefault();

        finish();

      }

    };

    window.addEventListener('keydown', down);

    return () => window.removeEventListener('keydown', down);

  }, [start, finish]);

  return (

    <div className="ll-root ll-demo-root">

      <div className="ll-stage">

        <canvas ref={canvasRef} className="ll-canvas" />

        <HUD hud={hud} loopSeconds={60} />

        <div className="ll-demo-badge">TUTORIAL</div>

        <div className="ll-cine-bars" aria-hidden />

        {caption && phase === 'run' && (

          <div className="ll-demo-caption" key={caption.id}>

            {caption.keys && (

              <div className="ll-demo-keys">

                {caption.keys.map((k) => (

                  <span className="ll-key" key={k}>{k}</span>

                ))}

              </div>

            )}

            {caption.title && <div className="ll-demo-cap-title">{caption.title}</div>}

            {caption.text && <div className="ll-demo-cap-text">{caption.text}</div>}

          </div>

        )}

        <ResetFlash active={hud.phase === 'resetting'} />

        {panel !== 'none' && (

          <StoryPanels

            panel={panel}

            message={panelMessage}

            investigation={hud.investigation}

            onClose={() => closePanel(stateRef.current!)}

            onTimeline={(order: string[]) => submitTimelineOrder(stateRef.current!, order)}

            onPlayRecording={() => markRecorderPlayed(stateRef.current!)}

            onCode={(code: string) => submitExitCode(stateRef.current!, code)}

          />

        )}

        {phase === 'intro' && (

          <div className="ll-demo-intro">

            <small>CASE 001 · TUTORIAL</small>

            <h1>THE LAST LOOP</h1>

            <p>You will live the same 60 seconds over and over.<br />This short demo shows you how to break it.</p>

            <button className="ll-demo-start" onClick={start}>▶ START THE DEMO</button>

            <small>press ENTER — or SKIP, top right</small>

          </div>

        )}

        {phase === 'outro' && (

          <div className="ll-demo-outro">

            <small>DEMO COMPLETE</small>

            <h1>THE LOOP BROKE</h1>

            <div className="ll-demo-outro-stats">

              ESCAPED IN {String(outro.loops).padStart(2, '0')} LOOPS · {fmt(outro.ms)}

            </div>

            <p>Now it is your turn. Same room, same 60 seconds —<br />but only your actions will be recorded.</p>

            <button className="ll-demo-start" onClick={finish}>ENTER LEVEL 01</button>

            <small>press ENTER</small>

          </div>

        )}

      </div>

      {phase !== 'outro' && (

        <button className="ll-demo-skip" onClick={finish} aria-label="Skip tutorial">

          SKIP DEMO ▸

        </button>

      )}

    </div>

  );

}


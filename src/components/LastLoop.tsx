import { useCallback, useEffect, useState } from 'react';
import { useTheLastLoop } from '../loop/useGame';
import { HUD } from '../loop/ui/HUD';
import { Hints, PauseMenu, ResetFlash, WinScreen, StoryPanels } from '../loop/ui/Overlays';
import { MobileControls } from '../loop/ui/MobileControls';
import { DemoMode } from '../loop/ui/DemoMode';
import { flushLoopSave, loadLoopSave, saveLoopSave, type LastLoopSave } from '../loop/services/save';
import '../loop/loop.css';

/**
 * THE LAST LOOP — Level 01. Canvas + HUD + overlays, driven by the pure
 * simulation in src/loop/core.
 *
 * Level 0: a skippable tutorial cinematic (DemoMode) plays first and hands
 * control to the real level. The level is paused while the demo is up, and
 * the demo can be replayed from the pause menu.
 */
export default function LastLoop({ onExit }: { onExit?(): void }): JSX.Element {
  const [save, setSave] = useState<LastLoopSave>(() => loadLoopSave());
  const changeSave = (next: LastLoopSave) => setSave(next);
  const game = useTheLastLoop(save, changeSave);
  const [touch, setTouch] = useState(false);
  const [demoOpen, setDemoOpen] = useState(true);

  // Keep the real level frozen behind the tutorial.
  useEffect(() => {
    if (demoOpen) game.setPaused(true);
  }, [demoOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeDemo = useCallback(() => {
    setDemoOpen(false);
    game.setPaused(false);
  }, [game]);

  useEffect(() => {
    setTouch(window.matchMedia('(pointer: coarse)').matches);
    const onHide = () => flushLoopSave();
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  const markTutorial = () => {
    if (!save.tutorialCompleted && game.hud.loop >= 3) {
      setSave(saveLoopSave((s) => ({ ...s, tutorialCompleted: true })));
    }
  };

  return (
    <div className="ll-root" onPointerDown={markTutorial}>
      <div className="ll-stage">
        <canvas ref={game.canvasRef} className="ll-canvas" />
        <HUD hud={game.hud} loopSeconds={game.loopSeconds} />
        <Hints loop={game.hud.loop} tutorialDone={save.tutorialCompleted} />
        <ResetFlash active={game.hud.phase === 'resetting'} />
        {game.paused && game.win === null && !demoOpen && (
          <PauseMenu
            music={save.settings.music}
            sfx={save.settings.sfx}
            onMusic={game.toggleMusic}
            onSfx={game.toggleSfx}
            onResume={() => game.setPaused(false)}
            onRestartLoop={() => {
              game.setPaused(false);
              game.restartLoop();
            }}
            onRestartLevel={() => {
              game.setPaused(false);
              game.restartLevel();
            }}
            onReplayTutorial={() => {
              game.setPaused(false);
              setDemoOpen(true);
            }}
          />
        )}
        {game.win && <WinScreen win={game.win} onReplay={game.restartLevel} />}
        {!game.win && game.panel !== 'none' && (
          <StoryPanels
            panel={game.panel}
            message={game.panelMessage}
            investigation={game.hud.investigation}
            onClose={game.closeStoryPanel}
            onTimeline={game.submitTimeline}
            onPlayRecording={game.playFinalRecording}
            onCode={game.submitCode}
          />
        )}
        <MobileControls visible={touch && !game.win && !game.paused && game.panel === 'none' && !demoOpen} pressDir={game.pressDir} pressInteract={game.pressInteract} onRestart={game.restartLoop} />
        <DevPanel loop={game.hud.loop} />
      </div>
      {onExit && !demoOpen && (
        <button className="ll-exit" onClick={onExit} aria-label="Back">
          ⌂
        </button>
      )}
      {demoOpen && <DemoMode onDone={closeDemo} />}
    </div>
  );
}

/** Developer diagnostics — visible only in dev builds. */
function DevPanel({ loop }: { loop: number }): JSX.Element | null {
  const [info, setInfo] = useState({ fps: 0 });
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      frames += 1;
      if (now - last >= 1000) {
        setInfo({ fps: Math.round((frames * 1000) / (now - last)) });
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  if (!import.meta.env.DEV) return null;
  return (
    <div className="ll-dev">
      FPS {info.fps} · LOOP {loop} · SIM HEADLESS-TESTED
    </div>
  );
}

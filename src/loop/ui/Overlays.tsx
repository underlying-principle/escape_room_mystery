import { useEffect, useState } from 'react';
import type { WinInfo } from '../useGame';

export function ResetFlash({ active }: { active: boolean }): JSX.Element | null {
  if (!active) return null;
  return (
    <div className="ll-reset-flash" aria-hidden>
      <span>LOOP RESETTING</span>
    </div>
  );
}

export function Hints({ loop, tutorialDone }: { loop: number; tutorialDone: boolean }): JSX.Element | null {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (tutorialDone) return;
    setBeat(0);
    const timers = [
      window.setTimeout(() => setBeat(1), 2000),
      window.setTimeout(() => setBeat(2), 6000),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [loop, tutorialDone]);
  if (tutorialDone) return null;
  if (loop === 1) {
    if (beat >= 2) return <div className="ll-hint">The room will reset.</div>;
    return <div className="ll-hint big">ESCAPE BEFORE THE LOOP ENDS.</div>;
  }
  if (loop === 2) return <div className="ll-hint big">That was you.</div>;
  if (loop === 3) return <div className="ll-hint big">Use your past self.</div>;
  return null;
}

export function PauseMenu({
  music,
  sfx,
  onMusic,
  onSfx,
  onResume,
  onRestartLoop,
  onRestartLevel,
  onReplayTutorial,
}: {
  music: boolean;
  sfx: boolean;
  onMusic(): void;
  onSfx(): void;
  onResume(): void;
  onRestartLoop(): void;
  onRestartLevel(): void;
  onReplayTutorial?(): void;
}): JSX.Element {
  return (
    <div className="ll-overlay">
      <div className="ll-menu">
        <h2>PAUSED</h2>
        <button className="ll-menu-btn primary" onClick={onResume}>
          RESUME
        </button>
        <div className="ll-menu-row">
          <button className={`ll-menu-btn${music ? ' on' : ''}`} onClick={onMusic}>
            ♫ MUSIC {music ? 'ON' : 'OFF'}
          </button>
          <button className={`ll-menu-btn${sfx ? ' on' : ''}`} onClick={onSfx}>
            🔊 SFX {sfx ? 'ON' : 'OFF'}
          </button>
        </div>
        <div className="ll-menu-row">
          <button className="ll-menu-btn" onClick={onRestartLoop}>
            ↻ RESTART LOOP
          </button>
          <button className="ll-menu-btn" onClick={onRestartLevel}>
            ✖ RESTART LEVEL
          </button>
        </div>
        {onReplayTutorial && (
          <button className="ll-menu-btn" onClick={onReplayTutorial}>
            ▶ REPLAY TUTORIAL
          </button>
        )}
      </div>
    </div>
  );
}

export function WinScreen({
  win,
  onReplay,
}: {
  win: WinInfo;
  onReplay(): void;
}): JSX.Element {
  const fmt = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
  return (
    <div className="ll-overlay win">
      <div className="ll-win">
        <small>SUBJECTIVE LOOP · LEVEL 01</small>
        <h1>THE LOOP BROKE</h1>
        <div className="ll-win-stats">
          <div>
            <small>LOOPS USED</small>
            <b>{String(win.loops).padStart(2, '0')}</b>
          </div>
          <div>
            <small>TIME</small>
            <b>{fmt(win.timeMs)}</b>
          </div>
          <div>
            <small>BEST</small>
            <b>{win.bestTimeMs === null ? '--:--' : fmt(win.bestTimeMs)}</b>
          </div>
        </div>
        <div className="ll-menu-row">
          {win.loops > 0 && (
            <button className="ll-menu-btn next" disabled title="The loop continues in the next chapter">
              NEXT
            </button>
          )}
          <button className="ll-menu-btn primary" onClick={onReplay}>
            ↻ REPLAY
          </button>
        </div>
      </div>
    </div>
  );
}


const TIMELINE = [
  ['arrival', 'ELIAS ARRIVES'],
  ['power', 'AUXILIARY POWER ACTIVATES'],
  ['mara', 'BADGE 07 ENTERS'],
  ['argument', 'ARGUMENT BEGINS'],
  ['crash', 'GLASS BREAKS'],
  ['death', 'INCIDENT AT 03:17'],
] as const;

interface StoryPanelsProps {
  panel: 'none' | 'note' | 'clock' | 'terminal' | 'cctv' | 'timeline' | 'recorder' | 'code';
  message: string | null;
  investigation: {
    note: boolean;
    clock: boolean;
    accessCard: boolean;
    terminal: boolean;
    cctv: boolean;
    badge07: boolean;
    suspectMara: boolean;
    timeline: boolean;
    recorder: boolean;
    finalRecording: boolean;
    exitCodeSolved: boolean;
  };
  onClose(): void;
  onTimeline(order: string[]): boolean;
  onPlayRecording(): void;
  onCode(code: string): boolean;
}

export function StoryPanels({
  panel,
  message,
  investigation,
  onClose,
  onTimeline,
  onPlayRecording,
  onCode,
}: StoryPanelsProps): JSX.Element | null {
  const [order, setOrder] = useState<string[]>([]);
  const [code, setCode] = useState('');

  useEffect(() => {
    setOrder([]);
    setCode('');
  }, [panel]);

  if (panel === 'none') return null;

  const selectTimeline = (id: string) => {
    setOrder((current) => current.includes(id) ? current : [...current, id]);
  };

  const title = panel === 'note'
    ? 'TORN NOTE'
    : panel === 'clock'
      ? 'THE STOPPED CLOCK'
      : panel === 'terminal'
    ? 'CASE 001'
    : panel === 'cctv'
      ? 'SECURITY CAMERA 01'
      : panel === 'timeline'
        ? 'INCIDENT RECONSTRUCTION'
        : panel === 'recorder'
          ? 'PRIVATE RECORDING'
          : 'EXIT AUTHORIZATION';

  return (
    <div className="ll-story-overlay" role="dialog" aria-modal="true">
      <div className="ll-story-panel">
        <button className="ll-story-close" onClick={onClose} aria-label="Close">×</button>
        <div className="ll-story-kicker">THE ROOM REMEMBERS · CASE 001</div>
        <h2>{title}</h2>

        {panel === 'note' && (
          <div className="ll-story-body">
            <div className="ll-evidence-paper">
              <div>03:17.</div>
              <div>He knew.</div>
              <div>He said the loop had already happened before.</div>
            </div>
            <p>The ink is still wet enough to smear. Someone wrote this shortly before the room reset.</p>
            <button className="ll-story-action" onClick={onClose}>PUT IT DOWN</button>
          </div>
        )}

        {panel === 'clock' && (
          <div className="ll-story-body">
            <div className="ll-clock-clue">03:17</div>
            <p>The second hand is frozen. Whatever happened here stopped this clock at the exact moment the incident occurred.</p>
            <button className="ll-story-action" onClick={onClose}>RETURN TO ROOM</button>
          </div>
        )}

        {panel === 'terminal' && (
          <div className="ll-story-body">
            <div className="ll-terminal-grid">
              <div><span>SUBJECT</span><b>ELIAS VANE</b></div>
              <div><span>STATUS</span><b className="danger">DECEASED</b></div>
              <div><span>TIME OF INCIDENT</span><b>03:17</b></div>
              <div><span>CAUSE</span><b>UNRESOLVED</b></div>
            </div>
            <p>Auxiliary access restored. One security recording remains.</p>
            <button className="ll-story-action" onClick={onClose}>RETURN TO ROOM</button>
          </div>
        )}

        {panel === 'cctv' && (
          <div className="ll-story-body">
            <div className="ll-cctv-screen">
              <div className="ll-cctv-scan" />
              <div className="ll-cctv-label">CAMERA 01 · 03:14–03:17</div>
              <div className="ll-cctv-fig figure-one" />
              <div className="ll-cctv-fig figure-two"><span>07</span></div>
              <div className="ll-cctv-crosshair" />
            </div>
            <p>Face unavailable. Badge identifier recovered: <strong>07</strong>.</p>
            <div className="ll-evidence-reveal">
              <span>BADGE 07</span>
              <b>MARA VOSS · INTERNAL SECURITY</b>
              <small>STATUS: ACTIVE · SUSPECT: UNCONFIRMED</small>
            </div>
            <button className="ll-story-action" onClick={onClose}>RETURN TO ROOM</button>
          </div>
        )}

        {panel === 'timeline' && (
          <div className="ll-story-body">
            <p>Put the recovered events in chronological order. Click each event once.</p>
            <div className="ll-timeline-order">
              {order.map((id, i) => (
                <div key={id} className="ll-timeline-chip">{i + 1}. {TIMELINE.find((x) => x[0] === id)?.[1]}</div>
              ))}
            </div>
            <div className="ll-timeline-grid">
              {TIMELINE.map(([id, label]) => {
                const disabled = order.includes(id);
                return (
                  <button key={id} className="ll-timeline-btn" disabled={disabled} onClick={() => selectTimeline(id)}>
                    {label}
                  </button>
                );
              })}
            </div>
            {message && <div className="ll-story-error">{message}</div>}
            <div className="ll-story-actions">
              <button className="ll-story-action secondary" onClick={() => setOrder([])}>CLEAR</button>
              <button className="ll-story-action" disabled={order.length !== TIMELINE.length} onClick={() => onTimeline(order)}>VERIFY RECONSTRUCTION</button>
            </div>
          </div>
        )}

        {panel === 'recorder' && (
          <div className="ll-story-body">
            <div className="ll-recorder">
              <div className="ll-rec-dot" />
              <span>ARCHIVE / PRIVATE / 03:17</span>
            </div>
            <p className="ll-recording-copy">
              <em>"If you're hearing this, the loop has already started again."</em>
              <br /><br />
              <em>"I don't know how many times you've watched this."</em>
              <br /><br />
              <strong>"Don't trust the person who opens the door."</strong>
            </p>
            <button className="ll-story-action" onClick={onPlayRecording}>END RECORDING</button>
          </div>
        )}

        {panel === 'code' && (
          <div className="ll-story-body">
            <p>EXIT AUTHORIZATION REQUIRED.</p>
            <div className="ll-code-display">{code.padEnd(4, '•')}</div>
            <div className="ll-keypad">
              {['1','2','3','4','5','6','7','8','9','C','0','⌫'].map((k) => (
                <button key={k} onClick={() => {
                  if (k === 'C') setCode('');
                  else if (k === '⌫') setCode((v) => v.slice(0, -1));
                  else if (code.length < 4) setCode((v) => v + k);
                }}>{k}</button>
              ))}
            </div>
            {message && <div className="ll-story-error">{message}</div>}
            <button className="ll-story-action" disabled={code.length !== 4} onClick={() => onCode(code)}>AUTHORIZE EXIT</button>
          </div>
        )}
      </div>
    </div>
  );
}

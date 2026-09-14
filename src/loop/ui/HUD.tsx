import type { HudSnapshot } from '../useGame';

const OBJECTIVE_TEXT: Record<string, string> = {
  findSwitch: 'FIND WHAT POWERS THE GLASS BOX',
  ghostHolding: 'YOUR PAST SELF HOLDS THE SWITCH — USE IT',
  getCard: 'RECOVER THE ACCESS CARD',
  inspectCase: 'ACCESS CASE 001',
  viewCctv: 'VIEW SECURITY FOOTAGE',
  reconstruct: 'RECONSTRUCT THE INCIDENT',
  findRecorder: 'FIND THE HIDDEN RECORDING',
  playRecording: 'PLAY THE PRIVATE RECORDING',
  useDoor: 'AUTHENTICATE THE EXIT',
  complete: 'THE LOOP BROKE',
};

function fmt(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function HUD({ hud, loopSeconds }: { hud: HudSnapshot; loopSeconds: number }): JSX.Element {
  const urgency = hud.remainingMs < 5000 ? ' strong' : hud.remainingMs < 10000 ? ' warn' : '';
  const dots: string[] = [];
  for (let i = 1; i < hud.loop; i++) dots.push(`○ ${String(i).padStart(2, '0')}`);
  return (
    <>
      <div className="ll-hud ll-title">THE LAST LOOP</div>
      <div className={`ll-hud ll-clock${urgency}`}>
        <span className="ll-loop">LOOP {String(hud.loop).padStart(2, '0')}</span>
        <span className="ll-timer">{fmt(hud.remainingMs)}</span>
      </div>
      <div className="ll-objective">{OBJECTIVE_TEXT[hud.objective] ?? OBJECTIVE_TEXT.findSwitch}</div>
      {hud.prompt && hud.panel === 'none' && <div className="ll-interact-prompt">{hud.prompt}</div>}
      {hud.ghosts > 0 && (
        <div className="ll-pastselves">
          {dots.map((d) => (
            <span key={d}>{d}</span>
          ))}
          <span className="you">● YOU</span>
        </div>
      )}
      {hud.remainingMs < 10000 && hud.phase === 'playing' && (
        <div className={`ll-warning${urgency}`}>
          {hud.remainingMs < 5000 ? 'LOOP COLLAPSING' : 'THE LOOP IS ENDING'}
        </div>
      )}
      {hud.hasCard && (
        <div className="ll-card">
          <span className="card-glyph" /> ACCESS CARD
        </div>
      )}
      <div className="ll-controls-hint" data-seconds={loopSeconds !== 60 || undefined}>
        WASD MOVE · E INTERACT · R RESTART LOOP
      </div>
    </>
  );
}

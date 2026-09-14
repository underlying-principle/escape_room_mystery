export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function HUD({
  level,
  moves,
  optimal,
  elapsedMs,
  timeLabel,
  critical,
  worldName,
  onHome,
  onRestart,
  muted,
  onToggleMuted,
}: {
  level: number;
  moves: number;
  optimal: number;
  elapsedMs: number;
  /** Overrides the default count-up clock (used by the cube's countdown). */
  timeLabel?: string;
  critical?: boolean;
  worldName: string;
  onHome(): void;
  onRestart(): void;
  muted: boolean;
  onToggleMuted(): void;
}) {
  return (
    <header className="hud">
      <button className="icon-btn" onClick={onHome} aria-label="Back to level map">⌂</button>
      <div className="hud-level">
        <small>LEVEL {String(level).padStart(2, '0')}</small>
        <strong>{worldName}</strong>
      </div>
      <div className="hud-stat"><small>MOVES</small><b>{moves}<i>/{optimal}</i></b></div>
      <div className={`hud-stat ${critical ? 'critical' : ''}`}><small>TIME</small><b>{timeLabel ?? formatTime(elapsedMs)}</b></div>
      <button className="icon-btn" onClick={onRestart} aria-label="Restart level">↻</button>
      <button className="icon-btn" onClick={onToggleMuted} aria-label={muted ? 'Turn sound on' : 'Mute sound'}>{muted ? '◌' : '♪'}</button>
    </header>
  );
}

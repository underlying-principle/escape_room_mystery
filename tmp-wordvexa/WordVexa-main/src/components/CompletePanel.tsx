import { formatTime } from './HUD';

export function CompletePanel({
  levelName,
  stars,
  moves,
  optimal,
  elapsedMs,
  hasNext,
  onNext,
  onReplay,
  onMap,
}: {
  levelName: string;
  stars: 1 | 2 | 3;
  moves: number;
  optimal: number;
  elapsedMs: number;
  hasNext: boolean;
  onNext(): void;
  onReplay(): void;
  onMap(): void;
}) {
  return (
    <div className="modal-backdrop">
      <section className="complete-panel screen-enter" role="dialog" aria-label="Level complete">
        <small>{levelName.toUpperCase()} · SIGNAL STABILIZED</small>
        <h2 className="title-card shake">LEVEL FINISHED</h2>
        <div className="result-stars" aria-label={`${stars} stars`}>
          {[1, 2, 3].map((n) => <span key={n} className={n <= stars ? 'earned' : ''}>★</span>)}
        </div>
        <div className="result-grid">
          <div>
            <small>TIME</small>
            <b className="time-big">{formatTime(elapsedMs)}</b>
            <span>ON THE CLOCK</span>
          </div>
          <div>
            <small>MOVES</small>
            <b>{moves}</b>
            <span>OPTIMAL {optimal}</span>
          </div>
        </div>
        <p>{stars === 3 ? 'PERFECT ROUTE' : stars === 2 ? 'EFFICIENT ROUTE' : 'ROUTE COMPLETE'}</p>
        <button className="primary" onClick={hasNext ? onNext : onMap}>{hasNext ? 'NEXT SIGNAL' : 'LEVEL MAP'} <span>→</span></button>
        <div className="modal-actions">
          <button onClick={onReplay}>↻ REPLAY</button>
          <button onClick={onMap}>⌂ LEVEL MAP</button>
        </div>
      </section>
    </div>
  );
}

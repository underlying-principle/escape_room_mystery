import type { LevelData } from '../engine/types';
import { isLevelUnlocked, totalStars, type ProgressData } from '../engine/progressManager';
import { allWorlds, worldColor, worldName } from '../engine/levelManager';

export function LevelMap({
  levels,
  progress,
  onPlay,
}: {
  levels: LevelData[];
  progress: ProgressData;
  onPlay(index: number): void;
}) {
  return (
    <main className="level-map screen-enter">
      <div className="brand-lockup">
        <span className="brand-kicker">NEURAL LEXICON ONLINE</span>
        <h1>WORD<span>SHIFT</span></h1>
        <p>You aren't guessing words. You are manipulating words.</p>
      </div>
      <div className="worlds">
        {allWorlds(levels).map((world) => {
          const worldLevels = levels.map((l, i) => ({ l, i })).filter((x) => x.l.world === world);
          const tag =
            world === 1
              ? 'TRANSFORM'
              : world === 2
                ? 'LOCK / BREAK'
                : world === 3
                  ? 'LINK / REACT'
                  : world === 4
                    ? 'DIVE / SURVIVE'
                    : world === 5
                      ? 'DEFY / REACT'
                      : 'COLLAPSE / ASCEND';
          return (
            <section className="world-card" key={world} style={{ '--world': worldColor(world) } as React.CSSProperties}>
              <header>
                <div><small>WORLD 0{world}</small><h2>{worldName(world)}</h2></div>
                <span>{tag}</span>
              </header>
              <div className="level-nodes">
                {worldLevels.map(({ l, i }) => {
                  const unlocked = isLevelUnlocked(levels, i, progress);
                  const record = progress.records[l.id];
                  return (
                    <button
                      key={l.id}
                      className={`level-node ${record ? 'complete' : ''}`}
                      disabled={!unlocked}
                      onClick={() => onPlay(i)}
                      aria-label={`Level ${l.id} ${l.name}${unlocked ? '' : ', locked'}`}
                    >
                      <b>{String(i + 1).padStart(2, '0')}</b>
                      <span>{!unlocked ? '⌁' : record ? '★'.repeat(record.stars) : '○'}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <footer className="map-footer">
        <span><b>{Object.keys(progress.records).length}</b>/{levels.length} SIGNALS STABILIZED</span>
        <span><b>{totalStars(progress)}</b>/{levels.length * 3} STARS</span>
        <span>BUILD 0.1 · BASIC LAUNCH</span>
      </footer>
    </main>
  );
}

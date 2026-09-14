import { useEffect, useMemo, useState } from 'react';
import { parseGraphJson, type WordGraph } from './engine/wordGraph';
import { loadLevelPack } from './engine/levelManager';
import {
  loadProgress,
  recordCompletion,
  saveProgress,
  type ProgressData,
} from './engine/progressManager';
import type { LevelData } from './engine/types';
import { LevelMap } from './components/LevelMap';
import { GameScreen, type CompletionData } from './components/GameScreen';
import { SoundManager } from './audio/sound';

interface Assets {
  levels: LevelData[];
  graph: WordGraph;
}

export default function App() {
  const [assets, setAssets] = useState<Assets | null>(null);
  const [error, setError] = useState('');
  const [screen, setScreen] = useState<'map' | 'game'>('map');
  const [levelIndex, setLevelIndex] = useState(0);
  const [progress, setProgress] = useState<ProgressData>(() => loadProgress());
  const sound = useMemo(() => new SoundManager(progress.muted), []);

  useEffect(() => {
    Promise.all([
      loadLevelPack(),
      fetch('./data/wordGraphCache.json').then((r) => {
        if (!r.ok) throw new Error(`Could not load word graph (${r.status})`);
        return r.json();
      }),
    ])
      .then(([pack, graphJson]) => setAssets({ levels: pack.levels, graph: parseGraphJson(graphJson) }))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Asset load failed'));
    return () => sound.dispose();
  }, []);

  const toggleMuted = () => {
    const muted = !progress.muted;
    sound.muted = muted;
    const next = { ...progress, muted };
    setProgress(next);
    saveProgress(next);
  };

  const play = (index: number) => {
    setLevelIndex(index);
    setScreen('game');
    const next = { ...progress, lastLevelId: assets?.levels[index]?.id ?? progress.lastLevelId };
    setProgress(next);
    saveProgress(next);
  };

  const complete = (data: CompletionData) => {
    if (!assets) return;
    const level = assets.levels[levelIndex];
    setProgress((p) => recordCompletion(p, level.id, data.stars, data.moves, data.elapsedMs, data.hintsUsed));
  };

  if (error) {
    return <div className="fatal"><h1>WORDSHIFT</h1><p>SIGNAL LOST</p><code>{error}</code><button onClick={() => location.reload()}>RECONNECT</button></div>;
  }
  if (!assets) {
    return <div className="loading"><div className="loading-logo">WORD<span>SHIFT</span></div><p>CALIBRATING LEXICON</p><i /></div>;
  }

  return (
    <div className="app-shell">
      <div className="scanlines" />
      {screen === 'map' ? (
        <LevelMap levels={assets.levels} progress={progress} onPlay={play} />
      ) : (
        <GameScreen
          key={assets.levels[levelIndex].id}
          level={assets.levels[levelIndex]}
          index={levelIndex}
          graph={assets.graph}
          sound={sound}
          muted={progress.muted}
          onToggleMuted={toggleMuted}
          onHome={() => setScreen('map')}
          onNext={() => levelIndex + 1 < assets.levels.length ? play(levelIndex + 1) : setScreen('map')}
          onComplete={complete}
          hasNext={levelIndex + 1 < assets.levels.length}
        />
      )}
    </div>
  );
}

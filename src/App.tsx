import { useEffect, useState } from 'react';
import LastLoop from './components/LastLoop';
import SignalMap from './components/SignalMap';
import { initCrazyGames } from './loop/services/crazygames';
import { flushLoopSave, loadLoopSave } from './loop/services/save';
import { loadSave } from './services/saveService';

/**
 * THE LAST LOOP — direct to Level 01 (CrazyGames direct-to-gameplay).
 * The Signal map remains reachable from the in-game home button.
 */
export default function App() {
  // Warm the save + SDK during first paint.
  const [booted] = useState(() => {
    loadLoopSave();
    loadSave(); // Signal save — powers the map's stars/unlocks
    void initCrazyGames();
    return true;
  });
  const [screen, setScreen] = useState<'game' | 'map'>('game');
  const [mapSave] = useState(() => loadSave());

  useEffect(() => {
    const onHide = () => flushLoopSave();
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  if (!booted) return null;

  return (
    <div className="app-shell">
      <div className="scanlines" />
      {screen === 'game' ? (
        <LastLoop onExit={() => setScreen('map')} />
      ) : (
        <>
          <SignalMap save={mapSave} />
          <button className="map-return" onClick={() => setScreen('game')}>
            ▶ LEVEL 01
          </button>
        </>
      )}
    </div>
  );
}

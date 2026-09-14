/**
 * THE SIGNAL — CrazyGames SDK wrapper.
 *
 * Every call degrades gracefully when the SDK is absent (local dev, Basic
 * Launch, adblock, guest). No gameplay path may depend on this module
 * succeeding. The SDK script itself is injected by the CrazyGames portal —
 * we never bundle or hard-require it.
 */

import { flushSave } from './saveService';

let ready = false;

export async function init(): Promise<void> {
  try {
    await window.CrazyGames?.SDK?.init();
    ready = true;
  } catch {
    ready = false; // SDK unavailable — everything degrades to local behavior
  }
}

export function gameplayStart(): void {
  try {
    if (ready) window.CrazyGames?.SDK?.game?.gameplayStart();
  } catch {
    /* no-op */
  }
}

export function gameplayStop(): void {
  try {
    if (ready) window.CrazyGames?.SDK?.game?.gameplayStop();
    flushSave(); // leaving gameplay is a natural checkpoint moment
  } catch {
    /* no-op */
  }
}

export function happytime(): void {
  try {
    if (ready) window.CrazyGames?.SDK?.game?.happytime();
  } catch {
    /* no-op */
  }
}

/**
 * Rewarded/midgame ad request. Resolves false when ads are unavailable —
 * callers must always provide a non-ad fallback path.
 */
export function requestAd(type: 'midgame' | 'rewarded'): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (!ready || !window.CrazyGames?.SDK?.ad) {
        resolve(false);
        return;
      }
      window.CrazyGames.SDK.ad.requestAd(type, {
        adFinished: () => resolve(true),
        adError: () => resolve(false),
        adStarted: () => undefined,
      });
    } catch {
      resolve(false);
    }
  });
}

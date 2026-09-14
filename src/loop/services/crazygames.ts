/**
 * THE LAST LOOP — CrazyGames SDK v3 integration.
 *
 * The official v3 script is loaded explicitly; every call degrades to a
 * no-op when the SDK or the portal is unavailable (local dev, adblock).
 * Game logic never touches the SDK directly — only through this service.
 */

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

interface CrazyGamesSDK {
  init(): Promise<void>;
  game?: {
    gameplayStart(): void;
    gameplayStop(): void;
    happytime(): void;
  };
  ad?: {
    requestAd(type: 'midgame' | 'rewarded', callbacks?: Record<string, () => void>): void;
  };
  data?: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
  };
}

declare global {
  interface Window {
    CrazyGames?: { SDK?: CrazyGamesSDK };
  }
}

let ready = false;
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.CrazyGames?.SDK) return Promise.resolve();
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => resolve(); // unavailable — everything degrades
    document.head.appendChild(script);
  });
}

export async function initCrazyGames(): Promise<boolean> {
  if (ready) return true;
  if (!loading) {
    loading = (async () => {
      await loadScript();
      try {
        await window.CrazyGames?.SDK?.init();
        ready = true;
      } catch {
        ready = false;
      }
    })();
  }
  await loading;
  return ready;
}

export function isCrazyGamesReady(): boolean {
  return ready;
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

/** Rewarded video — resolves true only after the ad finished. Future use. */
export function requestRewardedAd(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (!ready || !window.CrazyGames?.SDK?.ad) {
        resolve(false);
        return;
      }
      window.CrazyGames.SDK.ad.requestAd('rewarded', {
        adFinished: () => resolve(true),
        adError: () => resolve(false),
        adStarted: () => undefined,
      });
    } catch {
      resolve(false);
    }
  });
}

export async function getCrazyGamesData(key: string): Promise<string | null> {
  try {
    if (!ready) return null;
    return (await window.CrazyGames?.SDK?.data?.getItem(key)) ?? null;
  } catch {
    return null;
  }
}

export async function setCrazyGamesData(key: string, value: string): Promise<void> {
  try {
    if (!ready) return;
    await window.CrazyGames?.SDK?.data?.setItem(key, value);
  } catch {
    /* no-op */
  }
}

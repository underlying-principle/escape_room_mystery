import { useEffect, useMemo, useRef, useState } from 'react';
import { freeSpinWaitMs, saveNow, type SignalSave } from '../services/saveService';
import { happytime, requestAd } from '../services/crazyGamesService';
import { t } from '../i18n';

/**
 * DAILY SPIN WHEEL — a globally mounted top-left crystal chip that opens the
 * spin wheel. One free spin matures every 24h from the last free spin; extra
 * spins come from CrazyGames rewarded video (the film icon on the SPIN
 * button). Prizes are crystals, tracked in the save.
 */

const PRIZES = [5, 10, 25, 50, 75, 100, 250, 500];
// 500 is the jackpot — rare. Weights sum arbitrarily.
const WEIGHTS = [22, 20, 18, 14, 12, 8, 4, 2];
const SEGMENT_ANGLE = 360 / PRIZES.length;
const SPIN_MS = 4400;

function pickPrizeIndex(): number {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < WEIGHTS.length; i++) {
    roll -= WEIGHTS[i];
    if (roll < 0) return i;
  }
  return 0;
}

function formatCountdown(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** Faceted blue crystal, drawn once as SVG and reused everywhere. */
function Crystal({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <polygon points="16,1 27,10 30,16 27,26 16,31 5,26 2,16 5,10" fill="#0e6fd8" />
      <polygon points="16,1 27,10 16,13" fill="#4fb2ff" />
      <polygon points="16,1 5,10 16,13" fill="#8fd4ff" />
      <polygon points="5,10 2,16 12,20 16,13" fill="#2f8fef" />
      <polygon points="27,10 30,16 20,20 16,13" fill="#1a76e0" />
      <polygon points="2,16 5,26 12,20" fill="#1668c8" />
      <polygon points="30,16 27,26 20,20" fill="#0c50a8" />
      <polygon points="12,20 16,31 20,20" fill="#1f7fe8" />
      <polygon points="5,26 16,31 12,20" fill="#0a4a98" />
      <polygon points="27,26 16,31 20,20" fill="#12509f" />
      <polygon points="12,20 20,20 16,13" fill="#63c2ff" />
      <polygon points="14,4 18,4 17,8 15,8" fill="#e8f7ff" opacity="0.9" />
    </svg>
  );
}

export default function SpinWheel({
  save,
  onChange,
}: {
  save: SignalSave;
  onChange(next: SignalSave): void;
}) {
  const [open, setOpen] = useState<boolean>(false);
  const [rotation, setRotation] = useState<number>(0);
  const [spinning, setSpinning] = useState<boolean>(false);
  const [adLoading, setAdLoading] = useState<boolean>(false);
  const [winner, setWinner] = useState<number | null>(null);
  const [message, setMessage] = useState<string>('');
  const [, setTick] = useState<number>(0);
  const rotationRef = useRef<number>(0);
  rotationRef.current = rotation;
  const messageTimer = useRef<number>(0);
  // Each rim bulb sparks on its own random clock — never in sync.
  const bulbSparks = useMemo(
    () =>
      Array.from({ length: 12 }, () => ({
        delay: -(Math.random() * 4.5),
        duration: 2.2 + Math.random() * 2.8,
      })),
    [],
  );

  const waitMs = freeSpinWaitMs(save.spin.lastFreeSpinAt);
  const canSpin = !spinning && (waitMs === 0 || save.spin.bonusSpins > 0);

  // Keep the countdown alive while the modal is open and spins are spent.
  useEffect(() => {
    if (!open || canSpin) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [open, canSpin]);

  const flash = (text: string) => {
    setMessage(text);
    window.clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(() => setMessage(''), 2600);
  };

  const spin = () => {
    if (!canSpin) return;
    setWinner(null);
    setSpinning(true);
    onChange(
      saveNow((s) => ({
        ...s,
        spin:
          freeSpinWaitMs(s.spin.lastFreeSpinAt) === 0
            ? { ...s.spin, lastFreeSpinAt: Date.now() }
            : { ...s.spin, bonusSpins: s.spin.bonusSpins - 1 },
      })),
    );
    const index = pickPrizeIndex();
    // Land with the winning slice under the top pointer.
    const target = 5 * 360 + (360 - index * SEGMENT_ANGLE - SEGMENT_ANGLE / 2) - (rotationRef.current % 360);
    setRotation((r) => r + target);
    window.setTimeout(() => {
      const prize = PRIZES[index];
      onChange(saveNow((s) => ({ ...s, spin: { ...s.spin, crystals: s.spin.crystals + prize } })));
      setSpinning(false);
      setWinner(index);
      happytime();
      flash(t('won', { n: prize }));
    }, SPIN_MS + 150);
  };

  const watchAdForSpin = async () => {
    if (adLoading || spinning) return;
    setAdLoading(true);
    // Rewarded video — resolves true only after the ad finished playing.
    const ok = await requestAd('rewarded');
    setAdLoading(false);
    if (ok) {
      onChange(saveNow((s) => ({ ...s, spin: { ...s.spin, bonusSpins: Math.min(99, s.spin.bonusSpins + 1) } })));
      flash(t('spinEarned'));
    } else {
      flash(t('adUnavailable'));
    }
  };

  return (
    <>
      <button className="crystal-chip" onClick={() => setOpen(true)} aria-label={`Crystals: ${save.spin.crystals}. Open the daily spin wheel`}>
        <Crystal size={24} />
        <b>{save.spin.crystals}</b>
        <span className="chip-plus">+</span>
      </button>

      {open && (
        <div className="spin-backdrop" onClick={() => !spinning && setOpen(false)}>
          <section className="spin-panel" role="dialog" aria-label="Daily spin wheel" onClick={(e) => e.stopPropagation()}>
            <button className="spin-close" onClick={() => !spinning && setOpen(false)} aria-label="Close spin wheel">
              ✕
            </button>
            <small className="spin-kicker">{t('dailyWheel')}</small>

            <div className={`spin-rig${spinning ? ' spinning' : ''}`}>
              <div className="spin-rim">
                {bulbSparks.map((b, i) => (
                  <i
                    key={i}
                    className="spin-bulb"
                    style={{
                      transform: `rotate(${i * 30}deg) translateY(-172px)`,
                      animationDelay: `${b.delay}s`,
                      animationDuration: `${b.duration}s`,
                    }}
                  />
                ))}
              </div>
              <div className="spin-disc" style={{ transform: `rotate(${rotation}deg)` }}>
                {PRIZES.map((prize, i) => (
                  <div
                    key={prize}
                    className={`spin-slice${winner === i ? ' won' : ''}`}
                    style={{ transform: `rotate(${i * SEGMENT_ANGLE + SEGMENT_ANGLE / 2}deg)` }}
                  >
                    <div className="spin-slice-inner">
                      <Crystal size={36} />
                      <b>{prize}</b>
                    </div>
                  </div>
                ))}
                <div className="spin-gloss" />
              </div>
              <div className="spin-pointer" />
              <div className="spin-hub" />
            </div>

            <div className="spin-dots" aria-hidden>
              {Array.from({ length: 7 }, (_, d) => {
                const available = Math.min(7, save.spin.bonusSpins + (waitMs === 0 ? 1 : 0));
                return <i key={d} className={d < available ? 'lit' : ''} />;
              })}
            </div>

            <div className="spin-actions">
              <div className="spin-pill">
                <button className="spin-button" onClick={spin} disabled={!canSpin}>
                  {spinning ? t('spinning') : t('spin')}
                </button>
                <button
                  className="spin-ad-button"
                  onClick={() => void watchAdForSpin()}
                  disabled={adLoading || spinning}
                  aria-label="Watch a video for one extra spin"
                >
                  <span className="spin-ad-icon">🎬</span>
                  {save.spin.bonusSpins > 0 && <span className="spin-ad-badge">{save.spin.bonusSpins}</span>}
                </button>
              </div>
            </div>

            <p className={`spin-status${waitMs > 0 && save.spin.bonusSpins === 0 ? ' waiting' : ''}`}>
              {spinning
                ? '…'
                : waitMs === 0
                  ? t('freeReady')
                  : save.spin.bonusSpins > 0
                    ? t('bonusLeft', { n: save.spin.bonusSpins, en: save.spin.bonusSpins === 1 ? '' : 'S', t: formatCountdown(waitMs) })
                    : t('nextFreeIn', { t: formatCountdown(waitMs) }) }
            </p>
            {message && <p className="spin-message">{message}</p>}
          </section>
        </div>
      )}
    </>
  );
}

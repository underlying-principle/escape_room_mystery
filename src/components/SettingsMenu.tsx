import { useState } from 'react';
import { resetProgress, saveNow, type SignalSave } from '../services/saveService';
import { LANGUAGES, t } from '../i18n';
import type { SoundManager } from '../audio/sound';

/**
 * SETTINGS — globally mounted gear (top-right). Every button does exactly
 * what it says: Music toggles the ambient pad, Sound toggles SFX, Language
 * switches the whole UI language, Delete wipes the save (with confirm),
 * Credits and Help open their panels, Game speed scales the level countdown,
 * Restart remounts the current level, To menu returns to the map, Official
 * opens the game's official panel.
 */

const SPEEDS = [1, 1.25, 1.5];

type SubView = null | 'language' | 'credits' | 'help' | 'official' | 'delete';

export default function SettingsMenu({
  save,
  onChange,
  sound,
}: {
  save: SignalSave;
  onChange(next: SignalSave): void;
  sound: SoundManager;
}) {
  const [open, setOpen] = useState<boolean>(false);
  const [sub, setSub] = useState<SubView>(null);

  const close = () => {
    setOpen(false);
    setSub(null);
  };

  const toggleMusic = () => {
    const on = !save.settings.music;
    sound.setMusic(on);
    onChange(saveNow((s) => ({ ...s, settings: { ...s.settings, music: on } })));
  };

  const toggleSound = () => {
    const muted = !save.settings.muted;
    sound.muted = muted;
    onChange(saveNow((s) => ({ ...s, settings: { ...s.settings, muted } })));
  };

  const setLanguage = (code: string) => {
    onChange(saveNow((s) => ({ ...s, settings: { ...s.settings, language: code } })));
  };

  const setSpeed = (speed: number) => {
    onChange(saveNow((s) => ({ ...s, settings: { ...s.settings, gameSpeed: speed } })));
  };

  const wipeSave = () => {
    resetProgress();
    window.location.reload();
  };

  const tile = (label: string, glyph: string, action: () => void, active?: boolean) => (
    <button key={label} className="set-tile" onClick={action}>
      <span className={`set-glyph${active ? ' on' : ''}`}>{glyph}</span>
      <small>{label}</small>
    </button>
  );

  return (
    <>
      <button className="gear-button" onClick={() => setOpen(true)} aria-label="Open settings">
        ⚙
      </button>

      {open && (
        <div className="set-backdrop" onClick={close}>
          <section className="set-panel" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
            <button className="set-close" onClick={close} aria-label="Close settings">
              ✕
            </button>

            {sub === null && (
              <>
                <h2 className="set-title">{t('settings')}</h2>
                <div className="set-grid">
                  {tile(t('music'), save.settings.music ? '♫' : '♪̶', toggleMusic, save.settings.music)}
                  {tile(t('sound'), save.settings.muted ? '🔇' : '🔊', toggleSound, !save.settings.muted)}
                  {tile(t('language'), '文A', () => setSub('language'))}
                  {tile(t('delete'), '✖', () => setSub('delete'))}
                  {tile(t('credits'), '©', () => setSub('credits'))}
                  {tile(t('help'), '?', () => setSub('help'))}
                </div>

                <div className="set-speed">
                  <small>{t('gameSpeed')}</small>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={1}
                    value={SPEEDS.indexOf(save.settings.gameSpeed)}
                    onChange={(e) => setSpeed(SPEEDS[Number(e.target.value)])}
                    aria-label={t('gameSpeed')}
                  />
                  <div className="set-speed-labels">
                    {SPEEDS.map((s) => (
                      <span key={s} className={save.settings.gameSpeed === s ? 'on' : ''}>
                        x{s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="set-row">
                  <button className="set-action official" onClick={() => setSub('official')}>
                    {t('official')}
                  </button>
                </div>

                <span className="set-version">ver: 0.0.1</span>
              </>
            )}

            {sub === 'language' && (
              <Sub title={t('language')} onBack={() => setSub(null)}>
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    className={`set-line${save.settings.language === l.code ? ' on' : ''}`}
                    onClick={() => setLanguage(l.code)}
                  >
                    {l.flag} {l.label}
                    {save.settings.language === l.code && <i>{t('active')}</i>}
                  </button>
                ))}
              </Sub>
            )}

            {sub === 'credits' && (
              <Sub title={t('credits')} onBack={() => setSub(null)}>
                <p className="set-prose">
                  <b>{t('creditsBody')}</b>
                  <br />
                  {t('creditsBy')}
                  <br />
                  {t('creditsTech')}
                  <br />
                  {t('creditsPublish')}
                </p>
              </Sub>
            )}

            {sub === 'help' && (
              <Sub title={t('help')} onBack={() => setSub(null)}>
                <p className="set-prose">
                  {t('helpSwap')}
                  <br />
                  {t('helpDrag')}
                  <br />
                  {t('helpStars')}
                  <br />
                  {t('helpSpin')}
                  <br />
                  {t('helpWeapons')}
                </p>
              </Sub>
            )}

            {sub === 'official' && (
              <Sub title={t('official')} onBack={() => setSub(null)}>
                <p className="set-prose">
                  <b>{t('officialBody')}</b>
                  <br />
                  {t('officialWhere')}
                </p>
                <a className="set-line on" href="https://www.crazygames.com" target="_blank" rel="noreferrer">
                  🌐 crazygames.com <i>{t('officialOpen')}</i>
                </a>
              </Sub>
            )}

            {sub === 'delete' && (
              <Sub title={t('deleteTitle')} onBack={() => setSub(null)}>
                <p className="set-prose">{t('deleteWarn')}</p>
                <div className="set-row">
                  <button className="set-action danger" onClick={wipeSave}>
                    {t('deleteEverything')}
                  </button>
                  <button className="set-action" onClick={() => setSub(null)}>
                    {t('keepSave')}
                  </button>
                </div>
              </Sub>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function Sub({ title, onBack, children }: { title: string; onBack(): void; children: React.ReactNode }) {
  return (
    <div className="set-sub">
      <h2 className="set-title">{title}</h2>
      <div className="set-sub-body">{children}</div>
      <button className="set-action" onClick={onBack}>
        {t('back')}
      </button>
    </div>
  );
}

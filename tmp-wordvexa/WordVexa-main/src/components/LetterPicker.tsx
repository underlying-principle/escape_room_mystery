const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function LetterPicker({
  visible,
  current,
  wildcard,
  onPick,
  onClose,
}: {
  visible: boolean;
  current: string;
  wildcard: boolean;
  onPick(letter: string): void;
  onClose(): void;
}) {
  if (!visible) return null;
  return (
    <div className="letter-panel" role="dialog" aria-label="Choose a replacement letter">
      <div className="letter-panel-head">
        <span>{wildcard ? '◆ WILDCARD — BREAK THIS LOCK' : 'SELECT REPLACEMENT'}</span>
        <button onClick={onClose} aria-label="Close letter picker">×</button>
      </div>
      <div className="letter-grid">
        {LETTERS.map((letter) => (
          <button
            key={letter}
            className={letter.toLowerCase() === current ? 'current' : ''}
            disabled={letter.toLowerCase() === current}
            onClick={() => onPick(letter.toLowerCase())}
          >
            {letter}
          </button>
        ))}
      </div>
      <small className="keyboard-note">Keyboard input works too · ESC to close</small>
    </div>
  );
}

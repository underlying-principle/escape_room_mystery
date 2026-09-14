import type { PointerEvent as ReactPointerEvent } from 'react';
import type { InputState } from '../core/types';

/**
 * Mobile controls: a simple directional pad plus a large INTERACT button.
 * Rendered only for coarse pointers; wired through pressDir/pressInteract.
 */
export function MobileControls({
  visible,
  pressDir,
  pressInteract,
  onRestart,
}: {
  visible: boolean;
  pressDir(dir: keyof InputState, on: boolean): void;
  pressInteract(): void;
  onRestart(): void;
}): JSX.Element | null {
  if (!visible) return null;
  const bind = (dir: keyof InputState) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      pressDir(dir, true);
    },
    onPointerUp: () => pressDir(dir, false),
    onPointerLeave: () => pressDir(dir, false),
    onPointerCancel: () => pressDir(dir, false),
  });
  return (
    <div className="ll-mobile" aria-hidden={false}>
      <div className="ll-dpad">
        <button type="button" className="ll-pad up" {...bind('up')} aria-label="Move up">
          ▲
        </button>
        <button type="button" className="ll-pad left" {...bind('left')} aria-label="Move left">
          ◀
        </button>
        <button type="button" className="ll-pad right" {...bind('right')} aria-label="Move right">
          ▶
        </button>
        <button type="button" className="ll-pad down" {...bind('down')} aria-label="Move down">
          ▼
        </button>
      </div>
      <div className="ll-actions">
        <button type="button" className="ll-pad interact" onPointerDown={(e: ReactPointerEvent<HTMLButtonElement>) => { e.preventDefault(); pressInteract(); }} aria-label="Interact">
          E
        </button>
        <button type="button" className="ll-pad small" onPointerDown={(e: ReactPointerEvent<HTMLButtonElement>) => { e.preventDefault(); onRestart(); }} aria-label="Restart loop">
          ↻
        </button>
      </div>
    </div>
  );
}

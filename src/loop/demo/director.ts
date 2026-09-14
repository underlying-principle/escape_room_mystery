
/**

 * THE LAST LOOP — Level 0 (tutorial) director.

 *

 * The tutorial is not a cartoon: a scripted "player" drives the REAL Level 01

 * simulation through its first two loops — same renderer, same panels, same

 * rules — while cinematic captions explain what is happening. Deterministic

 * (no randomness) so the whole script is covered by a headless test.

 *

 * The director is pure: it owns no DOM, audio, or React state. Call

 * `tick(dtMs)` from a rAF loop; it returns the sim events for that frame.

 */

import {

  CORRECT_TIMELINE,

  closePanel,

  markRecorderPlayed,

  queueInteract,

  step,

  submitExitCode,

  submitTimelineOrder,

} from '../core/simulation';

import type { GameEvent, InputState, LoopState } from '../core/types';

export interface DemoCaption {

  id: number;

  title?: string;

  text?: string;

  keys?: string[];

}

export type DemoOut =

  | { type: 'caption'; cap: DemoCaption }

  | { type: 'clearCaption' }

  | { type: 'outro' }

  | { type: 'error'; message: string };

type Step =

  | { k: 'cap'; title?: string; text?: string; keys?: string[]; holdMs: number }

  | { k: 'speed'; v: number }

  | { k: 'walk'; route: ReadonlyArray<readonly [number, number]> }

  | { k: 'e'; holdMs?: number } // press E; holdMs > 0 → auto-close the panel it opens

  | { k: 'submit'; what: 'timeline' | 'code' | 'recorder' } // panel must already be open

  | { k: 'untilReset' }

  | { k: 'untilBox' }

  | { k: 'untilDoor' }

  | { k: 'untilComplete' }

  | { k: 'outro' };

/**

 * The script. Corridors are L-shaped so no leg clips furniture:

 * bottom lane y≈620, top lane y≈400, side gaps at x≈780 / x≈1100.

 */

const SCRIPT: Step[] = [

  // --- COLD OPEN ---------------------------------------------------------

  { k: 'cap', title: 'CASE 001 — ELIAS VANE', text: 'You will live the same 60 seconds over and over. Until you get out.', holdMs: 3800 },

  { k: 'cap', title: 'HOW TO PLAY', text: 'A short demo. Skip it any time — top right.', holdMs: 2400 },

  // --- MOVEMENT ----------------------------------------------------------

  { k: 'cap', title: 'MOVE', text: 'WASD or the arrow keys. Get to the glass box.', keys: ['W', 'A', 'S', 'D', '←', '↑', '↓', '→'], holdMs: 1800 },

  { k: 'walk', route: [[640, 620]] },

  // --- THE SWITCH (the first E — and the heart of the game) -------------

  { k: 'cap', title: 'USE IT', text: 'Press E to use what is in front of you.', keys: ['E'], holdMs: 1500 },

  { k: 'e' },

  { k: 'cap', title: 'AUXILIARY POWER', text: 'Your actions are recorded. Remember this moment.', holdMs: 2600 },

  // --- THE NOTE ----------------------------------------------------------

  { k: 'cap', title: 'SEARCH THE ROOM', text: 'E reads the torn note on the desk.', keys: ['E'], holdMs: 1600 },

  { k: 'walk', route: [[215, 620]] },

  { k: 'e', holdMs: 3000 },

  // --- THE CLOCK ---------------------------------------------------------

  { k: 'cap', title: 'THE CLOCK', text: 'Some objects hold the story.', holdMs: 1600 },

  { k: 'walk', route: [[1100, 620], [1100, 400]] },

  { k: 'e', holdMs: 3000 },

  // --- TIME RUNS OUT (fast-forward) --------------------------------------

  { k: 'cap', title: 'THE TIMER NEVER STOPS', text: 'Watch what happens when it dies.', holdMs: 2400 },

  { k: 'speed', v: 6 },

  { k: 'untilReset' },

  // --- THE GHOST ---------------------------------------------------------

  { k: 'speed', v: 1 },

  { k: 'cap', title: 'TIME REWINDS', text: 'The room forgets everything…', holdMs: 2600 },

  { k: 'cap', title: '…BUT YOU DO NOT', text: 'Your past self replays your actions.', holdMs: 3200 },

  { k: 'walk', route: [[350, 620], [640, 620]] },

  { k: 'untilBox' },

  { k: 'cap', title: 'THE PAST IS THE KEY', text: 'Your past self broke the glass. Take the card.', keys: ['E'], holdMs: 2800 },

  { k: 'e' },

  // --- THE ESCAPE MONTAGE -------------------------------------------------

  { k: 'cap', title: 'THE REST OF THE ESCAPE', text: 'Investigate. Reconstruct. Authenticate. Get out.', holdMs: 2400 },

  { k: 'speed', v: 2 },

  { k: 'walk', route: [[780, 620], [780, 400], [925, 400]] },

  { k: 'e', holdMs: 1300 }, // case 001

  { k: 'e', holdMs: 1300 }, // security footage

  { k: 'e' }, // incident reconstruction

  { k: 'submit', what: 'timeline' },

  { k: 'walk', route: [[780, 400], [780, 620], [215, 620]] },

  { k: 'e' }, // the hidden recorder

  { k: 'submit', what: 'recorder' },

  { k: 'walk', route: [[1160, 620], [1160, 560]] },

  { k: 'e' }, // exit authorization

  { k: 'submit', what: 'code' },

  { k: 'e' }, // open the exit

  { k: 'untilDoor' },

  { k: 'walk', route: [[1227, 560]] },

  { k: 'untilComplete' },

  // --- OUTRO ---------------------------------------------------------------

  { k: 'cap', title: 'ESCAPED', text: 'Two loops. That is the whole game: find it, record it, use your past, get out.', holdMs: 3800 },

  { k: 'outro' },

];

const NO_INPUT: InputState = { up: false, down: false, left: false, right: false };

const WALK_STEP_BUDGET = 60 * 75; // 75s of frames per walk step — then fail loudly

const E_PANEL_TIMEOUT_MS = 700; // an E that opens no panel finishes after this

export class DemoDirector {

  private idx = -1;

  private speed = 1;

  private capTimer = 0;

  private capId = 0;

  private eQueuedAt = -1;

  private panelHoldUntil = -1;

  private walkPts: ReadonlyArray<readonly [number, number]> = [];

  private walkIdx = 0;

  private walkFrames = 0;

  private resetSeenLoop: number;

  private realClock = 0;

  /** True once the script has finished (outro reached). */

  atEnd = false;

  /** True once the outro card should be shown. */

  outro = false;

  constructor(private state: LoopState, private emit: (out: DemoOut) => void) {

    this.resetSeenLoop = state.loop;

    this.next(); // enter the first step

  }

  /** Advance one frame. `dtMs` is real time; the sim runs at `speed * dtMs`. */

  tick(dtMs: number): GameEvent[] {

    if (this.atEnd) return [];

    this.realClock += dtMs;

    const st = this.state;

    const events: GameEvent[] = [];

    // 1) Panel hold: the game pauses while a panel is open (real behaviour).

    if (this.panelHoldUntil > 0) {

      if (this.realClock >= this.panelHoldUntil) {

        this.panelHoldUntil = -1;

        closePanel(st);

        this.next();

      }

      return events;

    }

    // 2) Advance the simulation (frozen while a panel is open or on complete).

    if (st.panel === 'none' && st.phase !== 'complete') {

      events.push(...step(st, dtMs * this.speed));

      // tryInteract only EMITS the openPanel event — the React layer applies

      // it. The demo applies it too, so panels and panel-gated actions work.

      for (const ev of events) {

        if (ev.type === 'openPanel') {

          st.panel = ev.panel;

          st.panelMessage = null;

        }

      }

    }

    // 3) If our E opened a panel that should be auto-closed, start the hold.

    const cur = this.current();

    if (cur?.k === 'e' && cur.holdMs && this.eQueuedAt >= 0 && st.panel !== 'none' && this.panelHoldUntil < 0) {

      this.panelHoldUntil = this.realClock + cur.holdMs;

    }

    // 4) Step logic.

    if (cur) this.runStep(cur, dtMs);

    return events;

  }

  private current(): Step | null {

    return this.idx >= 0 && this.idx < SCRIPT.length ? SCRIPT[this.idx] : null;

  }

  private runStep(cur: Step, dtMs: number): void {

    const st = this.state;

    switch (cur.k) {

      case 'cap':

        this.capTimer -= dtMs;

        if (this.capTimer <= 0) this.next();

        break;

      case 'speed':

        this.next();

        break;

      case 'walk': {

        if (this.walkIdx >= this.walkPts.length) {

          this.next();

          break;

        }

        // The exit walk "arrives" the moment the level completes (the sim

        // freezes then, so the velocity check could never pass otherwise).

        if (st.phase === 'complete') {

          this.walkIdx = this.walkPts.length;

          this.next();

          break;

        }

        this.walkFrames += 1;

        if (this.walkFrames > WALK_STEP_BUDGET) {

          this.emit({ type: 'error', message: 'tutorial bot could not reach a waypoint' });

          this.atEnd = true;

          break;

        }

        const p = st.player;

        const [tx, ty] = this.walkPts[this.walkIdx];

        const dx = tx - p.x;

        const dy = ty - p.y;

        const dist = Math.hypot(dx, dy);

        st.input = dist <= 24 ? NO_INPUT : { up: dy < -12, down: dy > 12, left: dx < -12, right: dx > 12 };

        if (Math.abs(dx) <= 16 && Math.abs(dy) <= 16 && Math.hypot(p.vx, p.vy) < 40) {

          this.walkIdx += 1;

          if (this.walkIdx >= this.walkPts.length) st.input = { ...NO_INPUT };

        }

        break;

      }

      case 'e':

        if (this.panelHoldUntil > 0) break; // waiting out the hold

        if (st.panel !== 'none') {

          this.next(); // panel opened — leave it open for the next step

          break;

        }

        if (this.realClock - this.eQueuedAt > E_PANEL_TIMEOUT_MS) this.next(); // no panel (switch / door)

        break;

      case 'untilReset':

        if (st.phase === 'playing' && st.loop > this.resetSeenLoop) this.next();

        break;

      case 'untilBox':

        if (st.boxUnlocked) this.next();

        break;

      case 'untilDoor':

        if (st.door === 'open') this.next();

        break;

      case 'untilComplete':

        if (st.phase === 'complete') this.next();

        break;

      default:

        break; // enter() already resolved 'submit' / 'outro'

    }

  }

  private next(): void {

    this.idx += 1;

    const cur = this.current();

    if (!cur) {

      this.atEnd = true;

      return;

    }

    const st = this.state;

    switch (cur.k) {

      case 'cap':

        this.capTimer = cur.holdMs;

        this.emit({ type: 'caption', cap: { id: ++this.capId, title: cur.title, text: cur.text, keys: cur.keys } });

        break;

      case 'speed':

        this.speed = cur.v;

        this.next();

        break;

      case 'walk':

        this.walkPts = cur.route;

        this.walkIdx = 0;

        this.walkFrames = 0;

        break;

      case 'e':

        this.eQueuedAt = this.realClock;

        queueInteract(st);

        break;

      case 'submit':

        this.emit({ type: 'clearCaption' });

        if (cur.what === 'timeline') submitTimelineOrder(st, [...CORRECT_TIMELINE]);

        else if (cur.what === 'code') submitExitCode(st, '0317');

        else markRecorderPlayed(st);

        this.next();

        break;

      case 'untilReset':

        this.resetSeenLoop = st.loop;

        this.emit({ type: 'clearCaption' });

        break;

      case 'outro':

        this.outro = true;

        this.atEnd = true;

        this.emit({ type: 'outro' });

        break;

      default:

        // 'untilBox' / 'untilDoor' / 'untilComplete'

        this.emit({ type: 'clearCaption' });

        break;

    }

    if (cur.k !== 'walk') st.input = { ...NO_INPUT };

  }

}


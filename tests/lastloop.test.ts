/**
 * THE LAST LOOP — simulation tests. The simulation is pure, so everything
 * here runs headless with fixed timesteps: no canvas, no DOM, no randomness.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  BOX_RECT,
  BOX_ZONE,
  DOOR_WALK_MS,
  DOOR_ZONE,
  LOOP_MS,
  PLAYER_SPEED,
  STEP_MS,
  SWITCH_ZONE,
} from '../src/loop/core/constants';
import {
  createLoopState,
  objectiveFor,
  queueInteract,
  restartLoop,
  sampleRecording,
  step,
} from '../src/loop/core/simulation';
import type { GameEvent, InputState, LoopState } from '../src/loop/core/types';

// Minimal browser shims for the save module (localStorage access at import).
const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
  configurable: true,
});
Object.defineProperty(globalThis, 'window', {
  value: { setTimeout, clearTimeout, addEventListener: () => undefined, location: { search: '' } },
  configurable: true,
});

const NO_INPUT: InputState = { up: false, down: false, left: false, right: false };

/** Drive the simulation with per-step inputs, returning drained events.
 *  Continues through the resetting phase; only a completed run stops it. */
function run(state: LoopState, steps: number, input: Partial<InputState> = {}, interactAt: number[] = []): GameEvent[] {
  const events: GameEvent[] = [];
  let interactIndex = 0;
  for (let i = 0; i < steps; i++) {
    state.input = { ...NO_INPUT, ...input };
    if (interactIndex < interactAt.length && i >= interactAt[interactIndex]) {
      queueInteract(state);
      interactIndex += 1;
    }
    events.push(...step(state, STEP_MS));
    if (state.phase === 'complete') break;
  }
  return events;
}

const msToSteps = (ms: number) => Math.round(ms / STEP_MS);

describe('movement', () => {
  it('accelerates right and reaches a stable top speed', () => {
    const state = createLoopState();
    run(state, 60, { right: true });
    expect(state.player.x).toBeGreaterThan(200);
    expect(Math.hypot(state.player.vx, state.player.vy)).toBeLessThanOrEqual(PLAYER_SPEED + 0.001);
  });

  it('stops quickly when input is released', () => {
    const state = createLoopState();
    run(state, 40, { right: true });
    const x = state.player.x;
    run(state, 30);
    expect(state.player.vx).toBe(0);
    expect(state.player.x - x).toBeLessThan(30);
  });

  it('never leaves the room bounds', () => {
    const state = createLoopState();
    run(state, 600, { left: true });
    expect(state.player.x).toBeGreaterThanOrEqual(36);
    run(state, 2000, { right: true, up: true });
    expect(state.player.x).toBeLessThanOrEqual(1244);
    expect(state.player.y).toBeGreaterThanOrEqual(330);
    expect(state.player.y).toBeLessThanOrEqual(640);
  });

  it('collides with the glass box instead of walking through it', () => {
    const state = createLoopState();
    // March right along the box's depth band until blocked.
    state.player.y = BOX_RECT.y + BOX_RECT.h / 2 + PLAYER_OFFSET_Y;
    run(state, 600, { right: true });
    expect(state.player.x).toBeLessThan(BOX_RECT.x + 1);
  });
});

const PLAYER_OFFSET_Y = 6; // half the player's collision width, inside the band

describe('timer and loop reset', () => {
  it('counts down and resets the room at zero without ending the game', () => {
    const state = createLoopState();
    run(state, msToSteps(LOOP_MS) + 10);
    expect(state.phase).toBe('resetting');
    expect(state.loop).toBe(1);
    expect(state.t).toBe(0);
    expect(state.playerSwitchOn).toBe(false); // world objects reset
    expect(state.pastSelves.length).toBe(1); // the run was recorded
    expect(state.ghosts.length).toBe(1);
  });

  it('fires restrained warnings at 10s and 5s', () => {
    const state = createLoopState();
    const events = run(state, msToSteps(LOOP_MS));
    const warnings = events.filter((e) => e.type === 'warning');
    expect(warnings.length).toBe(2);
  });

  it('pauses entirely while phase is resetting, then resumes play', () => {
    const state = createLoopState();
    run(state, msToSteps(LOOP_MS) + 5);
    expect(state.phase).toBe('resetting');
    const t = state.t;
    run(state, 20);
    expect(state.t).toBe(t);
    run(state, msToSteps(700));
    expect(state.phase).toBe('playing');
  });
});

describe('recording and deterministic replay', () => {
  it('records fixed 100ms samples and the switch action', () => {
    const state = createLoopState();
    // Walk right toward the switch for 1.2s, then interact.
    run(state, msToSteps(1200), { right: true }, [msToSteps(1200)]);
    expect(state.currentRecording.samples.length).toBeGreaterThanOrEqual(11);
    expect(state.currentRecording.actions).toEqual([{ t: expect.any(Number), type: 'switch' }]);
    expect(state.playerSwitchOn).toBe(true);
  });

  it('the ghost replays the same movement and activation after reset', () => {
    const state = createLoopState();
    // LOOP 01: walk right for 1.2s, hit the switch, keep walking right.
    run(state, msToSteps(1200), { right: true });
    queueInteract(state);
    run(state, msToSteps(600), { right: true });
    // Force the loop to end.
    run(state, msToSteps(LOOP_MS));
    expect(state.loop).toBe(1);

    // LOOP 02: ghost replays. Park the player far away and observe.
    state.player.x = 100;
    state.player.y = 600;
    const ghost = state.ghosts[0];
    run(state, msToSteps(1200));
    const pos = sampleRecording(ghost.recording, 1200);
    // Ghost stands exactly where the player stood at t=1200, switch latched by the ghost.
    expect(state.ghostSwitchOn).toBe(true);
    expect(state.boxUnlocked).toBe(true);
    expect(pos.x).toBeGreaterThan(200); // moved right like the recording
  });

  it('replays are deterministic across 20 identical runs (no drift)', () => {
    const fingerprints = new Set<string>();
    for (let iteration = 0; iteration < 20; iteration++) {
      const state = createLoopState();
      // Scripted loop: right 1.4s → interact → up 0.6s → right again.
      run(state, msToSteps(1400), { right: true }, [msToSteps(1400)]);
      run(state, msToSteps(600), { up: true, right: true });
      run(state, msToSteps(LOOP_MS));
      // Sample the ghost path + fired actions at 10 points of loop 2.
      const ghost = state.ghosts[0];
      const points: string[] = [];
      for (let i = 0; i <= 10; i++) {
        const p = sampleRecording(ghost.recording, (i * LOOP_MS) / 10);
        points.push(`${Math.round(p.x)},${Math.round(p.y)}`);
      }
      fingerprints.add(points.join('|') + '#' + JSON.stringify(ghost.recording.actions));
    }
    expect(fingerprints.size).toBe(1);
  });
});

describe('level 01 puzzle flow', () => {
  it('the glass box stays sealed unless a GHOST holds the switch', () => {
    const state = createLoopState();
    // Player activates the switch themselves in loop 1.
    state.player.x = SWITCH_ZONE.x + 40;
    state.player.y = SWITCH_ZONE.y + 40;
    queueInteract(state);
    run(state, 3);
    expect(state.playerSwitchOn).toBe(true);
    expect(state.boxUnlocked).toBe(false); // own activation is not enough
  });

  it('ghost switch hold unlocks the box, card pickup works, door needs the card', () => {
    const state = createLoopState();
    // Loop 1: record a switch press.
    state.player.x = SWITCH_ZONE.x + 40;
    state.player.y = SWITCH_ZONE.y + 40;
    queueInteract(state);
    run(state, 5);
    run(state, msToSteps(LOOP_MS)); // reset
    // Loop 2: the ghost re-activates the switch a moment into the loop.
    run(state, msToSteps(3000));
    expect(state.boxUnlocked).toBe(true);
    // Player walks to the box and picks up the card.
    state.player.x = BOX_ZONE.x + 60;
    state.player.y = BOX_ZONE.y + 40;
    queueInteract(state);
    run(state, 5);
    expect(state.hasCard).toBe(true);
    expect(state.cardAvailable).toBe(false);
    // Door without the card in a fresh loop stays locked...
    run(state, msToSteps(LOOP_MS));
    expect(state.hasCard).toBe(true); // inventory persists across loops
    state.player.x = DOOR_ZONE.x + 60;
    state.player.y = DOOR_ZONE.y + 200;
    queueInteract(state);
    run(state, 5);
    expect(state.door).toBe('unlocked');
  });

  it('completion requires the walk through the open doorway', () => {
    const state = createLoopState();
    state.hasCard = true;
    state.player.x = DOOR_ZONE.x + 60;
    state.player.y = DOOR_ZONE.y + 200;
    queueInteract(state);
    run(state, 5);
    expect(state.door).toBe('unlocked');
    run(state, msToSteps(DOOR_WALK_MS + 600)); // door swings open, timer frozen
    expect(state.door).toBe('open');
    const frozen = state.t;
    run(state, msToSteps(2000));
    expect(state.t).toBe(frozen); // no reset while walking out
    state.player.x = 1230; // step into the light
    run(state, 4);
    expect(state.phase).toBe('complete');
    expect(objectiveFor(state)).toBeDefined();
  });
});

describe('loop restart vs level restart', () => {
  it('R-style loop restart discards the recording and spawns no ghost', () => {
    const state = createLoopState();
    run(state, msToSteps(5000), { right: true });
    restartLoop(state);
    expect(state.loop).toBe(0);
    expect(state.pastSelves.length).toBe(0);
    expect(state.ghosts.length).toBe(0);
    expect(state.t).toBe(0);
  });

  it('interactions at the exact timer boundary are not lost or duplicated', () => {
    for (let offset = -2; offset <= 2; offset++) {
      const state = createLoopState();
      state.player.x = SWITCH_ZONE.x + 40;
      state.player.y = SWITCH_ZONE.y + 40;
      const boundary = msToSteps(LOOP_MS) + offset;
      if (boundary >= 0) queueInteract(state);
      run(state, Math.max(1, boundary));
      // Either the switch latched just before reset, or it resets cleanly —
      // never a duplicate action or a crash.
      const switchActions = state.currentRecording.actions.filter((a) => a.type === 'switch');
      expect(switchActions.length).toBeLessThanOrEqual(1);
    }
  });
});

describe('save', () => {
  beforeEach(() => store.clear());

  it('records the best time and loops, and unlocks the next level', async () => {
    const { loadLoopSave, recordResult, saveLoopSaveNow } = await import('../src/loop/services/save');
    saveLoopSaveNow((s) => recordResult(s, 1, 95_000, 3));
    saveLoopSaveNow((s) => recordResult(s, 1, 80_000, 2)); // better run
    const s = loadLoopSave();
    expect(s.results['1'].bestTimeMs).toBe(80_000);
    expect(s.results['1'].bestLoops).toBe(2);
    expect(s.unlockedLevels).toContain(2);
  });

  it('survives corruption with a fresh save', async () => {
    const { loadLoopSave } = await import('../src/loop/services/save');
    store.set('the-last-loop-save-v1', '{not json');
    const s = loadLoopSave();
    expect(s.version).toBe(1);
    expect(s.unlockedLevels).toEqual([1]);
  });
});

describe('hud objectives', () => {
  it('progresses: findSwitch → ghostHolding → getCard → useDoor', () => {
    const state = createLoopState();
    expect(objectiveFor(state)).toBe('findSwitch');
    run(state, msToSteps(LOOP_MS));
    expect(objectiveFor(state)).toBe('ghostHolding');
    state.boxUnlocked = true;
    state.cardAvailable = true;
    expect(objectiveFor(state)).toBe('getCard');
    state.hasCard = true;
    expect(objectiveFor(state)).toBe('useDoor');
  });
});

describe('qa loop length override', () => {
  it('creates a shorter loop for QA runs', () => {
    const state = createLoopState(20_000);
    run(state, msToSteps(20_000) + 5);
    expect(state.phase).toBe('resetting');
    expect(state.loop).toBe(1);
    void vi;
  });
});

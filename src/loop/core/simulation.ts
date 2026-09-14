/**
 * THE LAST LOOP — Level 01 deterministic simulation.
 *
 * Core loop:
 * explore -> discover clues -> record actions -> loop resets -> past selves replay ->
 * use previous actions to access investigation systems -> reconstruct incident -> escape.
 */

import {
  BOX_RECT,
  BOX_ZONE,
  CLOCK_ZONE,
  DOOR_ZONE,
  DOOR_WALK_MS,
  FLOOR_BOTTOM,
  FLOOR_TOP,
  LOOP_MS,
  NOTE_ZONE,
  PLAYER_ACCEL,
  PLAYER_H,
  PLAYER_START,
  PLAYER_SPEED,
  PLAYER_STOP_DAMP,
  PLAYER_W,
  RESET_MS,
  ROOM_BOUNDS,
  SAMPLE_MS,
  STEP_MS,
  SWITCH_ZONE,
  TABLE_RECT,
  TERMINAL_ZONE,
  WARN_1_MS,
  WARN_2_MS,
  rectContains,
} from './constants';
import type {
  ActionEvent,
  Direction,
  GameEvent,
  InputState,
  InvestigationState,
  LoopState,
  Objective,
  Recording,
} from './types';


export const TIMELINE_STEPS = [
  { id: 'arrival', label: 'Elias arrives' },
  { id: 'power', label: 'Auxiliary power activates' },
  { id: 'mara', label: 'Badge 07 enters' },
  { id: 'argument', label: 'Argument begins' },
  { id: 'crash', label: 'Glass breaks' },
  { id: 'death', label: 'Incident at 03:17' },
] as const;

const CORRECT_TIMELINE = TIMELINE_STEPS.map((s) => s.id);

function freshInvestigation(): InvestigationState {
  return {
    note: false,
    clock: false,
    accessCard: false,
    terminal: false,
    cctv: false,
    badge07: false,
    suspectMara: false,
    timeline: false,
    recorder: false,
    finalRecording: false,
    exitCodeSolved: false,
  };
}

export function createLoopState(loopLengthMs = LOOP_MS): LoopState {
  return {
    phase: 'playing',
    loop: 0,
    t: 0,
    loopLengthMs,
    player: { x: PLAYER_START.x, y: PLAYER_START.y, vx: 0, vy: 0, dir: 'right', moving: false, stride: 0 },
    input: { up: false, down: false, left: false, right: false },
    interactQueue: 0,
    playerSwitchOn: false,
    ghostSwitchOn: false,
    boxUnlocked: false,
    boxOpen: false,
    cardAvailable: true,
    door: 'locked',
    hasCard: false,
    investigation: freshInvestigation(),
    panel: 'none',
    timelineSelection: [],
    panelMessage: null,
    currentRecording: { loop: 0, samples: [], actions: [], durationMs: 0 },
    pastSelves: [],
    ghosts: [],
    events: [],
    warningFired: 0,
    resetTimerMs: 0,
    totalTimeMs: 0,
    doorTimerMs: 0,
  };
}

function pushEvent(state: LoopState, event: GameEvent): void {
  state.events.push(event);
}

function recordSample(state: LoopState): void {
  const s = state.player;
  state.currentRecording.samples.push({
    t: Math.round(state.t),
    x: Math.round(s.x * 100) / 100,
    y: Math.round(s.y * 100) / 100,
    dir: s.dir,
    moving: s.moving,
  });
}

function recordAction(state: LoopState, type: ActionEvent['type']): void {
  state.currentRecording.actions.push({ t: Math.round(state.t), type });
}

function bodyRect(x: number, y: number) {
  return { x: x - PLAYER_W / 2, y: y - PLAYER_H, w: PLAYER_W, h: PLAYER_H };
}

function solidAt(x: number, y: number): boolean {
  const body = bodyRect(x, y);
  if (body.x < ROOM_BOUNDS.minX || body.x + body.w > ROOM_BOUNDS.maxX) return true;
  if (body.y < FLOOR_TOP - PLAYER_H || body.y + body.h > FLOOR_BOTTOM) return true;
  // The glass box blocks the player only at its physical body, not its approach side.
  return (
    body.x < TABLE_RECT.x + TABLE_RECT.w &&
    body.x + body.w > TABLE_RECT.x &&
    body.y < TABLE_RECT.y + TABLE_RECT.h &&
    body.y + body.h > TABLE_RECT.y
  ) || (
    body.x < BOX_RECT.x + BOX_RECT.w &&
    body.x + body.w > BOX_RECT.x &&
    body.y < BOX_RECT.y + BOX_RECT.h &&
    body.y + body.h > BOX_RECT.y
  );
}

function movePlayer(state: LoopState, dtSec: number): void {
  const p = state.player;
  const input = state.input;
  let ax = 0;
  let ay = 0;
  if (input.left) ax -= 1;
  if (input.right) ax += 1;
  if (input.up) ay -= 1;
  if (input.down) ay += 1;
  const moving = ax !== 0 || ay !== 0;

  if (moving) {
    const norm = Math.hypot(ax, ay) || 1;
    p.vx += (ax / norm) * PLAYER_ACCEL * dtSec;
    p.vy += (ay / norm) * PLAYER_ACCEL * dtSec;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > PLAYER_SPEED) {
      p.vx = (p.vx / speed) * PLAYER_SPEED;
      p.vy = (p.vy / speed) * PLAYER_SPEED;
    }
    if (Math.abs(ax) >= Math.abs(ay)) p.dir = ax > 0 ? 'right' : 'left';
    else p.dir = ay > 0 ? 'down' : 'up';
  } else {
    const damp = Math.pow(PLAYER_STOP_DAMP, dtSec);
    p.vx *= damp;
    p.vy *= damp;
    if (Math.abs(p.vx) < 4) p.vx = 0;
    if (Math.abs(p.vy) < 4) p.vy = 0;
  }

  p.moving = Math.hypot(p.vx, p.vy) > 12;

  const nx = p.x + p.vx * dtSec;
  if (!solidAt(nx, p.y)) p.x = nx;
  else p.vx = 0;

  const ny = p.y + p.vy * dtSec;
  if (!solidAt(p.x, ny)) p.y = ny;
  else p.vy = 0;

  if (p.moving) {
    p.stride = (p.stride + dtSec * (PLAYER_SPEED / 240)) % 1;
    if (p.stride < dtSec * (PLAYER_SPEED / 240)) {
      pushEvent(state, { type: 'footstep', t: Math.round(state.t) });
    }
  }
}

export function sampleRecording(
  recording: Recording,
  t: number,
): { x: number; y: number; dir: Direction; moving: boolean } {
  const samples = recording.samples;
  if (samples.length === 0) return { x: PLAYER_START.x, y: PLAYER_START.y, dir: 'right', moving: false };
  if (t <= samples[0].t) return samples[0];
  const last = samples[samples.length - 1];
  if (t >= last.t) return last;
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const span = b.t - a.t || 1;
  const f = (t - a.t) / span;
  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    dir: b.moving ? b.dir : a.dir,
    moving: a.moving || b.moving,
  };
}

function applyGhostAction(state: LoopState, action: ActionEvent): void {
  if (action.type === 'switch') {
    if (!state.ghostSwitchOn) {
      state.ghostSwitchOn = true;
      state.boxUnlocked = true;
      pushEvent(state, { type: 'switchOn', by: 'ghost', t: Math.round(state.t) });
      pushEvent(state, { type: 'boxUnlocked', t: Math.round(state.t) });
    }
  }
}

function replayGhosts(state: LoopState): void {
  for (const ghost of state.ghosts) {
    while (ghost.fired < ghost.recording.actions.length) {
      const next = ghost.recording.actions[ghost.fired];
      if (next.t > state.t) break;
      ghost.fired += 1;
      applyGhostAction(state, next);
    }
  }
}

function ghostPositions(state: LoopState): void {
  for (const ghost of state.ghosts) {
    const pos = sampleRecording(ghost.recording, state.t);
    ghost.trail.push({ x: pos.x, y: pos.y, a: 0.55 });
    if (ghost.trail.length > 14) ghost.trail.shift();
    for (const point of ghost.trail) point.a *= 0.86;
  }
}

function resetWorldForNewLoop(state: LoopState, loop: number): void {
  state.t = 0;
  state.loop = loop;
  state.player.x = PLAYER_START.x;
  state.player.y = PLAYER_START.y;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.dir = 'right';
  state.player.moving = false;
  state.playerSwitchOn = false;
  state.ghostSwitchOn = false;
  state.boxUnlocked = false;
  state.boxOpen = false;
  state.cardAvailable = true;
  state.hasCard = state.investigation.accessCard;
  state.door = 'locked';
  state.warningFired = 0;
  state.currentRecording = { loop, samples: [], actions: [], durationMs: 0 };
  state.interactQueue = 0;
  state.panel = 'none';
  state.timelineSelection = [];
  state.panelMessage = null;
}

function finalizeLoop(state: LoopState): void {
  state.currentRecording.durationMs = state.loopLengthMs;
  if (state.currentRecording.samples.length === 0) recordSample(state);
  state.pastSelves.push(state.currentRecording);
  state.ghosts = state.pastSelves.map((recording) => ({ recording, fired: 0, trail: [] }));
  resetWorldForNewLoop(state, state.loop + 1);
  state.phase = 'resetting';
  state.resetTimerMs = RESET_MS;
  pushEvent(state, { type: 'loopReset', t: 0 });
  pushEvent(state, { type: 'ghostAppear', loop: state.loop, t: 0 });
}

function pushClue(state: LoopState, clue: keyof InvestigationState): void {
  if (state.investigation[clue]) return;
  state.investigation[clue] = true;
  pushEvent(state, { type: 'clueFound', clue, t: Math.round(state.t) });
}

function tryInteract(state: LoopState): void {
  const { x, y } = state.player;

  // Desk note: first interaction reveals the first story clue.
  if (rectContains(NOTE_ZONE, x, y)) {
    if (!state.investigation.note) {
      pushClue(state, 'note');
      pushEvent(state, { type: 'openPanel', panel: 'note', t: Math.round(state.t) });
    } else if (state.investigation.timeline && !state.investigation.recorder) {
      // The final hidden recorder is concealed where the note was found.
      state.investigation.recorder = true;
      pushClue(state, 'recorder');
      pushEvent(state, { type: 'openPanel', panel: 'recorder', t: Math.round(state.t) });
    }
    return;
  }

  // Clock: establishes 03:17, and after the timeline it reveals the hidden compartment.
  if (rectContains(CLOCK_ZONE, x, y)) {
    if (!state.investigation.clock) {
      pushClue(state, 'clock');
      pushEvent(state, { type: 'openPanel', panel: 'clock', t: Math.round(state.t) });
      return;
    }
    if (state.investigation.timeline && !state.investigation.recorder) {
      state.investigation.recorder = true;
      pushClue(state, 'recorder');
      pushEvent(state, { type: 'openPanel', panel: 'recorder', t: Math.round(state.t) });
    }
    return;
  }

  // Auxiliary power. The press is RECORDED so a future self (the ghost) can
  // repeat it — the box stays sealed to your own press; only replay unlocks it.
  // The zone claims the interaction only while it still has work to do.
  if (rectContains(SWITCH_ZONE, x, y) && !state.playerSwitchOn && !state.ghostSwitchOn) {
    state.playerSwitchOn = true;
    recordAction(state, 'switch');
    pushEvent(state, { type: 'switchOn', by: 'player', t: Math.round(state.t) });
    return;
  }

  // Evidence box requires ghost/current auxiliary power.
  if (rectContains(BOX_ZONE, x, y)) {
    if (!state.boxUnlocked) return;
    if (!state.boxOpen) state.boxOpen = true;
    if (!state.hasCard) {
      state.hasCard = true;
      state.investigation.accessCard = true;
      recordAction(state, 'card');
      pushClue(state, 'accessCard');
      pushEvent(state, { type: 'cardTaken', t: Math.round(state.t) });
    }
    return;
  }

  // Security terminal: card + powered room grants case file, then CCTV.
  if (rectContains(TERMINAL_ZONE, x, y)) {
    if (!state.hasCard || !state.ghostSwitchOn && !state.playerSwitchOn) return;
    if (!state.investigation.terminal) {
      state.investigation.terminal = true;
      pushClue(state, 'terminal');
      pushEvent(state, { type: 'openPanel', panel: 'terminal', t: Math.round(state.t) });
      return;
    }
    if (!state.investigation.cctv) {
      state.investigation.cctv = true;
      state.investigation.badge07 = true;
      state.investigation.suspectMara = true;
      pushClue(state, 'cctv');
      pushClue(state, 'badge07');
      pushClue(state, 'suspectMara');
      pushEvent(state, { type: 'openPanel', panel: 'cctv', t: Math.round(state.t) });
      return;
    }
    if (state.investigation.cctv && !state.investigation.timeline) {
      pushEvent(state, { type: 'openPanel', panel: 'timeline', t: Math.round(state.t) });
      return;
    }
  }

  // Door requires the investigation to be completed first; then opens a keypad panel.
  if (rectContains(DOOR_ZONE, x, y)) {
    if (state.investigation.finalRecording && !state.investigation.exitCodeSolved) {
      pushEvent(state, { type: 'openPanel', panel: 'code', t: Math.round(state.t) });
      return;
    }
    if (state.investigation.exitCodeSolved && state.door === 'locked') {
      state.door = 'unlocked';
      state.doorTimerMs = DOOR_WALK_MS;
      pushEvent(state, { type: 'doorUnlocked', t: Math.round(state.t) });
      return;
    }
  }
}

export function queueInteract(state: LoopState): void {
  if (state.phase === 'playing' && state.interactQueue < 2) state.interactQueue += 1;
}

export function closePanel(state: LoopState): void {
  state.panel = 'none';
  state.panelMessage = null;
}

export function submitTimelineOrder(state: LoopState, order: string[]): boolean {
  if (state.panel !== 'timeline') return false;
  state.timelineSelection = order.slice(0, CORRECT_TIMELINE.length);
  const valid = order.length === CORRECT_TIMELINE.length && order.every((id, i) => id === CORRECT_TIMELINE[i]);
  if (valid) {
    state.investigation.timeline = true;
    state.panelMessage = null;
    state.panel = 'none';
    pushClue(state, 'timeline');
    pushEvent(state, { type: 'timelineSolved', t: Math.round(state.t) });
    return true;
  }
  state.panelMessage = 'Sequence incorrect. Use the clock, audio and camera clues.';
  state.timelineSelection = [];
  return false;
}

export function submitExitCode(state: LoopState, code: string): boolean {
  if (state.panel !== 'code') return false;
  if (code === '0317') {
    state.investigation.exitCodeSolved = true;
    state.panel = 'none';
    pushClue(state, 'exitCodeSolved');
    return true;
  }
  state.panelMessage = 'ACCESS DENIED — THE INCIDENT TIME IS THE KEY.';
  return false;
}

export function markRecorderPlayed(state: LoopState): void {
  if (!state.investigation.recorder) return;
  if (!state.investigation.finalRecording) {
    state.investigation.finalRecording = true;
    state.panel = 'none';
    pushEvent(state, { type: 'finalRecording', t: Math.round(state.t) });
  }
}

export function restartLoop(state: LoopState): void {
  if (state.phase !== 'playing') return;
  resetWorldForNewLoop(state, state.loop);
  state.ghosts = state.pastSelves.map((recording) => ({ recording, fired: 0, trail: [] }));
  pushEvent(state, { type: 'loopReset', t: 0 });
}

export function restartLevel(state: LoopState): void {
  Object.assign(state, createLoopState(state.loopLengthMs));
}

function simulateStep(state: LoopState): void {
  if (state.phase === 'resetting') {
    state.resetTimerMs -= STEP_MS;
    if (state.resetTimerMs <= 0) {
      state.resetTimerMs = 0;
      state.phase = 'playing';
      state.t = 0;
    }
    return;
  }
  if (state.phase === 'complete') return;

  if (state.door !== 'open') {
    state.t += STEP_MS;
    state.totalTimeMs += STEP_MS;
  }

  movePlayer(state, STEP_MS / 1000);

  const lastSample = state.currentRecording.samples[state.currentRecording.samples.length - 1];
  if (!lastSample || state.t - lastSample.t >= SAMPLE_MS) recordSample(state);

  if (state.interactQueue > 0) {
    state.interactQueue -= 1;
    tryInteract(state);
  }

  if (state.door === 'unlocked') {
    state.doorTimerMs -= STEP_MS;
    if (state.doorTimerMs <= 0) {
      state.door = 'open';
      pushEvent(state, { type: 'doorOpen', t: Math.round(state.t) });
    }
  }

  if (state.door === 'open') {
    if (state.player.x > 1215) {
      state.phase = 'complete';
      state.currentRecording.durationMs = Math.round(state.t);
      pushEvent(state, { type: 'complete', t: Math.round(state.t) });
      return;
    }
  }

  if (state.door !== 'open' && state.t + STEP_MS / 2 >= state.loopLengthMs) {
    finalizeLoop(state);
    return;
  }

  const remaining = state.loopLengthMs - state.t;
  if (state.warningFired === 0 && remaining <= WARN_1_MS) {
    state.warningFired = 1;
    pushEvent(state, { type: 'warning', level: 1, t: Math.round(state.t) });
  }
  if (state.warningFired === 1 && remaining <= WARN_2_MS) {
    state.warningFired = 2;
    pushEvent(state, { type: 'warning', level: 2, t: Math.round(state.t) });
  }
}

export function step(state: LoopState, dtMs: number): GameEvent[] {
  if (state.phase === 'complete') return [];
  const total = Math.min(Math.max(dtMs, 0), 250);
  state.events = [];
  let carry = ('carryMs' in state ? (state as LoopState & { carryMs: number }).carryMs : 0) + total;
  while (carry >= STEP_MS && (state as LoopState).phase !== 'complete') {
    carry -= STEP_MS;
    simulateStep(state);
    if (state.phase === 'playing') {
      replayGhosts(state);
      ghostPositions(state);
    }
  }
  (state as LoopState & { carryMs?: number }).carryMs = carry;
  const events = state.events;
  state.events = [];
  return events;
}

export function objectiveFor(state: LoopState): Objective {
  const i = state.investigation;
  if (i.finalRecording && !i.exitCodeSolved) return 'useDoor';
  if (i.timeline && !i.recorder) return 'findRecorder';
  if (i.recorder && !i.finalRecording) return 'playRecording';
  if (i.cctv && !i.timeline) return 'reconstruct';
  if (i.terminal && !i.cctv) return 'viewCctv';
  if (state.hasCard && state.ghostSwitchOn && !i.terminal) return 'inspectCase';
  if (i.accessCard && !state.ghostSwitchOn) return 'ghostHolding';
  if (i.accessCard && state.ghostSwitchOn) return 'inspectCase';
  if (state.pastSelves.length > 0) return 'ghostHolding';
  return 'findSwitch';
}

export function interactionPromptFor(state: LoopState): string | null {
  const { x, y } = state.player;
  if (rectContains(NOTE_ZONE, x, y) && !state.investigation.note) return 'E  READ THE TORN NOTE';
  if (rectContains(NOTE_ZONE, x, y) && state.investigation.timeline && !state.investigation.recorder) return 'E  SEARCH THE NOTE DESK';
  if (rectContains(CLOCK_ZONE, x, y) && !state.investigation.clock) return 'E  INSPECT THE CLOCK';
  if (rectContains(CLOCK_ZONE, x, y) && state.investigation.timeline && !state.investigation.recorder) return 'E  INSPECT THE CLOCK';
  if (rectContains(SWITCH_ZONE, x, y) && !state.playerSwitchOn) return 'E  ACTIVATE AUXILIARY POWER';
  if (rectContains(BOX_ZONE, x, y) && state.boxUnlocked && !state.hasCard) return 'E  TAKE THE ACCESS CARD';
  if (rectContains(TERMINAL_ZONE, x, y) && state.hasCard && !state.investigation.terminal) return 'E  ACCESS CASE 001';
  if (rectContains(TERMINAL_ZONE, x, y) && state.investigation.terminal && !state.investigation.cctv) return 'E  VIEW SECURITY FOOTAGE';
  if (rectContains(TERMINAL_ZONE, x, y) && state.investigation.cctv && !state.investigation.timeline) return 'E  RECONSTRUCT INCIDENT';
  if (rectContains(DOOR_ZONE, x, y) && state.investigation.finalRecording && !state.investigation.exitCodeSolved) return 'E  AUTHENTICATE EXIT';
  if (rectContains(DOOR_ZONE, x, y) && state.investigation.exitCodeSolved && state.door === 'locked') return 'E  OPEN THE EXIT';
  return null;
}

export { CORRECT_TIMELINE };

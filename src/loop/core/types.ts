/**
 * THE LAST LOOP — Level 01 shared simulation types.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export type ActionType = 'switch' | 'box' | 'card';

export interface Sample {
  t: number;
  x: number;
  y: number;
  dir: Direction;
  moving: boolean;
}

export interface ActionEvent {
  t: number;
  type: ActionType;
}

export interface Recording {
  loop: number;
  samples: Sample[];
  actions: ActionEvent[];
  durationMs: number;
}

export type Phase = 'playing' | 'resetting' | 'complete';

export type PanelType = 'none' | 'note' | 'clock' | 'terminal' | 'cctv' | 'timeline' | 'recorder' | 'code';

export type Objective =
  | 'findSwitch'
  | 'ghostHolding'
  | 'getCard'
  | 'inspectCase'
  | 'viewCctv'
  | 'reconstruct'
  | 'findRecorder'
  | 'playRecording'
  | 'useDoor'
  | 'complete';

export interface InvestigationState {
  note: boolean;
  clock: boolean;
  accessCard: boolean;
  terminal: boolean;
  cctv: boolean;
  badge07: boolean;
  suspectMara: boolean;
  timeline: boolean;
  recorder: boolean;
  finalRecording: boolean;
  exitCodeSolved: boolean;
}

export type GameEvent =
  | { type: 'switchOn'; by: 'player' | 'ghost'; t: number }
  | { type: 'boxUnlocked'; t: number }
  | { type: 'cardTaken'; t: number }
  | { type: 'clueFound'; clue: keyof InvestigationState; t: number }
  | { type: 'openPanel'; panel: Exclude<PanelType, 'none'>; t: number }
  | { type: 'timelineSolved'; t: number }
  | { type: 'finalRecording'; t: number }
  | { type: 'doorUnlocked'; t: number }
  | { type: 'doorOpen'; t: number }
  | { type: 'footstep'; t: number }
  | { type: 'loopReset'; t: number }
  | { type: 'ghostAppear'; loop: number; t: number }
  | { type: 'warning'; level: 1 | 2; t: number }
  | { type: 'complete'; t: number };

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: Direction;
  moving: boolean;
  stride: number;
}

export interface GhostState {
  recording: Recording;
  fired: number;
  trail: Array<{ x: number; y: number; a: number }>;
}

export interface LoopState {
  phase: Phase;
  loop: number;
  t: number;
  loopLengthMs: number;
  player: PlayerState;
  input: InputState;
  interactQueue: number;

  // Current-loop machinery/world.
  playerSwitchOn: boolean;
  ghostSwitchOn: boolean;
  boxUnlocked: boolean;
  boxOpen: boolean;
  cardAvailable: boolean;
  door: 'locked' | 'unlocked' | 'open';

  // Investigation persists across loops.
  hasCard: boolean;
  investigation: InvestigationState;
  panel: PanelType;
  timelineSelection: string[];
  panelMessage: string | null;

  // Replay.
  currentRecording: Recording;
  pastSelves: Recording[];
  ghosts: GhostState[];

  events: GameEvent[];
  warningFired: 0 | 1 | 2;
  resetTimerMs: number;
  totalTimeMs: number;
  doorTimerMs: number;
}

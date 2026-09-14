/** THE LAST LOOP — Level 01 geometry and timing. */
// Spawn point on open floor. Must NOT sit inside any solid body (table/box),
// or the player is frozen at the start of the level.
export const PLAYER_START = { x: 350, y: 560 };

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const LOOP_MS = 60_000;
export const RESET_MS = 700;
export const DOOR_WALK_MS = 1100;
export const WARN_1_MS = 10_000;
export const WARN_2_MS = 5_000;
export const PLAYER_SPEED = 260;
export const PLAYER_ACCEL = 1800;
export const PLAYER_STOP_DAMP = 0.000001;
export const PLAYER_W = 34;
export const PLAYER_H = 58;
export const FLOOR_TOP = 330;
export const FLOOR_BOTTOM = 640;
export const WALL_LINE = 300;
export const ROOM_BOUNDS = { minX: 36, maxX: 1244, minY: FLOOR_TOP, maxY: FLOOR_BOTTOM };
export const TABLE_RECT = { x: 110, y: 452, w: 190, h: 84 };
export const BOX_RECT = { x: 566, y: 396, w: 168, h: 108 };

// Player-foot interaction zones. Keep them comfortable rather than pixel-hunt sized.
export const SWITCH_ZONE = { x: 536, y: FLOOR_TOP, w: 216, h: 130 };
export const BOX_ZONE = { x: 540, y: 500, w: 220, h: 130 };
export const NOTE_ZONE = { x: 110, y: 500, w: 210, h: 110 };
export const CLOCK_ZONE = { x: 1000, y: FLOOR_TOP, w: 130, h: 145 };
export const TERMINAL_ZONE = { x: 830, y: FLOOR_TOP, w: 190, h: 145 };
export const DOOR_ZONE = { x: 1076, y: FLOOR_TOP, w: 172, h: FLOOR_BOTTOM - FLOOR_TOP };

export const SWITCH_POS = { x: 640, y: 232 };
export const BOX_LABEL_POS = { x: 650, y: 380 };
export const DOOR_POS = { x: 1170, y: 262 };
export const CLOCK_POS = { x: 1020, y: 188 };
export const TERMINAL_POS = { x: 905, y: 208 };
export const OVERHEAD_LAMP = { x: 640, y: 0 };
export const SAMPLE_MS = 100;
export const STEP_MS = 1000 / 60;

export function loopLengthFromParams(search: string): number {
  const raw = new URLSearchParams(search).get('loopSeconds');
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return LOOP_MS;
  return Math.min(60, Math.max(5, Math.round(n))) * 1000;
}

export function rectContains(r: { x: number; y: number; w: number; h: number }, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

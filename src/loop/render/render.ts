/**
 * THE LAST LOOP — canvas renderer. Draws the room, objects, characters and
 * lighting from the simulation state. A pre-rendered static background keeps
 * per-frame cost low; lighting, glass, characters and cinematics are dynamic.
 */

import {
  BOX_RECT,
  DOOR_POS,
  CLOCK_POS,
  TERMINAL_POS,
  OVERHEAD_LAMP,
  PLAYER_H,
  PLAYER_W,
  SWITCH_POS,
  TABLE_RECT,
  VIEW_H,
  VIEW_W,
  WARN_1_MS,
  WARN_2_MS,
} from '../core/constants';
import { sampleRecording } from '../core/simulation';
import type { LoopState } from '../core/types';

let background: HTMLCanvasElement | null = null;

function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Build the immutable parts of the room once into an offscreen canvas. */
function buildBackground(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const ctx = canvas.getContext('2d')!;
  const random = rand(20260914);

  // Back wall — dark metal panels.
  const wall = ctx.createLinearGradient(0, 0, 0, 312);
  wall.addColorStop(0, '#05070c');
  wall.addColorStop(0.5, '#101722');
  wall.addColorStop(1, '#0a101a');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, VIEW_W, 312);
  for (let x = 0; x < VIEW_W; x += 128) {
    const panel = ctx.createLinearGradient(x, 0, x + 128, 312);
    panel.addColorStop(0, 'rgba(255,255,255,0.035)');
    panel.addColorStop(0.6, 'rgba(255,255,255,0.0)');
    panel.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = panel;
    ctx.fillRect(x + 2, 8, 124, 296);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeRect(x + 2.5, 8.5, 123, 295);
    // rivets
    ctx.fillStyle = 'rgba(160,190,220,0.14)';
    for (const rx of [x + 14, x + 114]) {
      for (const ry of [22, 290]) {
        ctx.beginPath();
        ctx.arc(rx, ry, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Horizontal conduit along the wall.
  ctx.fillStyle = '#0c1219';
  ctx.fillRect(0, 96, VIEW_W, 14);
  ctx.fillStyle = 'rgba(120,160,200,0.08)';
  ctx.fillRect(0, 96, VIEW_W, 3);
  for (let x = 60; x < VIEW_W; x += 160) {
    ctx.fillStyle = 'rgba(140,180,220,0.16)';
    ctx.fillRect(x, 94, 10, 18);
  }

  // Floor — worn concrete with perspective seams.
  const floor = ctx.createLinearGradient(0, 312, 0, 660);
  floor.addColorStop(0, '#11161e');
  floor.addColorStop(0.45, '#171d27');
  floor.addColorStop(1, '#0a0e14');
  ctx.fillStyle = floor;
  ctx.fillRect(0, 312, VIEW_W, 348);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, 312, VIEW_W, 6);
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 1;
  for (const y of [352, 402, 464, 538, 624]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(VIEW_W, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  for (let i = 0; i < 9; i++) {
    const x = 60 + i * 140;
    ctx.beginPath();
    ctx.moveTo(x + random() * 30, 316);
    ctx.lineTo(x - 40 + random() * 80, 658);
    ctx.stroke();
  }
  for (let i = 0; i < 900; i++) {
    const x = random() * VIEW_W;
    const y = 316 + random() * 340;
    ctx.fillStyle = random() > 0.5 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.16)';
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  // Dark base band.
  const base = ctx.createLinearGradient(0, 660, 0, VIEW_H);
  base.addColorStop(0, '#04060a');
  base.addColorStop(1, '#010203');
  ctx.fillStyle = base;
  ctx.fillRect(0, 660, VIEW_W, 60);

  // Vent on the wall.
  ctx.fillStyle = '#0a0f16';
  roundRect(ctx, 856, 128, 92, 46, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,180,220,0.25)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(120,150,190,0.3)';
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(862, 128 + i * 7);
    ctx.lineTo(942, 128 + i * 7);
    ctx.stroke();
  }

  // Warning sign.
  ctx.fillStyle = '#141313';
  roundRect(ctx, 400, 158, 118, 62, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(214,72,63,0.65)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(214,72,63,0.85)';
  ctx.beginPath();
  ctx.moveTo(424, 214);
  ctx.lineTo(444, 172);
  ctx.lineTo(464, 214);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(442, 182, 4, 16);
  ctx.fillRect(442, 202, 4, 5);
  ctx.fillStyle = 'rgba(230,235,245,0.75)';
  ctx.font = '700 9px "Space Mono", monospace';
  ctx.fillText('LOOP SECTOR 01', 472, 194);

  // Security camera.
  ctx.fillStyle = '#0b1119';
  roundRect(ctx, 986, 96, 52, 26, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,180,220,0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#101a26';
  ctx.beginPath();
  ctx.moveTo(1036, 108);
  ctx.lineTo(1062, 116);
  ctx.lineTo(1036, 126);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(214,72,63,0.9)';
  ctx.beginPath();
  ctx.arc(998, 109, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Table (left).
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(TABLE_RECT.x + TABLE_RECT.w / 2, TABLE_RECT.y + TABLE_RECT.h + 10, TABLE_RECT.w / 2 + 8, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  const tableTop = ctx.createLinearGradient(TABLE_RECT.x, TABLE_RECT.y, TABLE_RECT.x, TABLE_RECT.y + 14);
  tableTop.addColorStop(0, '#2a3542');
  tableTop.addColorStop(1, '#161d27');
  ctx.fillStyle = tableTop;
  roundRect(ctx, TABLE_RECT.x, TABLE_RECT.y, TABLE_RECT.w, 14, 4);
  ctx.fill();
  ctx.fillStyle = '#0d131b';
  ctx.fillRect(TABLE_RECT.x + 12, TABLE_RECT.y + 14, 12, TABLE_RECT.h - 14);
  ctx.fillRect(TABLE_RECT.x + TABLE_RECT.w - 24, TABLE_RECT.y + 14, 12, TABLE_RECT.h - 14);
  // A small paper clue on the table.
  ctx.save();
  ctx.translate(TABLE_RECT.x + 96, TABLE_RECT.y - 2);
  ctx.rotate(-0.12);
  ctx.fillStyle = 'rgba(210,220,235,0.8)';
  ctx.fillRect(0, 0, 42, 30);
  ctx.fillStyle = 'rgba(30,40,60,0.7)';
  for (let i = 0; i < 4; i++) ctx.fillRect(5, 6 + i * 6, 32 - (i % 2) * 9, 1.6);
  ctx.restore();

  // Door frame (right) — slab is dynamic.
  ctx.fillStyle = '#070b12';
  roundRect(ctx, DOOR_POS.x - 52, 236, 130, 404, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,160,200,0.28)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Switch housing on the wall + label.
  ctx.fillStyle = '#0b1017';
  roundRect(ctx, SWITCH_POS.x - 34, SWITCH_POS.y - 44, 68, 84, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,180,220,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(190,220,245,0.75)';
  ctx.font = '700 8px "Space Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('AUXILIARY', SWITCH_POS.x, SWITCH_POS.y + 56);
  ctx.fillText('ACCESS', SWITCH_POS.x, SWITCH_POS.y + 68);
  ctx.textAlign = 'left';

  // Cable channel from the switch down the wall, across the floor to the box.
  ctx.strokeStyle = 'rgba(10,14,20,0.9)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(SWITCH_POS.x + 30, SWITCH_POS.y + 20);
  ctx.lineTo(SWITCH_POS.x + 30, 330);
  ctx.lineTo(BOX_RECT.x + BOX_RECT.w / 2 + 20, 360);
  ctx.lineTo(BOX_RECT.x + BOX_RECT.w / 2 + 20, BOX_RECT.y + BOX_RECT.h);
  ctx.stroke();

  // Static vignette.
  const vig = ctx.createRadialGradient(VIEW_W / 2, 340, 260, VIEW_W / 2, 400, 860);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  return canvas;
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: string,
  stride: number,
  ghost: boolean,
): void {
  const w = PLAYER_W;
  const h = PLAYER_H;
  const left = x - w / 2;
  const top = y - h;
  ctx.save();
  if (ghost) {
    ctx.globalAlpha = 0.34;
  }
  // Ground shadow.
  ctx.fillStyle = ghost ? 'rgba(60,190,255,0.08)' : 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.ellipse(x, y - 2, w * 0.55, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  const bodyGrad = ctx.createLinearGradient(left, top, left + w, y);
  if (ghost) {
    bodyGrad.addColorStop(0, 'rgba(120,220,255,0.85)');
    bodyGrad.addColorStop(1, 'rgba(40,120,200,0.55)');
  } else {
    bodyGrad.addColorStop(0, '#3d4c60');
    bodyGrad.addColorStop(1, '#1c2431');
  }
  // Legs.
  const swing = Math.sin(stride * Math.PI * 2) * 5;
  ctx.strokeStyle = ghost ? 'rgba(110,200,255,0.8)' : '#141b26';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 20);
  ctx.lineTo(x - 6 + (dir === 'left' || dir === 'right' ? swing : 0), y - 2);
  ctx.moveTo(x + 6, y - 20);
  ctx.lineTo(x + 6 - (dir === 'left' || dir === 'right' ? swing : 0), y - 2);
  ctx.stroke();
  // Torso.
  ctx.fillStyle = bodyGrad;
  roundRect(ctx, left + 3, top + 12, w - 6, h - 30, 8);
  ctx.fill();
  // Head.
  ctx.fillStyle = ghost ? 'rgba(150,230,255,0.9)' : '#2a3546';
  ctx.beginPath();
  ctx.arc(x, top + 8, 10, 0, Math.PI * 2);
  ctx.fill();
  if (!ghost) {
    // Visor hint facing the direction of travel.
    ctx.fillStyle = 'rgba(120,220,255,0.8)';
    const ex = dir === 'left' ? x - 6 : dir === 'right' ? x + 1 : x - 3;
    ctx.fillRect(ex, top + 5, 7, 3);
  }
  // Edge light for ghosts.
  if (ghost) {
    ctx.strokeStyle = 'rgba(140,235,255,0.5)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, left + 3, top + 12, w - 6, h - 30, 8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGlassBox(ctx: CanvasRenderingContext2D, state: LoopState): void {
  const { x, y, w, h } = BOX_RECT;
  // Pedestal base.
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h + 8, w / 2 + 10, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#10161f';
  roundRect(ctx, x - 8, y + h - 10, w + 16, 16, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,180,220,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Access card inside (only when not taken this loop).
  if (state.cardAvailable && !state.hasCard) {
    const glow = 0.55 + 0.35 * Math.sin(Date.now() / 300);
    ctx.save();
    ctx.shadowColor = `rgba(90,210,255,${glow})`;
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#37b6f0';
    roundRect(ctx, x + w / 2 - 22, y + h - 44, 44, 28, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(6,30,50,0.9)';
    ctx.fillRect(x + w / 2 - 16, y + h - 38, 20, 4);
    ctx.restore();
  }

  // Glass panel — slides up when open.
  const openShift = state.boxOpen ? -h * 0.8 : 0;
  const glass = ctx.createLinearGradient(x, y, x + w, y + h);
  glass.addColorStop(0, `rgba(140,210,255,${state.boxUnlocked ? 0.16 : 0.2})`);
  glass.addColorStop(1, `rgba(40,90,140,${state.boxUnlocked ? 0.1 : 0.16})`);
  ctx.fillStyle = glass;
  roundRect(ctx, x, y + openShift, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = state.boxUnlocked ? 'rgba(110,225,255,0.75)' : 'rgba(120,160,200,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Reflection streak.
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.moveTo(x + 12, y + openShift + 4);
  ctx.lineTo(x + 44, y + openShift + 4);
  ctx.lineTo(x + 20, y + openShift + h - 6);
  ctx.lineTo(x - 2, y + openShift + h - 6);
  ctx.closePath();
  ctx.fill();
  // Lock LED.
  ctx.fillStyle = state.boxUnlocked ? 'rgba(90,230,160,0.95)' : 'rgba(214,72,63,0.95)';
  ctx.beginPath();
  ctx.arc(x + w - 12, y + openShift + 12, 3.5, 0, Math.PI * 2);
  ctx.fill();
}


function drawStoryObjects(ctx: CanvasRenderingContext2D, state: LoopState): void {
  // Wall clock — stopped at 03:17.
  const cx = CLOCK_POS.x;
  const cy = CLOCK_POS.y;
  ctx.save();
  ctx.fillStyle = '#080f17';
  ctx.strokeStyle = 'rgba(135,175,210,0.34)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(175,205,225,0.78)';
  ctx.font = '700 7px "Space Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CASE CLOCK', cx, cy - 52);
  ctx.font = '800 12px "Space Mono", monospace';
  ctx.fillStyle = state.investigation.clock ? '#ebc994' : '#9db5c6';
  ctx.fillText('03:17', cx, cy + 4);
  ctx.strokeStyle = 'rgba(235,201,148,0.66)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy - 20);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + 15, cy + 10);
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.restore();

  // Security terminal / case archive.
  const tx = TERMINAL_POS.x - 64;
  const ty = TERMINAL_POS.y - 38;
  ctx.save();
  ctx.fillStyle = '#071019';
  roundRect(ctx, tx, ty, 128, 78, 7);
  ctx.fill();
  ctx.strokeStyle = state.investigation.terminal ? 'rgba(86,225,255,0.62)' : 'rgba(125,160,190,0.34)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = state.investigation.terminal ? 'rgba(50,210,240,0.16)' : 'rgba(30,55,72,0.2)';
  roundRect(ctx, tx + 10, ty + 10, 108, 42, 4);
  ctx.fill();
  ctx.fillStyle = state.investigation.cctv ? '#e8c777' : state.investigation.terminal ? '#72e5ff' : '#668092';
  ctx.font = '800 7px "Space Mono", monospace';
  ctx.fillText(state.investigation.cctv ? 'BADGE 07 / ACTIVE' : state.investigation.terminal ? 'CASE 001 / ACCESS' : 'CASE ARCHIVE / LOCKED', tx + 18, ty + 32);
  ctx.fillStyle = state.hasCard ? 'rgba(90,230,160,0.92)' : 'rgba(214,72,63,0.82)';
  ctx.beginPath();
  ctx.arc(tx + 110, ty + 10, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(170,195,215,0.56)';
  ctx.font = '700 7px "Space Mono", monospace';
  ctx.fillText('SECURITY TERMINAL', tx, ty - 10);
  ctx.restore();

  // Small CCTV status panel beneath the wall camera.
  ctx.save();
  ctx.fillStyle = '#070d14';
  roundRect(ctx, 968, 136, 92, 36, 4);
  ctx.fill();
  ctx.strokeStyle = state.investigation.cctv ? 'rgba(227,196,125,0.55)' : 'rgba(120,160,190,0.22)';
  ctx.stroke();
  ctx.fillStyle = state.investigation.cctv ? '#e6c47d' : '#688293';
  ctx.font = '700 7px "Space Mono", monospace';
  ctx.fillText(state.investigation.cctv ? 'CAM 01 / ARCHIVED' : 'CAM 01 / OFFLINE', 978, 158);
  ctx.restore();

  // Note marker changes once it has been read; after reconstruction the same desk becomes suspicious again.
  ctx.save();
  ctx.fillStyle = state.investigation.note ? 'rgba(220,224,232,0.55)' : 'rgba(245,245,250,0.88)';
  ctx.save();
  ctx.translate(TABLE_RECT.x + 96, TABLE_RECT.y - 2);
  ctx.rotate(-0.12);
  ctx.fillRect(0, 0, 42, 30);
  ctx.restore();
  if (state.investigation.note) {
    ctx.fillStyle = 'rgba(235,196,126,0.9)';
    ctx.font = '800 6px "Space Mono", monospace';
    ctx.fillText('03:17', TABLE_RECT.x + 105, TABLE_RECT.y + 15);
  }
  ctx.restore();

  // Evidence card label inside the glass box.
  if (state.investigation.accessCard) {
    ctx.save();
    ctx.fillStyle = '#c9b078';
    ctx.font = '800 7px "Space Mono", monospace';
    ctx.fillText('ELIAS VANE', BOX_RECT.x + 14, BOX_RECT.y - 12);
    ctx.fillStyle = 'rgba(201,176,120,0.6)';
    ctx.fillText('FACILITY ACCESS / LEVEL 03', BOX_RECT.x + 14, BOX_RECT.y - 2);
    ctx.restore();
  }
}

function drawSwitch(ctx: CanvasRenderingContext2D, state: LoopState): void {
  const on = state.playerSwitchOn || state.ghostSwitchOn;
  // Plate + lever.
  ctx.fillStyle = '#131b26';
  roundRect(ctx, SWITCH_POS.x - 16, SWITCH_POS.y - 18, 32, 40, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,180,220,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = on ? '#57e6ff' : '#d6483f';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(SWITCH_POS.x, SWITCH_POS.y + 8);
  ctx.lineTo(SWITCH_POS.x, SWITCH_POS.y - (on ? 8 : 4));
  ctx.stroke();
  // Indicator light.
  ctx.fillStyle = on ? 'rgba(87,230,255,0.95)' : 'rgba(214,72,63,0.9)';
  ctx.shadowColor = on ? 'rgba(87,230,255,0.9)' : 'rgba(214,72,63,0.8)';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(SWITCH_POS.x, SWITCH_POS.y - 30, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Energized cable glow.
  if (on) {
    ctx.strokeStyle = 'rgba(87,230,255,0.4)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(87,230,255,0.8)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(SWITCH_POS.x + 30, SWITCH_POS.y + 20);
    ctx.lineTo(SWITCH_POS.x + 30, 330);
    ctx.lineTo(BOX_RECT.x + BOX_RECT.w / 2 + 20, 360);
    ctx.lineTo(BOX_RECT.x + BOX_RECT.w / 2 + 20, BOX_RECT.y + BOX_RECT.h);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function drawDoor(ctx: CanvasRenderingContext2D, state: LoopState): void {
  const { x, y } = DOOR_POS;
  const w = 96;
  const h = 366;
  // Warm light from beyond when open.
  if (state.door === 'open') {
    const glow = ctx.createLinearGradient(x, y, x, y + h);
    glow.addColorStop(0, 'rgba(255,214,150,0.85)');
    glow.addColorStop(1, 'rgba(255,180,110,0.4)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 40, y, w + 80, h);
    const spill = ctx.createLinearGradient(0, y + h, 0, y + h + 130);
    spill.addColorStop(0, 'rgba(255,200,130,0.3)');
    spill.addColorStop(1, 'rgba(255,200,130,0)');
    ctx.fillStyle = spill;
    ctx.beginPath();
    ctx.moveTo(x - 50, y + h);
    ctx.lineTo(x + w + 50, y + h);
    ctx.lineTo(x + w + 110, y + h + 130);
    ctx.lineTo(x - 110, y + h + 130);
    ctx.closePath();
    ctx.fill();
  }
  // Slab slides up while opening.
  const slide = state.door === 'open' ? -h * 0.92 : state.door === 'unlocked' ? -h * 0.12 : 0;
  const slab = ctx.createLinearGradient(x, y, x + w, y + h);
  slab.addColorStop(0, '#232f3e');
  slab.addColorStop(0.5, '#141c28');
  slab.addColorStop(1, '#0b1119');
  ctx.fillStyle = slab;
  ctx.fillRect(x, y + Math.min(0, slide * 0.06), w, h + Math.min(0, slide));
  if (state.door !== 'open') {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x + 8, y + 12, w - 16, h - 24);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeRect(x + 8.5, y + 12.5, w - 17, h - 25);
    // Handle + LED.
    ctx.fillStyle = '#39465a';
    roundRect(ctx, x + w - 26, y + h / 2 - 4, 18, 8, 4);
    ctx.fill();
    ctx.fillStyle = state.door === 'unlocked' ? 'rgba(90,230,160,0.95)' : 'rgba(214,72,63,0.95)';
    ctx.shadowColor = state.door === 'unlocked' ? 'rgba(90,230,160,0.9)' : 'rgba(214,72,63,0.9)';
    ctx.shadowBlur = 9;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + 22, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Card slot.
    ctx.fillStyle = '#05080d';
    roundRect(ctx, x + w / 2 - 16, y + 44, 32, 7, 3);
    ctx.fill();
  }
}

function drawLampLight(ctx: CanvasRenderingContext2D, state: LoopState): void {
  const remaining = state.loopLengthMs - state.t;
  let intensity = 0.16;
  if (remaining < WARN_2_MS) {
    intensity = 0.13 + (Math.random() > 0.82 ? 0.05 : 0);
  } else if (remaining < WARN_1_MS) {
    intensity = 0.15 + (Math.random() > 0.9 ? 0.03 : 0);
  }
  const cone = ctx.createRadialGradient(OVERHEAD_LAMP.x, 20, 10, OVERHEAD_LAMP.x, 20, 560);
  cone.addColorStop(0, `rgba(190,225,255,${intensity + 0.14})`);
  cone.addColorStop(0.5, `rgba(160,200,240,${intensity * 0.5})`);
  cone.addColorStop(1, 'rgba(160,200,240,0)');
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(OVERHEAD_LAMP.x - 26, 18);
  ctx.lineTo(OVERHEAD_LAMP.x + 26, 18);
  ctx.lineTo(OVERHEAD_LAMP.x + 430, 660);
  ctx.lineTo(OVERHEAD_LAMP.x - 430, 660);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = cone;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.restore();
  // Lamp housing.
  ctx.fillStyle = '#0b1017';
  roundRect(ctx, OVERHEAD_LAMP.x - 34, 2, 68, 14, 4);
  ctx.fill();
  ctx.fillStyle = `rgba(200,230,255,${0.75 + (Math.random() > 0.92 ? -0.2 : 0)})`;
  ctx.fillRect(OVERHEAD_LAMP.x - 26, 14, 52, 4);
  // Light pool on the floor.
  const pool = ctx.createRadialGradient(OVERHEAD_LAMP.x, 500, 30, OVERHEAD_LAMP.x, 500, 380);
  pool.addColorStop(0, `rgba(170,210,250,${intensity * 0.55})`);
  pool.addColorStop(1, 'rgba(170,210,250,0)');
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.ellipse(OVERHEAD_LAMP.x, 520, 380, 120, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Render one frame of the room from the simulation state. */
export function renderFrame(ctx: CanvasRenderingContext2D, state: LoopState): void {
  if (!background) background = buildBackground();
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.drawImage(background, 0, 0);

  drawLampLight(ctx, state);
  drawStoryObjects(ctx, state);

  // Depth-sorted world: table (static bg) already drawn; box, characters, door.
  const drawables: Array<{ y: number; draw: () => void }> = [
    { y: BOX_RECT.y + BOX_RECT.h, draw: () => drawGlassBox(ctx, state) },
    { y: DOOR_POS.y + 366, draw: () => drawDoor(ctx, state) },
  ];
  for (const ghost of state.ghosts) {
    drawables.push({
      y: sampleRecording(ghost.recording, state.t).y + 1,
      draw: () => {
        // Afterimage trail.
        for (const point of ghost.trail) {
          ctx.globalAlpha = Math.max(0.05, point.a * 0.25);
          drawCharacter(ctx, point.x, point.y, 'right', 0, true);
        }
        ctx.globalAlpha = 1;
        const pos = sampleRecording(ghost.recording, state.t);
        drawCharacter(ctx, pos.x, pos.y, pos.dir, state.t / 240, true);
        ctx.globalAlpha = 1;
      },
    });
  }
  drawables.push({
    y: state.player.y,
    draw: () => {
      drawCharacter(ctx, state.player.x, state.player.y, state.player.dir, state.player.stride, false);
      // Access card peeking from the hip.
      if (state.hasCard) {
        ctx.fillStyle = '#37b6f0';
        roundRect(ctx, state.player.x + 8, state.player.y - 18, 14, 9, 2);
        ctx.fill();
      }
    },
  });
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.draw();

  drawSwitch(ctx, state);

  // A restrained final-corridor clue: footprints and a distant silhouette.
  if (state.door === 'open') {
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = '#c8d6df';
    for (let i = 0; i < 7; i++) {
      const fx = 1122 - i * 30;
      const fy = 600 - i * 26;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(-0.12 + i * 0.04);
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#05070b';
    ctx.beginPath();
    ctx.ellipse(1106, 370, 12, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(1106, 335, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Interact affordance: the React HUD also mirrors this prompt.
  // (Kept minimal: a soft highlight ring under the player when inside a zone.)
  // Reset blackout.
  if (state.phase === 'resetting') {
    const p = Math.min(1, state.resetTimerMs / 600);
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, p * 1.4)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Distortion streaks.
    ctx.fillStyle = `rgba(87,230,255,${0.08 * (1 - p)})`;
    for (let i = 0; i < 6; i++) {
      const y = (Date.now() / 6 + i * 137) % VIEW_H;
      ctx.fillRect(0, y, VIEW_W, 2);
    }
  }

  // Warm success wash while walking out.
  if (state.door === 'open') {
    ctx.fillStyle = 'rgba(255,205,140,0.07)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

/**
 * THE SIGNAL — original "Signal Glyph" alphabet + tile-value rendering.
 *
 * Glyphs G1..G12 are original geometric designs (not borrowed writing
 * systems, not random unicode). Each has a stable id and a vector-style
 * canvas drawing so the 3D tiles, DOM chips and map can all render them.
 */

export const GLYPH_IDS = [
  'G1', 'G2', 'G3', 'G4', 'G5', 'G6',
  'G7', 'G8', 'G9', 'G10', 'G11', 'G12',
] as const;

export type GlyphId = (typeof GLYPH_IDS)[number];

export function isGlyph(value: string): value is GlyphId {
  return (GLYPH_IDS as readonly string[]).includes(value);
}

/** Draws one stroke path of the glyph into ctx, centered at 0,0, radius r. */
function glyphPath(ctx: CanvasRenderingContext2D, id: string, r: number): void {
  ctx.beginPath();
  switch (id) {
    case 'G1': // circle with vertical slit (the "open eye")
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.moveTo(0, -r);
      ctx.lineTo(0, r);
      break;
    case 'G2': // triangle + base bar
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.9, r * 0.7);
      ctx.lineTo(-r * 0.9, r * 0.7);
      ctx.closePath();
      ctx.moveTo(-r, r);
      ctx.lineTo(r, r);
      break;
    case 'G3': // twin peaks
      ctx.moveTo(-r, r * 0.8);
      ctx.lineTo(-r * 0.45, -r * 0.8);
      ctx.lineTo(0, r * 0.2);
      ctx.lineTo(r * 0.45, -r * 0.8);
      ctx.lineTo(r, r * 0.8);
      break;
    case 'G4': // diamond in circle
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.moveTo(0, -r * 0.62);
      ctx.lineTo(r * 0.62, 0);
      ctx.lineTo(0, r * 0.62);
      ctx.lineTo(-r * 0.62, 0);
      ctx.closePath();
      break;
    case 'G5': // trident
      ctx.moveTo(0, r);
      ctx.lineTo(0, -r * 0.3);
      ctx.moveTo(-r * 0.7, -r);
      ctx.lineTo(-r * 0.7, -r * 0.1);
      ctx.arc(0, -r * 0.1, r * 0.7, Math.PI, 0);
      ctx.lineTo(r * 0.7, -r);
      break;
    case 'G6': // half spiral
      ctx.arc(0, 0, r * 0.8, Math.PI * 0.5, Math.PI * 1.9);
      ctx.moveTo(r * 0.8, Math.sin(Math.PI * 1.9) * r * 0.8);
      ctx.lineTo(r, -r * 0.5);
      break;
    case 'G7': // gate
      ctx.moveTo(-r * 0.8, r);
      ctx.lineTo(-r * 0.8, -r * 0.4);
      ctx.arc(0, -r * 0.4, r * 0.8, Math.PI, 0);
      ctx.lineTo(r * 0.8, r);
      break;
    case 'G8': // crossed waves
      ctx.moveTo(-r, -r * 0.5);
      ctx.quadraticCurveTo(-r * 0.4, -r, 0, -r * 0.5);
      ctx.quadraticCurveTo(r * 0.4, 0, r, -r * 0.5);
      ctx.moveTo(-r, r * 0.6);
      ctx.quadraticCurveTo(-r * 0.4, 0, 0, r * 0.6);
      ctx.quadraticCurveTo(r * 0.4, r * 1.1, r, r * 0.6);
      break;
    case 'G9': // stepped ziggurat
      ctx.moveTo(-r, r * 0.9);
      ctx.lineTo(-r * 0.55, r * 0.9);
      ctx.lineTo(-r * 0.55, r * 0.3);
      ctx.lineTo(-r * 0.15, r * 0.3);
      ctx.lineTo(-r * 0.15, -r * 0.3);
      ctx.lineTo(r * 0.25, -r * 0.3);
      ctx.lineTo(r * 0.25, -r * 0.9);
      ctx.lineTo(r, -r * 0.9);
      break;
    case 'G10': // seed of life arc pair
      ctx.arc(-r * 0.4, 0, r * 0.62, 0, Math.PI * 2);
      ctx.moveTo(r * 1.02, 0);
      ctx.arc(r * 0.4, 0, r * 0.62, 0, Math.PI * 2);
      break;
    case 'G11': // bolt
      ctx.moveTo(-r * 0.2, -r);
      ctx.lineTo(r * 0.55, -r * 0.2);
      ctx.lineTo(r * 0.05, -r * 0.1);
      ctx.lineTo(r * 0.5, r);
      ctx.lineTo(-r * 0.55, r * 0.05);
      ctx.lineTo(-r * 0.02, -r * 0.05);
      ctx.closePath();
      break;
    case 'G12': // orbit + core
      ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
      ctx.moveTo(r, 0);
      ctx.arc(0, 0, r, 0, Math.PI * 1.55);
      break;
    default:
      ctx.rect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
  }
}

/** Renders any tile value (letter/digit/symbol/glyph) centered on ctx. */
export function drawTileValue(
  ctx: CanvasRenderingContext2D,
  value: string,
  cx: number,
  cy: number,
  pixelSize: number,
  glow: string,
): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (isGlyph(value)) {
    const r = pixelSize * 0.34;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#f4fcff';
    ctx.lineWidth = Math.max(6, pixelSize * 0.055);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = glow;
    ctx.shadowBlur = pixelSize * 0.06;
    ctx.stroke();
    glyphPath(ctx, value, r);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Letters, digits and simple signs render as type.
  const fontScale = value.length > 1 ? 0.52 : 0.86;
  ctx.font = `800 ${Math.round(pixelSize * fontScale)}px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  ctx.shadowColor = glow;
  ctx.shadowBlur = pixelSize * 0.05;
  ctx.fillStyle = 'rgba(224, 248, 255, 0.95)';
  ctx.fillText(value, cx, cy);
  ctx.shadowBlur = pixelSize * 0.012;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.fillText(value, cx, cy);
  ctx.shadowBlur = 0;
}

/** Small DOM-friendly renderer for target chips and the map. */
export function glyphToSvgPath(id: string, viewBox = 100): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const r = viewBox * 0.36;
  if (!ctx) return '';
  // Reuse the path logic by tracing onto an offscreen context is unreliable for
  // SVG export, so mirror the shapes as SVG path data directly.
  const f = (n: number) => Number(n.toFixed(2));
  const c = viewBox / 2;
  switch (id) {
    case 'G1':
      return `M ${f(c - r)} ${f(c)} A ${f(r)} ${f(r)} 0 1 0 ${f(c + r)} ${f(c)} A ${f(r)} ${f(r)} 0 1 0 ${f(c - r)} ${f(c)} M ${f(c)} ${f(c - r)} L ${f(c)} ${f(c + r)}`;
    case 'G2':
      return `M ${f(c)} ${f(c - r)} L ${f(c + r * 0.9)} ${f(c + r * 0.7)} L ${f(c - r * 0.9)} ${f(c + r * 0.7)} Z M ${f(c - r)} ${f(c + r)} L ${f(c + r)} ${f(c + r)}`;
    case 'G3':
      return `M ${f(c - r)} ${f(c + r * 0.8)} L ${f(c - r * 0.45)} ${f(c - r * 0.8)} L ${f(c)} ${f(c + r * 0.2)} L ${f(c + r * 0.45)} ${f(c - r * 0.8)} L ${f(c + r)} ${f(c + r * 0.8)}`;
    case 'G4':
      return `M ${f(c - r)} ${f(c)} A ${f(r)} ${f(r)} 0 1 0 ${f(c + r)} ${f(c)} A ${f(r)} ${f(r)} 0 1 0 ${f(c - r)} ${f(c)} M ${f(c)} ${f(c - r * 0.62)} L ${f(c + r * 0.62)} ${f(c)} L ${f(c)} ${f(c + r * 0.62)} L ${f(c - r * 0.62)} ${f(c)} Z`;
    case 'G5':
      return `M ${f(c)} ${f(c + r)} L ${f(c)} ${f(c - r * 0.3)} M ${f(c - r * 0.7)} ${f(c - r)} L ${f(c - r * 0.7)} ${f(c - r * 0.1)} A ${f(r * 0.7)} ${f(r * 0.7)} 0 0 1 ${f(c + r * 0.7)} ${f(c - r * 0.1)} L ${f(c + r * 0.7)} ${f(c - r)}`;
    case 'G6':
      return `M ${f(c - r * 0.8)} ${f(c + r * 0.8)} A ${f(r * 0.8)} ${f(r * 0.8)} 0 1 1 ${f(c + r * 0.75)} ${f(c - r * 0.76)} L ${f(c + r)} ${f(c - r * 0.5)}`;
    case 'G7':
      return `M ${f(c - r * 0.8)} ${f(c + r)} L ${f(c - r * 0.8)} ${f(c - r * 0.4)} A ${f(r * 0.8)} ${f(r * 0.8)} 0 0 1 ${f(c + r * 0.8)} ${f(c - r * 0.4)} L ${f(c + r * 0.8)} ${f(c + r)}`;
    case 'G8':
      return `M ${f(c - r)} ${f(c - r * 0.5)} Q ${f(c - r * 0.4)} ${f(c - r)} ${f(c)} ${f(c - r * 0.5)} Q ${f(c + r * 0.4)} ${f(c)} ${f(c + r)} ${f(c - r * 0.5)} M ${f(c - r)} ${f(c + r * 0.6)} Q ${f(c - r * 0.4)} ${f(c)} ${f(c)} ${f(c + r * 0.6)} Q ${f(c + r * 0.4)} ${f(c + r * 1.1)} ${f(c + r)} ${f(c + r * 0.6)}`;
    case 'G9':
      return `M ${f(c - r)} ${f(c + r * 0.9)} L ${f(c - r * 0.55)} ${f(c + r * 0.9)} L ${f(c - r * 0.55)} ${f(c + r * 0.3)} L ${f(c - r * 0.15)} ${f(c + r * 0.3)} L ${f(c - r * 0.15)} ${f(c - r * 0.3)} L ${f(c + r * 0.25)} ${f(c - r * 0.3)} L ${f(c + r * 0.25)} ${f(c - r * 0.9)} L ${f(c + r)} ${f(c - r * 0.9)}`;
    case 'G10':
      return `M ${f(c - r * 0.4 + r * 0.62)} ${f(c)} A ${f(r * 0.62)} ${f(r * 0.62)} 0 1 0 ${f(c - r * 0.4 - r * 0.62)} ${f(c)} A ${f(r * 0.62)} ${f(r * 0.62)} 0 1 0 ${f(c - r * 0.4 + r * 0.62)} ${f(c)} M ${f(c + r)} ${f(c)} A ${f(r)} ${f(r)} 0 1 0 ${f(c + r * 0.4 - r)} ${f(c)} A ${f(r)} ${f(r)} 0 1 0 ${f(c + r)} ${f(c)}`;
    case 'G11':
      return `M ${f(c - r * 0.2)} ${f(c - r)} L ${f(c + r * 0.55)} ${f(c - r * 0.2)} L ${f(c + r * 0.05)} ${f(c - r * 0.1)} L ${f(c + r * 0.5)} ${f(c + r)} L ${f(c - r * 0.55)} ${f(c + r * 0.05)} L ${f(c - r * 0.02)} ${f(c - r * 0.05)} Z`;
    case 'G12':
      return `M ${f(c + r * 0.32)} ${f(c)} A ${f(r * 0.32)} ${f(r * 0.32)} 0 1 0 ${f(c - r * 0.32)} ${f(c)} A ${f(r * 0.32)} ${f(r * 0.32)} 0 1 0 ${f(c + r * 0.32)} ${f(c)} M ${f(c + r)} ${f(c)} A ${f(r)} ${f(r)} 0 1 0 ${f(c + r * 0.11)} ${f(c - r * 0.99)}`;
    default:
      return `M ${f(c - r * 0.7)} ${f(c - r * 0.7)} H ${f(c + r * 0.7)} V ${f(c + r * 0.7)} H ${f(c - r * 0.7)} Z`;
  }
}

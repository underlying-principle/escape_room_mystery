import { useMemo, useRef, useState } from 'react';
import { t } from '../i18n';
import '../styles/signal-level01.css';

/** The slim save shape the map renders from (works with any save service). */
export interface MapSave {
  highestUnlocked: number;
  completed: Record<string, { stars: number }>;
}

/**
 * THE SIGNAL MAP — map-only build. The 60 playable levels are retired (the
 * full game lives on GitHub); the map remains as the showcase: all 60 nodes,
 * their connecting paths and the six chapter regions, exactly as they were.
 */

interface MapLevel {
  id: string;
  index: number;
  chapter: number;
  name: string;
}

interface MapNode {
  def: MapLevel;
  x: number;
  y: number;
}

const REGION_COLORS: Record<number, string> = {
  1: '#4ee1ff',
  2: '#f7bd4a',
  3: '#bc72ff',
  4: '#43e9c8',
  5: '#ff9d5c',
  6: '#ffe66d',
};

const REGION_NAMES: Record<number, { name: string; tag: string }> = {
  1: { name: 'THE SIGNAL', tag: 'ACTIVATE THE NETWORK' },
  2: { name: 'THE VAULT', tag: 'OPEN THE SEALED ARCHIVE' },
  3: { name: 'THE MIRROR', tag: 'REFLECTION TELLS THE TRUTH' },
  4: { name: 'THE DEPTHS', tag: 'DIVE UNTIL IT GOES DARK' },
  5: { name: 'THE STORM', tag: 'RIDE THE TEMPEST' },
  6: { name: 'THE ORIGIN', tag: 'THE OLDEST SIGNAL SPEAKS' },
};

const REGION_CENTERS: Array<{ x: number; y: number }> = [
  { x: 0, y: 0 },
  { x: 1250, y: -260 },
  { x: 2500, y: 120 },
  { x: 3750, y: -320 },
  { x: 5000, y: 260 },
  { x: 6250, y: -80 },
];

/** Lightweight level stubs — just enough for the map to draw all 60 nodes. */
function buildLevels(): MapLevel[] {
  return Array.from({ length: 60 }, (_, i) => {
    const index = i + 1;
    const chapter = Math.ceil(index / 10);
    return {
      id: `S${String(index).padStart(2, '0')}`,
      index,
      chapter,
      name: REGION_NAMES[chapter].name,
    };
  });
}

function buildNodes(levels: MapLevel[]): MapNode[] {
  const nodes: MapNode[] = [];
  for (const def of levels) {
    const region = REGION_CENTERS[def.chapter - 1];
    const k = (def.index - 1) % 10; // 0..9 within chapter
    // Even x spacing keeps neighbours exactly 115px apart — with 62px gate
    // nodes that guarantees no two levels can ever overlap on screen. The
    // organic feel comes from the y wobble only.
    const x = region.x - 520 + k * 115;
    const y = region.y + Math.sin(k * 1.35) * 150 + Math.cos(def.index * 1.7) * 55;
    nodes.push({ def, x, y });
  }
  return nodes;
}

function starString(stars: number): string {
  return '★'.repeat(stars) + '☆'.repeat(3 - stars);
}

export default function SignalMap({
  save,
}: {
  save: MapSave;
}) {
  const levels = useMemo(buildLevels, []);
  const nodes = useMemo(() => buildNodes(levels), [levels]);
  const target = nodes[Math.min(save.highestUnlocked, levels.length) - 1] ?? nodes[0];
  // Every time the map opens it centers on the player's current level, so
  // there is never a long drag to reach where they actually are. The focal
  // point leans 70% toward the node and 30% toward the world's middle so the
  // world's title stays in frame, and sits at 44% viewport height so
  // below-world titles clear the footer.
  const [pan, setPan] = useState(() => {
    const currentIdx = Math.min(save.highestUnlocked, levels.length) - 1;
    const worldY = REGION_CENTERS[Math.min(5, Math.max(0, Math.floor(currentIdx / 10)))]?.y ?? 0;
    const focalY = (target?.y ?? 0) * 0.7 + worldY * 0.3;
    const focalX = target?.x ?? 0;
    const base =
      typeof window !== 'undefined'
        ? {
            x: window.innerWidth / 2 - focalX * 0.85,
            y: window.innerHeight * 0.44 - focalY * 0.85,
            zoom: 0.85,
          }
        : { x: -focalX * 0.85, y: -focalY * 0.85, zoom: 0.85 };
    return clampPan(base, window.innerWidth, window.innerHeight);
  });
  const worldRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);
  const panRef = useRef(pan);
  panRef.current = pan;

  // Clamp so the map can never be dragged fully out of view.
  // NOTE: no wheel or pinch zoom — the page cannot be zoomed, only panned.
  function clampPan(p: { x: number; y: number; zoom: number }, vw = window.innerWidth, vh = window.innerHeight) {
    const zoom = 0.85;
    // World spans roughly x −600..7000, y −900..1700 (nodes, labels, paths).
    const worldW = 7600 * zoom;
    const worldH = 2600 * zoom;
    const minX = Math.min(300, vw - worldW + 400);
    const maxX = Math.max(minX, vw * 0.6);
    const minY = Math.min(200, vh - worldH + 500);
    // The ceiling stays loose enough that centering the current node in the
    // middle of the viewport is never clamped away.
    const maxY = Math.max(minY, vh * 0.78);
    return {
      zoom,
      x: Math.min(maxX, Math.max(minX, p.x)),
      y: Math.min(maxY, Math.max(minY, p.y)),
    };
  }

  const clamp = (p: { x: number; y: number; zoom: number }) => clampPan(p);

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y, moved: false };
    // NOTE: no setPointerCapture here — capturing during pointerdown retargets
    // the subsequent `click` to the container, so node buttons never receive it.
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 6) {
      drag.moved = true;
      // Capture only once a pan is genuinely underway — taps stay clickable.
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (drag.moved) {
      const next = clamp({ ...panRef.current, x: drag.panX + dx, y: drag.panY + dy, zoom: pan.zoom });
      setPan(next);
    }
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const completedPath = levels.map((d) => Boolean(save.completed[d.id]));

  return (
    <main
      className="signal-map"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="application"
      aria-label="The Signal Map — drag to pan"
    >
      <div
        className="map-world"
        ref={worldRef}
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${pan.zoom})` }}
      >
        {/* Per-world ambient color fields — huge, soft radial blobs that
            overlap so neighbouring worlds dissolve into each other.
            Stationary by design: no animated motifs. */}
        <div className="map-bg" aria-hidden>
          {REGION_CENTERS.map((center, i) => (
            <div
              key={i}
              className="map-bg-blob"
              style={{ left: center.x, top: center.y, '--blob': REGION_COLORS[i + 1] } as React.CSSProperties}
            />
          ))}
        </div>
        {Object.entries(REGION_NAMES).map(([ch, info]) => {
          const chapter = Number(ch);
          const center = REGION_CENTERS[chapter - 1];
          // Odd worlds title the path from above, even worlds from below —
          // anchored to each world's real node bounds so the title always
          // hugs its world instead of floating off in the void.
          const above = chapter % 2 === 1;
          const ys = nodes.filter((n) => n.def.chapter === chapter).map((n) => n.y);
          const top = above ? Math.min(...ys) - 165 : Math.max(...ys) + 72;
          return (
            <div
              key={ch}
              className={`map-region-label${above ? ' label-above' : ' label-below'}`}
              style={{ left: center.x - 320, top, '--accent': REGION_COLORS[chapter] } as React.CSSProperties}
            >
              <small>WORLD 0{ch}</small>
              <strong>{info.name}</strong>
              <span>{info.tag}</span>
            </div>
          );
        })}
        <svg className="map-paths" width={7600} height={2600} viewBox="-600 -900 7600 2600">
          {nodes.slice(1).map((n, i) => {
            const prev = nodes[i];
            const active = completedPath[i];
            return (
              <line
                key={i}
                x1={prev.x}
                y1={prev.y}
                x2={n.x}
                y2={n.y}
                stroke={active ? REGION_COLORS[n.def.chapter] : '#12303e'}
                strokeWidth={active ? 3 : 1.5}
                opacity={active ? 0.85 : 0.5}
                className={active ? 'path-active' : ''}
              />
            );
          })}
        </svg>
        {nodes.map((n) => {
          const def = n.def;
          const best: { stars: number } | undefined = save.completed[def.id];
          const unlocked = def.index <= save.highestUnlocked;
          const isGate = def.index % 10 === 0;
          const isCurrent = def.index === Math.min(save.highestUnlocked, levels.length);
          const accent = REGION_COLORS[def.chapter];
          return (
            <button
              key={def.id}
              className={`map-node${best ? ' complete' : ''}${unlocked ? '' : ' locked'}${isGate ? ' gate' : ''}`}
              style={{ left: n.x, top: n.y, '--accent': accent } as React.CSSProperties}
              aria-label={`Level ${def.index}: ${def.name}${unlocked ? '' : ' (locked)'}`}
            >
              <b>{String(def.index).padStart(2, '0')}</b>
              {best && best.stars >= 3 && <span className="node-stars">★★★</span>}
              {isCurrent && <span className="node-current-ring" />}
            </button>
          );
        })}
      </div>

      <footer className="map-footer">
        <span>{t('mapStabilized', { n: Object.keys(save.completed).length })}</span>
        <span>{t('dragToPan')}</span>
        <span>{t('highestUnlocked', { n: String(save.highestUnlocked).padStart(2, '0') })}</span>
      </footer>
    </main>
  );
}

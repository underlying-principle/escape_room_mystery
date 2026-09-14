import * as THREE from 'three';
import type { LevelGraph } from '../engine/graphLayout';
import { createBackdrop, type BackdropHandle } from './backdrop';

export interface BoardView {
  words: string[];
  targets: string[];
  lockedPositions: number[][];
  selected: { slot: number; position: number } | null;
  hint: { slot: number; position: number } | null;
  world: 1 | 2 | 3 | 4 | 5 | 6;
  reducedMotion: boolean;
  /** Themed real-place scene id (glacier, library, volcano…). */
  backdrop: string;
  /** The level's playable word-graph constellation. */
  graph: LevelGraph | null;
  /** State key of the player's current position in the graph. */
  activeKey: string;
  /** State keys the player has walked through, in order. */
  trailKeys: string[];
  /** Edge just traversed — a pulse rides it. */
  lastEdge: { a: string; b: string } | null;
  /** After winning: reveal the optimal route through the constellation. */
  reveal: boolean;
}

export interface BoardController {
  setBoard(view: BoardView): void;
  setRevealKeys(keys: string[]): void;
  dispose(): void;
}

interface Tile {
  group: THREE.Group;
  plate: THREE.Mesh<THREE.BoxGeometry, THREE.MeshPhysicalMaterial>;
  edge: THREE.LineSegments;
  letter: THREE.Sprite;
  lock: THREE.Sprite;
  slot: number;
  pos: number;
  baseX: number;
  baseY: number;
  pulse: number;
  previousLetter: string;
}

const WORLD_COLORS: Record<number, THREE.Color> = {
  1: new THREE.Color('#4ee1ff'),
  2: new THREE.Color('#f7bd4a'),
  3: new THREE.Color('#bc72ff'),
  4: new THREE.Color('#43e97b'),
  5: new THREE.Color('#ff6b6b'),
  6: new THREE.Color('#ffe66d'),
};

function worldColor(world: number): THREE.Color {
  return WORLD_COLORS[world] ?? WORLD_COLORS[1];
}

function makeTextTexture(text: string, sub = ''): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#9feaff';
  ctx.shadowBlur = 22;
  ctx.fillStyle = '#f4fdff';
  ctx.font = '800 150px Inter, system-ui, sans-serif';
  ctx.fillText(text, 128, sub ? 116 : 130);
  if (sub) {
    ctx.shadowBlur = 8;
    ctx.font = '700 25px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.68)';
    ctx.fillText(sub, 128, 215);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

function makeLockTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const ctx = c.getContext('2d')!;
  ctx.strokeStyle = '#07101b';
  ctx.fillStyle = '#f7bd4a';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(48, 36, 20, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(20, 36, 56, 44, 9);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.32)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createTile(slot: number, pos: number, color: THREE.Color): Tile {
  const group = new THREE.Group();
  const geom = new THREE.BoxGeometry(1.34, 1.55, 0.24, 1, 1, 1);
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#101d2d',
    roughness: 0.29,
    metalness: 0.42,
    transparent: true,
    opacity: 0.96,
    emissive: color.clone().multiplyScalar(0.06),
    emissiveIntensity: 1,
    clearcoat: 0.8,
    clearcoatRoughness: 0.25,
  });
  const plate = new THREE.Mesh(geom, mat);
  plate.castShadow = true;
  plate.receiveShadow = true;
  plate.userData = { slot, pos };
  group.add(plate);

  const edges = new THREE.EdgesGeometry(geom);
  const edge = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 }),
  );
  edge.position.z = 0.005;
  group.add(edge);

  const tex = makeTextTexture('?');
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(1.1, 1.1, 1);
  sprite.position.z = 0.15;
  group.add(sprite);

  const lockTex = makeLockTexture();
  const lock = new THREE.Sprite(new THREE.SpriteMaterial({ map: lockTex, transparent: true, depthTest: false }));
  lock.scale.set(0.3, 0.3, 1);
  lock.position.set(0.45, 0.57, 0.18);
  lock.visible = false;
  group.add(lock);

  return {
    group,
    plate,
    edge,
    letter: sprite,
    lock,
    slot,
    pos,
    baseX: 0,
    baseY: 0,
    pulse: 0,
    previousLetter: '?',
  };
}

/** The animated word-graph constellation rendered behind the tiles. */
class Constellation {
  group = new THREE.Group();
  private glowTex = makeGlowTexture();
  private nodeSprites: THREE.Sprite[] = [];
  private nodePositions: THREE.Vector3[] = [];
  private edgeLines: THREE.LineSegments | null = null;
  private trailLine: THREE.Line | null = null;
  private revealLine: THREE.Line | null = null;
  private markers: THREE.Object3D[] = [];
  private graph: LevelGraph | null = null;
  private activeIdx = -1;
  private revealKeys = new Set<string>();
  private pulse: { t: number; a: THREE.Vector3; b: THREE.Vector3 } | null = null;
  private pulseDot: THREE.Sprite;
  private sceneRef: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.sceneRef = scene;
    scene.add(this.group);
    this.pulseDot = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: '#ffffff',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.pulseDot.scale.setScalar(0.9);
    scene.add(this.pulseDot);
  }

  private layout(graph: LevelGraph, aspect: number) {
    const rng = mulberry32(hashSeed(graph.nodes.map((n) => n.key).join('') + graph.edges.length));
    this.nodePositions = graph.nodes.map((node, i) => {
      const ringGap = graph.maxDepth > 0 ? 5.2 / graph.maxDepth : 2;
      const radius = node.isStart ? 0 : Math.min(1.7 + node.depth * ringGap, 6.6);
      const angle = hashSeed(node.key) * 2.399963 + node.depth * 0.55 + rng() * 0.5;
      const jitter = 0.55 + rng() * 0.5;
      return new THREE.Vector3(
        Math.cos(angle) * radius * (1 + jitter * 0.12),
        Math.sin(angle) * radius * 0.62 + (i % 3 - 1) * 0.12 + 0.2,
        -3.4 - (node.depth % 3) - rng() * 1.6,
      );
    });
    void aspect;
  }

  setGraph(graph: LevelGraph | null, aspect: number) {
    const sameGraph = graph === this.graph;
    if (!sameGraph) {
      this.disposeGraphObjects();
      this.graph = graph;
      this.revealKeys.clear();
      this.activeIdx = -1;
      if (graph) {
        this.layout(graph, aspect);
        for (const _ of graph.nodes) {
          void _;
          const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: this.glowTex,
              color: '#8fd8ef',
              transparent: true,
              opacity: 0.5,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          );
          sprite.scale.setScalar(0.34);
          this.group.add(sprite);
          this.nodeSprites.push(sprite);
        }
        const pos = new Float32Array(graph.edges.length * 6);
        graph.edges.forEach((e, i) => {
          const a = this.positionOf(e.a);
          const b = this.positionOf(e.b);
          if (!a || !b) return;
          pos[i * 6] = a.x;
          pos[i * 6 + 1] = a.y;
          pos[i * 6 + 2] = a.z;
          pos[i * 6 + 3] = b.x;
          pos[i * 6 + 4] = b.y;
          pos[i * 6 + 5] = b.z;
        });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.edgeLines = new THREE.LineSegments(
          geo,
          new THREE.LineBasicMaterial({ color: '#4a7f96', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
        );
        this.group.add(this.edgeLines);

        // start / target markers
        const startNode = graph.nodes.find((n) => n.isStart);
        const targetNode = graph.nodes.find((n) => n.isTarget);
        if (startNode) {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.3, 0.4, 32),
            new THREE.MeshBasicMaterial({ color: '#9feaff', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
          );
          ring.position.copy(this.positionOf(startNode.key)!);
          this.group.add(ring);
          this.markers.push(ring);
        }
        if (targetNode) {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.38, 0.52, 4),
            new THREE.MeshBasicMaterial({ color: '#ffd76e', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
          );
          ring.position.copy(this.positionOf(targetNode.key)!);
          this.group.add(ring);
          this.markers.push(ring);
        }
      }
    }
  }

  private positionOf(key: string): THREE.Vector3 | null {
    if (!this.graph) return null;
    const idx = this.graph.index.get(key);
    if (idx === undefined) return null;
    return this.nodePositions[idx] ?? null;
  }

  setActive(key: string) {
    if (!this.graph) return;
    this.activeIdx = this.graph.index.get(key) ?? -1;
  }

  setTrail(keys: string[]) {
    if (!this.graph) return;
    if (this.trailLine) {
      this.group.remove(this.trailLine);
      this.trailLine.geometry.dispose();
      (this.trailLine.material as THREE.Material).dispose();
      this.trailLine = null;
    }
    const pts: number[] = [];
    for (let i = 0; i < keys.length - 1; i++) {
      const a = this.positionOf(keys[i]);
      const b = this.positionOf(keys[i + 1]);
      if (a && b) pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    if (pts.length === 0) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    this.trailLine = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: '#bfefff', transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.group.add(this.trailLine);
  }

  setReveal(keys: string[], on: boolean) {
    if (!this.graph) return;
    if (this.revealLine) {
      this.group.remove(this.revealLine);
      this.revealLine.geometry.dispose();
      (this.revealLine.material as THREE.Material).dispose();
      this.revealLine = null;
    }
    this.revealKeys.clear();
    if (!on) return;
    keys.forEach((k) => this.revealKeys.add(k));
    const pts: number[] = [];
    for (let i = 0; i < keys.length - 1; i++) {
      const a = this.positionOf(keys[i]);
      const b = this.positionOf(keys[i + 1]);
      if (a && b) pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    if (pts.length === 0) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    this.revealLine = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: '#ffd76e', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.group.add(this.revealLine);
  }

  firePulse(aKey: string, bKey: string) {
    const a = this.positionOf(aKey);
    const b = this.positionOf(bKey);
    if (!a || !b) return;
    this.pulse = { t: 0, a: a.clone(), b: b.clone() };
  }

  update(dt: number, elapsed: number, accent: THREE.Color) {
    // node breathing + active highlight
    for (let i = 0; i < this.nodeSprites.length; i++) {
      const sprite = this.nodeSprites[i];
      const mat = sprite.material as THREE.SpriteMaterial;
      const isActive = i === this.activeIdx;
      const inReveal = this.revealKeys.has(this.graph?.nodes[i]?.key ?? '');
      const base = isActive ? 0.42 : inReveal ? 0.3 : 0.14;
      mat.opacity = base + Math.sin(elapsed * 1.4 + i * 1.7) * 0.06 + (isActive ? 0.25 : 0);
      sprite.position.copy(this.nodePositions[i]);
      sprite.position.y += Math.sin(elapsed * 0.7 + i * 2.1) * 0.05;
      sprite.scale.setScalar((isActive ? 0.66 : inReveal ? 0.44 : 0.3) + Math.sin(elapsed * 2 + i) * 0.02);
      mat.color.copy(isActive ? accent : inReveal ? new THREE.Color('#ffd76e') : new THREE.Color('#8fd8ef'));
    }
    for (const marker of this.markers) {
      marker.rotation.z += dt * (marker instanceof THREE.Mesh && marker.geometry instanceof THREE.RingGeometry ? 0.4 : 0.8);
      const mat = (marker as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.opacity = 0.55 + 0.25 * Math.sin(elapsed * 2.2);
    }
    if (this.pulse) {
      this.pulse.t += dt * 1.8;
      const t = Math.min(this.pulse.t, 1);
      this.pulseDot.position.lerpVectors(this.pulse.a, this.pulse.b, t);
      (this.pulseDot.material as THREE.SpriteMaterial).opacity = Math.sin(t * Math.PI) * 0.95;
      (this.pulseDot.material as THREE.SpriteMaterial).color.copy(accent);
      if (this.pulse.t >= 1) {
        this.pulse = null;
        (this.pulseDot.material as THREE.SpriteMaterial).opacity = 0;
      }
    }
  }

  private disposeGraphObjects() {
    for (const s of this.nodeSprites) {
      (s.material as THREE.SpriteMaterial).dispose();
      this.group.remove(s);
    }
    this.nodeSprites = [];
    if (this.edgeLines) {
      this.edgeLines.geometry.dispose();
      (this.edgeLines.material as THREE.Material).dispose();
      this.group.remove(this.edgeLines);
      this.edgeLines = null;
    }
    this.setTrail([]);
    this.setReveal([], false);
    for (const m of this.markers) {
      (m as THREE.Mesh).geometry.dispose();
      ((m as THREE.Mesh).material as THREE.Material).dispose();
      this.group.remove(m);
    }
    this.markers = [];
  }

  dispose() {
    this.disposeGraphObjects();
    (this.pulseDot.material as THREE.SpriteMaterial).dispose();
    this.sceneRef.remove(this.pulseDot);
    this.glowTex.dispose();
    this.sceneRef.remove(this.group);
  }
}

export function createWordScene(
  mount: HTMLElement,
  onSelect: (slot: number, position: number) => void,
): BoardController {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
  let camZ = 11;
  camera.position.set(0, 0, camZ);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  mount.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight('#c8efff', '#060811', 2.0));
  const key = new THREE.DirectionalLight('#8eeaff', 5.0);
  key.position.set(-3, 5, 8);
  key.castShadow = true;
  scene.add(key);
  const rim = new THREE.PointLight('#bc72ff', 20, 40);
  rim.position.set(5, -2, 5);
  scene.add(rim);

  let backdrop = createBackdrop(scene, 'arctic');
  let backdropId = 'arctic';
  const constellation = new Constellation(scene);

  const tiles: Tile[] = [];
  const chains: Array<{ line: THREE.Line; slot: number }> = [];
  let view: BoardView = {
    words: [],
    targets: [],
    lockedPositions: [],
    selected: null,
    hint: null,
    world: 1,
    reducedMotion: false,
    backdrop: 'arctic',
    graph: null,
    activeKey: '',
    trailKeys: [],
    lastEdge: null,
    reveal: false,
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const clock = new THREE.Clock();
  let frame = 0;
  let disposed = false;
  let revealKeys: string[] = [];
  let lastFiredEdge: { a: string; b: string } | null = null;

  function resize() {
    const rect = mount.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    fitCamera();
    camera.updateProjectionMatrix();
    constellation.setGraph(view.graph, camera.aspect);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(mount);

  function boardExtents() {
    const lengths = view.words.map((w) => w.length);
    const maxLen = Math.max(...lengths, 4);
    const gap = maxLen >= 5 ? 1.42 : 1.58;
    const halfW = ((maxLen - 1) / 2) * gap + 1.1;
    // Two-slot boards must clear the ~top quarter of the screen (HUD, title,
    // target chips), so reserve extra vertical world height before fitting.
    const halfH = view.words.length > 1 ? 4.0 : 1.6;
    return { gap, halfW, halfH };
  }

  function fitCamera() {
    const { halfW, halfH } = boardExtents();
    const vFov = (camera.fov * Math.PI) / 180;
    // Distances that fit the board horizontally and vertically with margin.
    const distH = halfW / (Math.tan(vFov / 2) * Math.max(camera.aspect, 0.2));
    const distV = halfH / Math.tan(vFov / 2);
    camZ = Math.max(9, distH * 1.06, distV * 1.12);
    camera.position.set(0, 0, camZ);
    camera.lookAt(0, 0, 0);
  }

  function setLetter(tile: Tile, letter: string, color: THREE.Color) {
    if (tile.previousLetter === letter) return;
    const mat = tile.letter.material as THREE.SpriteMaterial;
    mat.map?.dispose();
    const tex = makeTextTexture(letter.toUpperCase());
    mat.map = tex;
    mat.needsUpdate = true;
    tile.previousLetter = letter;
    tile.pulse = 1;
    tile.group.rotation.x = view.reducedMotion ? 0 : -0.45;
    tile.plate.material.emissive.copy(color).multiplyScalar(0.25);
  }

  function reconcile() {
    const count = view.words.reduce((n, w) => n + w.length, 0);
    while (tiles.length < count) {
      const i = tiles.length;
      const t = createTile(0, i, worldColor(view.world));
      tiles.push(t);
      scene.add(t.group);
    }
    while (tiles.length > count) {
      const t = tiles.pop()!;
      scene.remove(t.group);
      t.plate.geometry.dispose();
      t.plate.material.dispose();
      t.edge.geometry.dispose();
      (t.edge.material as THREE.Material).dispose();
      (t.letter.material as THREE.SpriteMaterial).map?.dispose();
      (t.letter.material as THREE.Material).dispose();
      (t.lock.material as THREE.SpriteMaterial).map?.dispose();
      (t.lock.material as THREE.Material).dispose();
    }

    const { gap } = boardExtents();
    const color = worldColor(view.world);
    let idx = 0;
    for (let s = 0; s < view.words.length; s++) {
      const word = view.words[s];
      // Single slot sits at the exact vertical center; two slots mirror evenly.
      const y = view.words.length === 1 ? 0 : s === 0 ? 1.05 : -1.05;
      for (let p = 0; p < word.length; p++) {
        const t = tiles[idx++];
        t.slot = s;
        t.pos = p;
        t.plate.userData = { slot: s, pos: p };
        t.baseX = (p - (word.length - 1) / 2) * gap;
        t.baseY = y;
        t.group.position.set(t.baseX, t.baseY, 0);
        const locked = view.lockedPositions[s]?.includes(p) ?? false;
        t.lock.visible = locked;
        setLetter(t, word[p], color);
        (t.edge.material as THREE.LineBasicMaterial).color.copy(color);
      }
    }

    // Letter chains: connect the tiles of each slot so the word reads as one
    // linked circuit instead of isolated squares.
    for (const c of chains) {
      scene.remove(c.line);
      c.line.geometry.dispose();
      (c.line.material as THREE.Material).dispose();
    }
    chains.length = 0;
    idx = 0;
    for (let s = 0; s < view.words.length; s++) {
      const len = view.words[s].length;
      if (len < 2) {
        idx += len;
        continue;
      }
      const pts: number[] = [];
      for (let p = 0; p < len; p++) {
        const t = tiles[idx + p];
        pts.push(t.baseX, t.baseY, -0.3);
      }
      idx += len;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
      const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      line.userData.slot = s;
      scene.add(line);
      chains.push({ line, slot: s });
    }
  }

  function setBoard(next: BoardView) {
    const graphChanged = next.graph !== view.graph;
    const backdropChanged = next.backdrop !== backdropId;
    const layoutChanged =
      graphChanged ||
      next.words.length !== view.words.length ||
      next.words.some((w, i) => w.length !== view.words[i]?.length) ||
      next.world !== view.world;
    view = next;
    if (backdropChanged) {
      backdrop.dispose();
      backdrop = createBackdrop(scene, view.backdrop);
      backdropId = view.backdrop;
    }
    if (layoutChanged) reconcile();
    if (graphChanged) {
      constellation.setGraph(view.graph, camera.aspect);
      constellation.setTrail(view.trailKeys);
      constellation.setActive(view.activeKey);
      constellation.setReveal(view.reveal ? revealKeys : [], view.reveal);
    } else {
      constellation.setTrail(view.trailKeys);
      constellation.setActive(view.activeKey);
      constellation.setReveal(view.reveal ? revealKeys : [], view.reveal);
      if (view.lastEdge && view.lastEdge !== lastFiredEdge) {
        lastFiredEdge = view.lastEdge;
        constellation.firePulse(view.lastEdge.a, view.lastEdge.b);
      }
    }
    resize();
  }

  function pick(event: PointerEvent) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((event.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(tiles.map((t) => t.plate), false)[0];
    if (hit) {
      const { slot, pos } = hit.object.userData as { slot: number; pos: number };
      onSelect(slot, pos);
    }
  }
  renderer.domElement.addEventListener('pointerup', pick);

  function animate() {
    if (disposed) return;
    frame = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 1 / 20);
    const elapsed = clock.elapsedTime;
    const color = worldColor(view.world);

    backdrop.update(dt, elapsed);
    constellation.update(dt, elapsed, color);

    for (const t of tiles) {
      const selected = view.selected?.slot === t.slot && view.selected.position === t.pos;
      const hinted = view.hint?.slot === t.slot && view.hint.position === t.pos;
      const wave = view.reducedMotion ? 0 : Math.sin(elapsed * 1.3 + t.pos * 0.65 + t.slot) * 0.018;
      t.group.position.y = t.baseY + wave + (selected ? 0.12 : 0);
      const desiredScale = selected ? 1.09 : hinted ? 1.045 + Math.sin(elapsed * 5) * 0.025 : 1;
      const k = 1 - Math.exp(-dt * 13);
      t.group.scale.lerp(new THREE.Vector3(desiredScale, desiredScale, desiredScale), k);
      t.group.rotation.x *= Math.exp(-dt * 10);
      t.pulse = Math.max(0, t.pulse - dt * 2.5);
      const emissiveFactor = selected ? 0.38 : hinted ? 0.28 : 0.06 + t.pulse * 0.3;
      t.plate.material.emissive.lerp(color.clone().multiplyScalar(emissiveFactor), k);
      t.plate.material.color.lerp(new THREE.Color(selected ? '#17364c' : '#101d2d'), k);
      (t.edge.material as THREE.LineBasicMaterial).opacity = selected ? 0.95 : hinted ? 0.72 : 0.35;
    }

    for (const c of chains) {
      const flash = Math.max(...tiles.filter((t) => t.slot === c.slot).map((t) => t.pulse), 0);
      (c.line.material as THREE.LineBasicMaterial).opacity = 0.22 + flash * 0.5;
      (c.line.material as THREE.LineBasicMaterial).color.copy(color);
    }

    renderer.render(scene, camera);
  }
  animate();

  return {
    setBoard,
    setRevealKeys(keys: string[]) {
      revealKeys = keys;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerup', pick);
      constellation.dispose();
      backdrop.dispose();
      tiles.forEach((t) => {
        t.plate.geometry.dispose();
        t.plate.material.dispose();
        t.edge.geometry.dispose();
        (t.edge.material as THREE.Material).dispose();
        (t.letter.material as THREE.SpriteMaterial).map?.dispose();
        (t.letter.material as THREE.Material).dispose();
        (t.lock.material as THREE.SpriteMaterial).map?.dispose();
        (t.lock.material as THREE.Material).dispose();
      });
      for (const c of chains) {
        c.line.geometry.dispose();
        (c.line.material as THREE.Material).dispose();
      }
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

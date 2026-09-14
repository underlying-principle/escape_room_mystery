/**
 * Procedural level backdrops — a real-place scene per level (glacier,
 * library, volcano, storm, observatory…), built from layered silhouettes,
 * a living sky gradient, ambient particles and one subtle special effect.
 * Everything is generated at load (no image assets), seeded per scene id for
 * determinism, and animated with delta time.
 */
import * as THREE from 'three';

export interface BackdropHandle {
  update(dt: number, elapsed: number): void;
  dispose(): void;
}

interface ScenePreset {
  skyTop: number;
  skyBottom: number;
  glow: number;
  silhouette: number;
  shapes: Array<'ridges' | 'skyline' | 'pines' | 'shelves' | 'crystals' | 'waves' | 'dunes' | 'dome' | 'planet' | 'rings' | 'vortex' | 'plexus'>;
  particle: 'snow' | 'ember' | 'bubble' | 'firefly' | 'dust' | 'rain' | 'star' | 'spark' | 'mote';
  particleColor: number;
  special?: 'aurora' | 'beam' | 'lightning' | 'moon' | 'core' | 'shooting' | 'sun';
  specialColor?: number;
}

const PRESETS: Record<string, ScenePreset> = {
  temple:      { skyTop: 0x0b1e17, skyBottom: 0x03080a, glow: 0x1f5c3d, silhouette: 0x04120c, shapes: ['pines', 'ridges'], particle: 'firefly', particleColor: 0xbaff70, special: 'moon', specialColor: 0xd6ffe0 },
  arctic:      { skyTop: 0x0a1a33, skyBottom: 0x04070f, glow: 0x1d4e7a, silhouette: 0x081524, shapes: ['ridges'], particle: 'snow', particleColor: 0xcfe9ff },
  glacier:     { skyTop: 0x06203a, skyBottom: 0x030609, glow: 0x2a7f9e, silhouette: 0x07131f, shapes: ['ridges'], particle: 'snow', particleColor: 0xdff4ff, special: 'aurora', specialColor: 0x54ffc8 },
  library:     { skyTop: 0x241607, skyBottom: 0x0a0502, glow: 0x8a5a1e, silhouette: 0x140c04, shapes: ['shelves'], particle: 'dust', particleColor: 0xffd98a },
  icecave:     { skyTop: 0x071e2c, skyBottom: 0x020608, glow: 0x1e6f8f, silhouette: 0x06141d, shapes: ['crystals'], particle: 'snow', particleColor: 0xbfeeff, special: 'core', specialColor: 0x66e0ff },
  archive:     { skyTop: 0x170f24, skyBottom: 0x070310, glow: 0x5a3f8f, silhouette: 0x0e0818, shapes: ['shelves'], particle: 'dust', particleColor: 0xcabfff },
  citynight:   { skyTop: 0x0c1230, skyBottom: 0x05060f, glow: 0x3a4a8f, silhouette: 0x070a18, shapes: ['skyline'], particle: 'star', particleColor: 0xaec6ff, special: 'moon', specialColor: 0xdfe8ff },
  volcano:     { skyTop: 0x2a0b08, skyBottom: 0x0a0203, glow: 0x9e2a14, silhouette: 0x120404, shapes: ['ridges'], particle: 'ember', particleColor: 0xff8a3c, special: 'core', specialColor: 0xff5a2a },
  coast:       { skyTop: 0x1c2a52, skyBottom: 0x380f2e, glow: 0xd96a4a, silhouette: 0x0a0e20, shapes: ['waves'], particle: 'star', particleColor: 0xcfe0ff, special: 'sun', specialColor: 0xffa25a },
  aurora:      { skyTop: 0x041228, skyBottom: 0x02040a, glow: 0x14545a, silhouette: 0x050d16, shapes: ['ridges'], particle: 'star', particleColor: 0xbfe6ff, special: 'aurora', specialColor: 0x66ffcc },
  lighthouse:  { skyTop: 0x0a1830, skyBottom: 0x040609, glow: 0x24568a, silhouette: 0x060d18, shapes: ['waves'], particle: 'rain', particleColor: 0x9fc8e8, special: 'beam', specialColor: 0xfff2c8 },
  study:       { skyTop: 0x221108, skyBottom: 0x080302, glow: 0xa04f1c, silhouette: 0x120a05, shapes: ['shelves'], particle: 'ember', particleColor: 0xffb45e, special: 'core', specialColor: 0xff9440 },
  shipwreck:   { skyTop: 0x03181f, skyBottom: 0x01070a, glow: 0x0f5f6e, silhouette: 0x031318, shapes: ['waves'], particle: 'bubble', particleColor: 0x8fe8df, special: 'core', specialColor: 0x3fd9c9 },
  storm:       { skyTop: 0x11182a, skyBottom: 0x05070d, glow: 0x2c3f66, silhouette: 0x080c16, shapes: ['waves', 'skyline'], particle: 'rain', particleColor: 0xa9c2e8, special: 'lightning', specialColor: 0xe8f2ff },
  jungle:      { skyTop: 0x07200f, skyBottom: 0x020704, glow: 0x1e6b34, silhouette: 0x03110a, shapes: ['pines', 'pines'], particle: 'firefly', particleColor: 0xd6ff8a, special: 'moon', specialColor: 0xcfeeda },
  orbit:       { skyTop: 0x050818, skyBottom: 0x010206, glow: 0x18305e, silhouette: 0x02040c, shapes: ['planet'], particle: 'star', particleColor: 0xd6e6ff, special: 'shooting', specialColor: 0xbfd8ff },
  mine:        { skyTop: 0x1c1206, skyBottom: 0x070401, glow: 0x8a5c14, silhouette: 0x0f0a03, shapes: ['crystals'], particle: 'spark', particleColor: 0xffd24e, special: 'core', specialColor: 0xffc23c },
  manor:       { skyTop: 0x140f22, skyBottom: 0x050309, glow: 0x4a3466, silhouette: 0x0b0714, shapes: ['pines'], particle: 'dust', particleColor: 0xb9a8d8, special: 'moon', specialColor: 0xd8ccf2 },
  summit:      { skyTop: 0x27354d, skyBottom: 0x0a0d14, glow: 0xd88a5a, silhouette: 0x0d1119, shapes: ['ridges'], particle: 'snow', particleColor: 0xeef6ff, special: 'sun', specialColor: 0xffb070 },
  observatory: { skyTop: 0x0a0f2e, skyBottom: 0x030410, glow: 0x2c3f8a, silhouette: 0x070a1a, shapes: ['dome', 'ridges'], particle: 'star', particleColor: 0xc8d8ff, special: 'shooting', specialColor: 0xaec2ff },
  reactor:     { skyTop: 0x061a20, skyBottom: 0x020708, glow: 0x0f7f8a, silhouette: 0x04120f, shapes: ['rings'], particle: 'spark', particleColor: 0x5affd8, special: 'core', specialColor: 0x3cf0c8 },
  singularity: { skyTop: 0x1c0a04, skyBottom: 0x020204, glow: 0x8a3418, silhouette: 0x070303, shapes: ['vortex'], particle: 'star', particleColor: 0xffc896, special: 'core', specialColor: 0xff8a3c },
  sanctum:     { skyTop: 0x07293f, skyBottom: 0x010810, glow: 0x1fb9e8, silhouette: 0x06435c, shapes: ['plexus', 'crystals'], particle: 'mote', particleColor: 0x8feaff, special: 'core', specialColor: 0x37cfff },
};

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

const SKY_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
const SKY_FRAG = `
  uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uGlow;
  uniform float uTime; uniform float uFlash; varying vec2 vUv;
  void main(){
    float g = pow(vUv.y, 1.5);
    vec3 col = mix(uBottom, uTop, g);
    float horizon = exp(-pow((vUv.y - 0.32) * 3.4, 2.0));
    col += uGlow * horizon * (0.42 + 0.16 * sin(uTime * 0.35));
    col += vec3(0.9, 0.95, 1.0) * uFlash * (0.25 + 0.75 * (1.0 - vUv.y));
    gl_FragColor = vec4(col, 1.0);
  }
`;

function ridgeGeometry(rng: () => number, baseY: number, peaks: number, jag: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-14, baseY - 3);
  const steps = peaks;
  let y = baseY + rng() * jag;
  shape.lineTo(-14, y);
  for (let i = 1; i <= steps; i++) {
    const x = -14 + (28 * i) / steps;
    y = baseY + rng() * jag;
    shape.lineTo(x, y);
  }
  shape.lineTo(14, baseY - 3);
  shape.closePath();
  return shape;
}

function makeAuroraTexture(color: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.45, `#${color.toString(16).padStart(6, '0')}cc`);
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 128);
  ctx.globalCompositeOperation = 'destination-in';
  const bands = ctx.createLinearGradient(0, 0, 256, 0);
  bands.addColorStop(0, 'rgba(0,0,0,0)');
  bands.addColorStop(0.5, 'rgba(0,0,0,1)');
  bands.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bands;
  ctx.fillRect(0, 0, 256, 128);
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
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.28)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createBackdrop(scene: THREE.Scene, id: string): BackdropHandle {
  const preset = PRESETS[id] ?? PRESETS.arctic;
  const rng = mulberry32(hashSeed(id));
  const group = new THREE.Group();
  scene.add(group);
  const disposables: Array<{ dispose(): void }> = [];

  // --- sky ---
  const skyUniforms = {
    uTop: { value: new THREE.Color(preset.skyTop) },
    uBottom: { value: new THREE.Color(preset.skyBottom) },
    uGlow: { value: new THREE.Color(preset.glow) },
    uTime: { value: 0 },
    uFlash: { value: 0 },
  };
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: skyUniforms,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(80, 34), skyMat);
  sky.position.set(0, 4, -16.5);
  group.add(sky);
  disposables.push(sky.geometry, skyMat);

  const silMat = new THREE.MeshBasicMaterial({ color: preset.silhouette });
  disposables.push(silMat);

  // --- silhouettes ---
  const addShape = (shape: THREE.Shape, z: number) => {
    const geo = new THREE.ShapeGeometry(shape);
    const mesh = new THREE.Mesh(geo, silMat);
    mesh.position.set(0, 0, z);
    group.add(mesh);
    disposables.push(geo);
  };

  let layers = 0;
  for (const kind of preset.shapes) {
    if (kind === 'ridges') {
      for (let i = 0; i < 3; i++) {
        const z = -14.5 + i * 2.2;
        addShape(ridgeGeometry(rng, -6.4 + i * 1.1 + (layers > 0 ? 1.5 : 0), 7 + i * 3, 2.6 + i * 1.4), z);
      }
      layers++;
    } else if (kind === 'dunes') {
      for (let i = 0; i < 3; i++) {
        addShape(ridgeGeometry(rng, -6.2 + i * 0.9, 4, 1.2 + i * 0.7), -14 + i * 2.4);
      }
    } else if (kind === 'pines') {
      const base = -6.2;
      for (let row = 0; row < 3; row++) {
        const z = -14 + row * 2.2;
        const treeGeo = new THREE.ConeGeometry(0.9 + row * 0.35, 3 + row * 1.2, 6);
        const trees = new THREE.InstancedMesh(treeGeo, silMat, 16);
        const m = new THREE.Matrix4();
        for (let i = 0; i < 16; i++) {
          const x = -13 + (26 * i) / 15 + (rng() - 0.5) * 1.6;
          const h = 2.6 + row * 1.4 + rng() * 1.8;
          m.makeScale(1, h / 3, 1);
          m.setPosition(x, base + h / 2 - 1, z);
          trees.setMatrixAt(i, m);
        }
        group.add(trees);
        disposables.push(treeGeo);
      }
      layers++;
    } else if (kind === 'skyline') {
      const boxGeo = new THREE.BoxGeometry(1, 1, 1);
      const count = 22;
      const buildings = new THREE.InstancedMesh(boxGeo, silMat, count);
      const m = new THREE.Matrix4();
      for (let i = 0; i < count; i++) {
        const x = -13 + (26 * i) / (count - 1) + (rng() - 0.5) * 0.5;
        const h = 2 + rng() * 6.5;
        m.makeScale(0.8 + rng() * 1.2, h, 1);
        m.setPosition(x, -6.4 + h / 2, -13.4 + (i % 3) * 0.9);
        buildings.setMatrixAt(i, m);
      }
      group.add(buildings);
      disposables.push(boxGeo);
      // flickering windows
      const winGeo = new THREE.PlaneGeometry(0.09, 0.14);
      const winMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.75 });
      const windows = new THREE.InstancedMesh(winGeo, winMat, 90);
      const wm = new THREE.Matrix4();
      const winSeeds: number[] = [];
      for (let i = 0; i < 90; i++) {
        wm.makeTranslation(-12 + rng() * 24, -5.4 + rng() * 8, -12.2);
        windows.setMatrixAt(i, wm);
        winSeeds.push(rng() * Math.PI * 2);
      }
      windows.userData.seeds = winSeeds;
      group.add(windows);
      disposables.push(winGeo, winMat);
    } else if (kind === 'shelves') {
      for (let row = 0; row < 4; row++) {
        const z = -13.5 + row * 1.4;
        const shelfGeo = new THREE.BoxGeometry(30, 0.35 + rng() * 0.2, 0.6);
        const shelf = new THREE.Mesh(shelfGeo, silMat);
        shelf.position.set(0, -6 + row * 2.6 + rng() * 0.4, z);
        group.add(shelf);
        disposables.push(shelfGeo);
        const bookGeo = new THREE.BoxGeometry(0.32, 1.7 + rng(), 0.45);
        const books = new THREE.InstancedMesh(bookGeo, silMat, 34);
        const bm = new THREE.Matrix4();
        for (let i = 0; i < 34; i++) {
          const h = 1.5 + rng() * 0.9;
          bm.makeScale(1, h, 1);
          bm.setPosition(-14.5 + i * 0.85 + rng() * 0.2, shelf.position.y + 0.2 + h / 2, z + 0.4);
          books.setMatrixAt(i, bm);
        }
        group.add(books);
        disposables.push(bookGeo);
      }
      layers++;
    } else if (kind === 'crystals') {
      for (let i = 0; i < 14; i++) {
        const h = 1.5 + rng() * 5;
        const geo = new THREE.ConeGeometry(0.35 + rng() * 0.7, h, 5);
        const mesh = new THREE.Mesh(geo, silMat);
        const x = -13 + rng() * 26;
        mesh.position.set(x, -6.4 + h / 2, -13.4 + rng() * 2.5);
        mesh.rotation.set((rng() - 0.5) * 0.5, rng() * Math.PI, (rng() - 0.5) * 0.5);
        group.add(mesh);
        disposables.push(geo);
      }
    } else if (kind === 'waves') {
      // animated in update(): layered sine ribbons
      for (let i = 0; i < 3; i++) {
        const segs = 90;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array((segs + 1) * 3);
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const line = new THREE.Line(
          geo,
          new THREE.LineBasicMaterial({ color: preset.silhouette, transparent: true, opacity: 0.9 }),
        );
        line.userData.phase = rng() * Math.PI * 2;
        line.userData.row = i;
        group.add(line);
        disposables.push(geo, line.material as THREE.Material);
      }
    } else if (kind === 'plexus') {
      // Drifting node web — points joined to nearby neighbours, animated by
      // rebuilding the segment positions each frame around slow sine drift.
      const NODES = 54;
      const bases: Array<[number, number, number, number, number]> = [];
      for (let i = 0; i < NODES; i++) {
        bases.push([
          (rng() - 0.5) * 32,
          -5 + rng() * 13,
          -8 - rng() * 7,
          rng() * Math.PI * 2,
          0.3 + rng() * 0.7,
        ]);
      }
      const nodeGeo = new THREE.BufferGeometry();
      nodeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NODES * 3), 3));
      nodeGeo.userData.bases = bases;
      const nodePts = new THREE.Points(
        nodeGeo,
        new THREE.PointsMaterial({ color: 0x8fe8ff, size: 0.22, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      group.add(nodePts);
      disposables.push(nodeGeo, nodePts.material as THREE.Material);

      const maxPairs = NODES * NODES;
      const linkGeo = new THREE.BufferGeometry();
      linkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxPairs * 6), 3));
      linkGeo.userData.bases = bases;
      const links = new THREE.LineSegments(
        linkGeo,
        new THREE.LineBasicMaterial({ color: 0x49c6ff, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      links.userData.isPlexusLinks = true;
      group.add(links);
      disposables.push(linkGeo, links.material as THREE.Material);
    } else if (kind === 'dome') {
      const domeGeo = new THREE.SphereGeometry(2.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      const dome = new THREE.Mesh(domeGeo, silMat);
      dome.position.set(6.5, -6.3, -12.5);
      group.add(dome);
      disposables.push(domeGeo);
      const slitGeo = new THREE.BoxGeometry(0.5, 3.2, 0.5);
      const slit = new THREE.Mesh(slitGeo, new THREE.MeshBasicMaterial({ color: preset.glow }));
      slit.position.set(6.5, -5.4, -12.6);
      slit.rotation.z = 0.5;
      group.add(slit);
      disposables.push(slitGeo, slit.material as THREE.Material);
    } else if (kind === 'planet') {
      const planetGeo = new THREE.CircleGeometry(4.6, 48);
      const planetMat = new THREE.MeshBasicMaterial({ color: preset.silhouette });
      const planet = new THREE.Mesh(planetGeo, planetMat);
      planet.position.set(-5.5, 2.5, -15.8);
      group.add(planet);
      disposables.push(planetGeo, planetMat);
      const ringGeo = new THREE.RingGeometry(5.4, 6.4, 48);
      const ringMat = new THREE.MeshBasicMaterial({ color: preset.silhouette, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(planet.position);
      ring.rotation.x = 1.25;
      ring.rotation.y = -0.35;
      group.add(ring);
      disposables.push(ringGeo, ringMat);
    } else if (kind === 'rings') {
      for (let i = 0; i < 4; i++) {
        const geo = new THREE.RingGeometry(3 + i * 1.7, 3.14 + i * 1.7, 64);
        const mat = new THREE.MeshBasicMaterial({ color: preset.silhouette, transparent: true, opacity: 0.85 - i * 0.12, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(geo, mat);
        ring.position.set(0, 0, -14.5);
        ring.rotation.x = 0.35 + i * 0.1;
        ring.userData.spin = (i % 2 === 0 ? 1 : -1) * (0.02 + i * 0.008);
        group.add(ring);
        disposables.push(geo, mat);
      }
    } else if (kind === 'vortex') {
      const count = 260;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      const seeds: number[] = [];
      for (let i = 0; i < count; i++) {
        seeds.push(rng() * Math.PI * 2, 0.35 + rng() * 2.2);
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.userData.seeds = seeds;
      const pts = new THREE.Points(
        geo,
        new THREE.PointsMaterial({ color: 0x3c1408, size: 0.09, transparent: true, opacity: 0.9 }),
      );
      pts.position.set(0, 0.5, -14.2);
      group.add(pts);
      disposables.push(geo, pts.material as THREE.Material);
    }
  }

  // --- particles ---
  const pCount = preset.particle === 'rain' ? 320 : 210;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount * 3);
  const pSeed: number[] = [];
  for (let i = 0; i < pCount; i++) {
    pPos[i * 3] = (rng() - 0.5) * 30;
    pPos[i * 3 + 1] = -7 + rng() * 15;
    pPos[i * 3 + 2] = -13 + rng() * 8;
    pSeed.push(rng() * Math.PI * 2);
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    color: preset.particleColor,
    size: preset.particle === 'rain' ? 0.045 : preset.particle === 'star' ? 0.055 : 0.075,
    transparent: true,
    opacity: preset.particle === 'star' ? 0.85 : 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const particles = new THREE.Points(pGeo, pMat);
  group.add(particles);
  disposables.push(pGeo, pMat);

  // --- specials ---
  const glowTex = makeGlowTexture();
  disposables.push(glowTex);
  let beam: THREE.Mesh | null = null;
  let auroras: THREE.Mesh[] = [];
  let core: THREE.Sprite | null = null;

  if (preset.special === 'aurora') {
    const color = preset.specialColor ?? 0x66ffcc;
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: makeAuroraTexture(color),
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(22, 7), mat);
      mesh.position.set((rng() - 0.5) * 8, 3.2 + i * 1.6, -14.8);
      mesh.rotation.z = (rng() - 0.5) * 0.35;
      mesh.userData.phase = rng() * Math.PI * 2;
      group.add(mesh);
      auroras.push(mesh);
      disposables.push(mesh.geometry as THREE.BufferGeometry, mat);
    }
  }
  if (preset.special === 'beam') {
    const geo = new THREE.ConeGeometry(2.6, 16, 24, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: preset.specialColor ?? 0xfff2c8,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    beam = new THREE.Mesh(geo, mat);
    beam.geometry.translate(0, -8, 0);
    beam.position.set(-11, -3.4, -12);
    beam.rotation.z = 1.15;
    group.add(beam);
    disposables.push(geo, mat);
  }
  if (preset.special === 'core' || preset.special === 'sun' || preset.special === 'moon') {
    const mat = new THREE.SpriteMaterial({
      map: glowTex,
      color: preset.specialColor ?? 0xffaa55,
      transparent: true,
      opacity: preset.special === 'moon' ? 0.5 : 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    core = new THREE.Sprite(mat);
    const isMoon = preset.special === 'moon';
    const isSun = preset.special === 'sun';
    core.scale.setScalar(isMoon ? 5 : isSun ? 10 : 8);
    core.position.set(isMoon ? 7.5 : isSun ? -4 : 0, isMoon || isSun ? 3.4 : -5.4, -14.6);
    group.add(core);
    disposables.push(mat);
  }

  let flashUntil = 0;
  let nextFlash = 2 + rng() * 5;
  let shootUntil = 0;
  let nextShoot = 4 + rng() * 6;

  const posAttr = pGeo.getAttribute('position') as THREE.BufferAttribute;

  function update(dt: number, elapsed: number) {
    skyUniforms.uTime.value = elapsed;
    if (preset.special === 'lightning') {
      if (elapsed > nextFlash) {
        flashUntil = elapsed + 0.28;
        nextFlash = elapsed + 3.5 + rng() * 6;
      }
      skyUniforms.uFlash.value = elapsed < flashUntil ? (flashUntil - elapsed) / 0.28 : 0;
    }

    // particles
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < pCount; i++) {
      const sx = pSeed[i];
      const x = arr[i * 3];
      const y = arr[i * 3 + 1];
      switch (preset.particle) {
        case 'snow':
          arr[i * 3] = x + Math.sin(elapsed * 0.7 + sx) * dt * 0.35;
          arr[i * 3 + 1] = y - dt * (0.55 + 0.3 * Math.sin(sx));
          break;
        case 'rain':
          arr[i * 3 + 1] = y - dt * 9;
          break;
        case 'ember':
        case 'bubble':
        case 'spark':
          arr[i * 3] = x + Math.sin(elapsed * 1.1 + sx) * dt * 0.5;
          arr[i * 3 + 1] = y + dt * (preset.particle === 'bubble' ? 0.9 : 0.55);
          break;
        case 'firefly':
          arr[i * 3] = x + Math.sin(elapsed * 0.5 + sx * 3.1) * dt * 0.6;
          arr[i * 3 + 1] = y + Math.cos(elapsed * 0.4 + sx * 2.3) * dt * 0.45;
          break;
        case 'dust':
        case 'mote':
          arr[i * 3] = x + dt * 0.12;
          arr[i * 3 + 1] = y + Math.sin(elapsed * 0.3 + sx) * dt * 0.1;
          break;
        default:
          break; // stars twinkle in place
      }
      if (arr[i * 3] > 15.5) arr[i * 3] = -15.5;
      if (arr[i * 3] < -15.5) arr[i * 3] = 15.5;
      if (arr[i * 3 + 1] > 8.2) arr[i * 3 + 1] = -7.4;
      if (arr[i * 3 + 1] < -7.4) arr[i * 3 + 1] = 8.2;
    }
    posAttr.needsUpdate = true;
    pMat.opacity =
      (preset.particle === 'firefly' ? 0.35 + 0.35 * Math.abs(Math.sin(elapsed * 1.7)) : preset.particle === 'star' ? 0.6 + 0.25 * Math.sin(elapsed * 0.8) : 0.6);

    // waves
    group.children.forEach((child) => {
      if (child.userData.phase !== undefined && (child as THREE.Line).geometry && preset.shapes.includes('waves')) {
        const line = child as THREE.Line;
        const attr = line.geometry.getAttribute('position') as THREE.BufferAttribute;
        const a = attr.array as Float32Array;
        const row = (line.userData.row as number) ?? 0;
        const segs = a.length / 3 - 1;
        for (let i = 0; i <= segs; i++) {
          const x = -15 + (30 * i) / segs;
          a[i * 3] = x;
          a[i * 3 + 1] = -3.6 + row * 0.9 + Math.sin(x * 0.55 + elapsed * (0.7 + row * 0.25) + (line.userData.phase as number)) * 0.35;
          a[i * 3 + 2] = -12.5 + row * 1.6;
        }
        attr.needsUpdate = true;
      }
      if (child.userData.spin !== undefined) {
        child.rotation.z += (child.userData.spin as number) * dt * 3;
      }
      if (auroras.includes(child as THREE.Mesh)) {
        const mesh = child as THREE.Mesh;
        (mesh.material as THREE.MeshBasicMaterial).opacity = 0.26 + 0.12 * Math.sin(elapsed * 0.45 + (mesh.userData.phase as number));
        mesh.rotation.z = Math.sin(elapsed * 0.12 + (mesh.userData.phase as number)) * 0.18 - 0.05;
        mesh.position.x = Math.sin(elapsed * 0.07 + (mesh.userData.phase as number)) * 2.2;
      }
    });

    // vortex swirl
    for (const child of group.children) {
      if (child.userData && (child as THREE.Points).geometry?.userData?.seeds && preset.shapes.includes('vortex')) {
        const pts = child as THREE.Points;
        const attr = pts.geometry.getAttribute('position') as THREE.BufferAttribute;
        const a = attr.array as Float32Array;
        const seeds = pts.geometry.userData.seeds as number[];
        for (let i = 0; i < seeds.length / 2; i++) {
          const ang = seeds[i * 2] + elapsed * (0.5 - seeds[i * 2 + 1] * 0.1);
          const r = seeds[i * 2 + 1] * (1 + 0.08 * Math.sin(elapsed * 0.6 + i));
          a[i * 3] = Math.cos(ang) * r * 2.4;
          a[i * 3 + 1] = Math.sin(ang) * r * 1.15 + 0.5;
          a[i * 3 + 2] = -1.5 + r * 0.4;
        }
        attr.needsUpdate = true;
      }
    }

    // plexus webs: drifting nodes joined to nearby neighbours
    for (const child of group.children) {
      const geo = (child as THREE.Points | THREE.LineSegments).geometry as THREE.BufferGeometry | undefined;
      const bases = geo?.userData?.bases as Array<[number, number, number, number, number]> | undefined;
      if (!bases) continue;
      const attr = geo!.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      const isPoints = (child as THREE.Points).isPoints === true;
      const pos: Array<[number, number, number]> = [];
      for (let i = 0; i < bases.length; i++) {
        const [bx, by, bz, ph, sp] = bases[i];
        pos.push([
          bx + Math.sin(elapsed * sp + ph) * 0.6,
          by + Math.cos(elapsed * sp * 0.8 + ph) * 0.5,
          bz + Math.sin(elapsed * sp * 0.5 + ph * 2) * 0.4,
        ]);
        if (isPoints) {
          arr[i * 3] = pos[i][0];
          arr[i * 3 + 1] = pos[i][1];
          arr[i * 3 + 2] = pos[i][2];
        }
      }
      if (!isPoints) {
        const CONNECT = 6.2;
        let n = 0;
        for (let i = 0; i < pos.length && n < arr.length / 6; i++) {
          for (let j = i + 1; j < pos.length && n < arr.length / 6; j++) {
            const dx = pos[i][0] - pos[j][0];
            const dy = pos[i][1] - pos[j][1];
            const dz = pos[i][2] - pos[j][2];
            if (dx * dx + dy * dy + dz * dz < CONNECT * CONNECT) {
              arr[n * 6] = pos[i][0];
              arr[n * 6 + 1] = pos[i][1];
              arr[n * 6 + 2] = pos[i][2];
              arr[n * 6 + 3] = pos[j][0];
              arr[n * 6 + 4] = pos[j][1];
              arr[n * 6 + 5] = pos[j][2];
              n++;
            }
          }
        }
        for (let k = n * 6; k < arr.length; k++) arr[k] = 0;
        geo!.setDrawRange(0, n * 2);
      }
      attr.needsUpdate = true;
    }

    if (beam) {
      beam.rotation.y = Math.sin(elapsed * 0.5) * 0.7;
      (beam.material as THREE.MeshBasicMaterial).opacity = 0.09 + 0.05 * Math.sin(elapsed * 0.9);
    }
    if (core) {
      const base = (core.material as THREE.SpriteMaterial).opacity;
      void base;
      core.scale.setScalar((core.scale.x || 8) * 1); // keep scale stable
      (core.material as THREE.SpriteMaterial).opacity =
        (preset.special === 'moon' ? 0.42 : 0.6) + 0.12 * Math.sin(elapsed * 1.3);
      if (preset.special === 'core') core.position.y = -5.4 + Math.sin(elapsed * 0.8) * 0.12;
    }
    if (preset.special === 'shooting') {
      if (elapsed > nextShoot) {
        shootUntil = elapsed + 0.5;
        nextShoot = elapsed + 5 + rng() * 7;
      }
      if (elapsed < shootUntil) {
        const t = 1 - (shootUntil - elapsed) / 0.5;
        // reuse core glow as a streak flash if present, else pulse sky
        skyUniforms.uFlash.value = Math.max(skyUniforms.uFlash.value, 0.06 * Math.sin(t * Math.PI));
      }
    }
  }

  return {
    update,
    dispose() {
      scene.remove(group);
      for (const d of disposables) d.dispose();
      disposables.length = 0;
    },
  };
}

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import "../styles/signal-level01.css";

const GRID_TARGET_WORDS = ["CAT", "DOG", "SUN"];

export interface SignalLevel01Props {
  levelName: string;
  levelCode: string;
  grid: string;
  selected: number | null;
  hintCells: [number, number] | null;
  lines: number[];
  victory: boolean;
  moves: number;
  par: number;
  timeLabel: string;
  timeCritical: boolean;
  hintStage: 0 | 1;
  canUndo: boolean;
  muted: boolean;
  message: string;
  messageIsError: boolean;
  onHome(): void;
  onRestart(): void;
  onToggleMuted(): void;
  onUndo(): void;
  onHint(): void;
  onCellTap(cell: number): void;
  onCellDrag(cell: number, dir: "up" | "down" | "left" | "right"): void;
}

interface Tile3D {
  id: number;
  group: THREE.Group;
  cubeMesh: THREE.Mesh;
  edgeLines: THREE.LineSegments;
  edgeMaterial: THREE.LineBasicMaterial;
  frontMesh: THREE.Mesh;
  topMesh: THREE.Mesh;
  frontCanvas: HTMLCanvasElement;
  frontCtx: CanvasRenderingContext2D;
  frontTexture: THREE.CanvasTexture;
  topCanvas: HTMLCanvasElement;
  topCtx: CanvasRenderingContext2D;
  topTexture: THREE.CanvasTexture;
  // Spatial interpolation
  currentPos: THREE.Vector3;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  animTime: number; // 0 to 1
  isPrimary: boolean;
  letter: string;
  gridSlot: number;
}

const SPACING = 1.16;
const TILE_W = 1.06;
const TILE_H = 1.06;
const TILE_D = 0.88;
const CENTER_Y = 1.32;

function getSlotPos(slot: number): THREE.Vector3 {
  const col = slot % 3;
  const row = Math.floor(slot / 3);
  const x = (col - 1) * SPACING;
  const y = CENTER_Y + (1 - row) * SPACING;
  return new THREE.Vector3(x, y, 0);
}

function drawTileFrontCanvas(
  ctx: CanvasRenderingContext2D,
  letter: string,
  state: { isSelected: boolean; isHinted: boolean; isMatched: boolean; isHovered: boolean }
) {
  const size = 512;
  ctx.clearRect(0, 0, size, size);

  const pad = 16;
  const w = size - pad * 2;
  const h = size - pad * 2;
  const r = 38;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, pad, w, h, r);
  ctx.clip();

  // Glass background gradient matching Pic 2
  const grad = ctx.createLinearGradient(pad, pad, pad + w, pad + h);
  if (state.isSelected) {
    grad.addColorStop(0, "rgba(18, 95, 140, 0.96)");
    grad.addColorStop(0.5, "rgba(8, 55, 85, 0.98)");
    grad.addColorStop(1, "rgba(2, 22, 38, 0.99)");
  } else if (state.isMatched) {
    grad.addColorStop(0, "rgba(32, 95, 105, 0.96)");
    grad.addColorStop(0.5, "rgba(14, 60, 70, 0.98)");
    grad.addColorStop(1, "rgba(4, 28, 36, 0.99)");
  } else if (state.isHinted) {
    grad.addColorStop(0, "rgba(95, 80, 25, 0.96)");
    grad.addColorStop(0.5, "rgba(55, 45, 16, 0.98)");
    grad.addColorStop(1, "rgba(24, 18, 8, 0.99)");
  } else {
    // Exact Pic 2 deep sapphire cyan glass
    grad.addColorStop(0, "rgba(14, 66, 98, 0.94)");
    grad.addColorStop(0.38, "rgba(6, 38, 62, 0.96)");
    grad.addColorStop(1, "rgba(2, 16, 28, 0.99)");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(pad, pad, w, h);

  // Soft internal specular diagonal sheen
  const sheenGrad = ctx.createLinearGradient(pad, pad, pad + w * 0.7, pad + h * 0.7);
  sheenGrad.addColorStop(0, "rgba(255, 255, 255, 0.15)");
  sheenGrad.addColorStop(0.28, "rgba(140, 240, 255, 0.04)");
  sheenGrad.addColorStop(1, "transparent");
  ctx.fillStyle = sheenGrad;
  ctx.fillRect(pad, pad, w, h);

  // Inner beveled stroke
  ctx.beginPath();
  ctx.roundRect(pad + 5, pad + 5, w - 10, h - 10, r - 4);
  const strokeGrad = ctx.createLinearGradient(pad, pad, pad, pad + h);
  if (state.isSelected) {
    strokeGrad.addColorStop(0, "rgba(150, 245, 255, 0.95)");
    strokeGrad.addColorStop(1, "rgba(0, 180, 230, 0.6)");
  } else if (state.isHinted) {
    strokeGrad.addColorStop(0, "rgba(255, 220, 100, 0.95)");
    strokeGrad.addColorStop(1, "rgba(200, 140, 30, 0.6)");
  } else {
    strokeGrad.addColorStop(0, "rgba(160, 240, 255, 0.7)");
    strokeGrad.addColorStop(0.42, "rgba(50, 185, 225, 0.35)");
    strokeGrad.addColorStop(1, "rgba(8, 70, 110, 0.45)");
  }
  ctx.strokeStyle = strokeGrad;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Bottom subtle accent line (matching Pic 2)
  ctx.beginPath();
  ctx.moveTo(pad + w * 0.22, pad + h * 0.88);
  ctx.lineTo(pad + w * 0.78, pad + h * 0.88);
  ctx.strokeStyle = "rgba(90, 220, 255, 0.32)";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Glowing Letter Typography - Always Uppercase, crisp & elegant (70% reduced brightness)
  const upper = (letter || "").toUpperCase();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "800 215px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  const cx = size / 2;
  const cy = size / 2 - 6;

  // Soft ambient drop-glow (outer glow reduced ~60% — the visible halo is
  // bloom reacting to letter brightness, so the fill itself is dimmed too)
  ctx.shadowColor = state.isHinted ? "rgba(255, 215, 64, 0.03)" : "rgba(0, 229, 255, 0.028)";
  ctx.shadowBlur = 1;
  ctx.fillStyle = state.isHinted ? "rgba(255, 245, 200, 0.26)" : "rgba(160, 208, 236, 0.28)";
  ctx.fillText(upper, cx, cy);

  // Crisp core text (letter glow reduced 50% — stays below bloom threshold)
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(214, 238, 252, 0.44)";
  ctx.fillText(upper, cx, cy);

  ctx.restore();
}

function drawTileTopCanvas(ctx: CanvasRenderingContext2D) {
  const size = 512;
  ctx.clearRect(0, 0, size, size);
  const pad = 16;
  const w = size - pad * 2;
  const h = size - pad * 2;
  const r = 38;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, pad, w, h, r);
  ctx.clip();

  // Glossy reflection gradient across the top surface
  const grad = ctx.createLinearGradient(pad, pad, pad, pad + h);
  grad.addColorStop(0, "rgba(18, 90, 130, 0.92)");
  grad.addColorStop(0.32, "rgba(38, 155, 205, 0.4)");
  grad.addColorStop(0.7, "rgba(8, 40, 65, 0.95)");
  grad.addColorStop(1, "rgba(3, 18, 30, 0.98)");
  ctx.fillStyle = grad;
  ctx.fillRect(pad, pad, w, h);

  // Specular sheen
  const streakGrad = ctx.createLinearGradient(pad, pad, pad + w, pad + h);
  streakGrad.addColorStop(0, "rgba(255, 255, 255, 0.28)");
  streakGrad.addColorStop(0.38, "rgba(130, 235, 255, 0.06)");
  streakGrad.addColorStop(1, "transparent");
  ctx.fillStyle = streakGrad;
  ctx.fillRect(pad, pad, w, h);

  // Top edge bevel stroke
  ctx.beginPath();
  ctx.roundRect(pad + 5, pad + 5, w - 10, h - 10, r - 4);
  ctx.strokeStyle = "rgba(140, 230, 255, 0.45)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.restore();
}

export default function SignalLevel01({
  levelName,
  levelCode,
  grid,
  selected,
  hintCells,
  lines,
  victory,
  moves,
  par,
  timeLabel,
  timeCritical,
  hintStage,
  canUndo,
  muted,
  message,
  messageIsError,
  onHome,
  onRestart,
  onToggleMuted,
  onUndo,
  onHint,
  onCellTap,
  onCellDrag,
}: SignalLevel01Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Internal persistent references
  const tilesRef = useRef<Tile3D[]>([]);
  const prevGridRef = useRef(grid);
  const hoveredCellRef = useRef<number | null>(null);
  const pointerDownRef = useRef<{ cell: number; x: number; y: number; time: number } | null>(null);

  // Callbacks ref
  const cbRef = useRef({ onCellTap, onCellDrag });
  cbRef.current = { onCellTap, onCellDrag };

  // Setup Three.js scene
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020a10);

    // Camera angled to see top beveled faces of the cubes precisely as in Pic 2
    const camera = new THREE.PerspectiveCamera(
      48,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 2.9, 8.4);
    camera.lookAt(0, 1.32, 0);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    // Bloom setup for the signature neon glow (tuned to prevent overexposure)
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.55, // strength
      0.45, // radius
      0.48  // threshold
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    // ------------------------------------------------------------
    // LIGHTING (Pic 2 Lighting Scheme)
    // ------------------------------------------------------------
    const ambientLight = new THREE.AmbientLight(0x133848, 2.2);
    scene.add(ambientLight);

    // Key front-top light for glass reflections
    const keyCyan = new THREE.PointLight(0x00f2ff, 28, 20);
    keyCyan.position.set(0, 3.8, 4.5);
    scene.add(keyCyan);

    // Rim lighting from bottom-front (70% reduced brightness)
    const rimFloor = new THREE.PointLight(0x1ae8ff, 3.5, 10);
    rimFloor.position.set(0, -0.6, 2.5);
    scene.add(rimFloor);

    // Left and right blue fill lights
    const fillLeft = new THREE.PointLight(0x0077ff, 14, 18);
    fillLeft.position.set(-6, 2.5, 1);
    scene.add(fillLeft);

    const fillRight = new THREE.PointLight(0x38e1ff, 14, 18);
    fillRight.position.set(6, 2.5, 1);
    scene.add(fillRight);

    // Subtle monolith rim lights
    const monoRimLeft = new THREE.PointLight(0x00c8ff, 10, 10);
    monoRimLeft.position.set(-4.5, 2.0, -1.2);
    scene.add(monoRimLeft);

    const monoRimRight = new THREE.PointLight(0x00c8ff, 10, 10);
    monoRimRight.position.set(4.5, 2.0, -1.2);
    scene.add(monoRimRight);

    // ------------------------------------------------------------
    // STEPPED CYBER PEDESTAL (Directly underneath the cube assembly)
    // ------------------------------------------------------------
    const pedestalGroup = new THREE.Group();
    pedestalGroup.position.set(0, -0.68, 0);

    // Base dark metallic cylinder
    const baseCylGeo = new THREE.CylinderGeometry(3.6, 3.85, 0.28, 64);
    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x05131a,
      roughness: 0.22,
      metalness: 0.9,
    });
    const baseCyl = new THREE.Mesh(baseCylGeo, darkMetalMat);
    baseCyl.position.y = -0.14;
    pedestalGroup.add(baseCyl);

    // Upper stepped cylinder
    const stepCylGeo = new THREE.CylinderGeometry(2.95, 3.1, 0.16, 64);
    const stepCyl = new THREE.Mesh(stepCylGeo, darkMetalMat);
    stepCyl.position.y = 0.05;
    pedestalGroup.add(stepCyl);

    // Top raised platform where cubes sit
    const topPlatGeo = new THREE.CylinderGeometry(2.4, 2.4, 0.08, 64);
    const topPlatMat = new THREE.MeshStandardMaterial({
      color: 0x040e14,
      roughness: 0.18,
      metalness: 0.92,
    });
    const topPlat = new THREE.Mesh(topPlatGeo, topPlatMat);
    topPlat.position.y = 0.14;
    pedestalGroup.add(topPlat);

    // Concentric glowing neon cyan rings embedded in the pedestal
    // Outer neon ring
    const outerRingGeo = new THREE.RingGeometry(3.02, 3.1, 96);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.132;
    pedestalGroup.add(outerRing);

    // Middle neon ring
    const midRingGeo = new THREE.RingGeometry(2.38, 2.45, 96);
    const midRingMat = new THREE.MeshBasicMaterial({
      color: 0x38e8ff,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const midRing = new THREE.Mesh(midRingGeo, midRingMat);
    midRing.rotation.x = -Math.PI / 2;
    midRing.position.y = 0.182;
    pedestalGroup.add(midRing);

    // Inner bright glowing groove
    const innerRingGeo = new THREE.RingGeometry(1.68, 1.74, 96);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0x8feeff,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.183;
    pedestalGroup.add(innerRing);

    // Ground wet reflection disc directly mirroring the cubes (70% reduced brightness)
    const reflCanvas = document.createElement("canvas");
    reflCanvas.width = 512;
    reflCanvas.height = 512;
    const reflCtx = reflCanvas.getContext("2d");
    if (reflCtx) {
      const grad = reflCtx.createRadialGradient(256, 256, 10, 256, 256, 256);
      grad.addColorStop(0, "rgba(0, 180, 220, 0.22)");
      grad.addColorStop(0.35, "rgba(0, 90, 140, 0.08)");
      grad.addColorStop(0.65, "rgba(0, 30, 60, 0.02)");
      grad.addColorStop(1, "rgba(0, 20, 40, 0)");
      reflCtx.fillStyle = grad;
      reflCtx.fillRect(0, 0, 512, 512);
    }
    const reflTex = new THREE.CanvasTexture(reflCanvas);
    reflTex.colorSpace = THREE.SRGBColorSpace;

    const reflGeo = new THREE.CircleGeometry(2.32, 64);
    const reflMat = new THREE.MeshBasicMaterial({
      map: reflTex,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const reflMesh = new THREE.Mesh(reflGeo, reflMat);
    reflMesh.rotation.x = -Math.PI / 2;
    reflMesh.position.y = 0.184;
    pedestalGroup.add(reflMesh);

    scene.add(pedestalGroup);

    // ------------------------------------------------------------
    // SURROUNDING FLOOR
    // ------------------------------------------------------------
    const floorGeo = new THREE.CircleGeometry(16, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x02080d,
      roughness: 0.28,
      metalness: 0.88,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.85;
    scene.add(floor);

    // ------------------------------------------------------------
    // UNIFORM BACKDROP CURTAIN (one seamless lit wall — no seams)
    // Emissive gradient fades to black at the bottom so the wall meets
    // the floor with no visible horizon line.
    // ------------------------------------------------------------
    const curtainGrad = document.createElement("canvas");
    curtainGrad.width = 32;
    curtainGrad.height = 256;
    const curtainCtx = curtainGrad.getContext("2d");
    if (curtainCtx) {
      const g = curtainCtx.createLinearGradient(0, 0, 0, 256);
      // Gradual atmospheric falloff: dark cyan → deep blue → navy → near black
      // (reaches black right at the floor junction so no line is visible)
      g.addColorStop(0, "rgba(150, 225, 255, 0.9)");
      g.addColorStop(0.25, "rgba(80, 160, 205, 0.5)");
      g.addColorStop(0.45, "rgba(25, 70, 110, 1)");
      g.addColorStop(0.62, "rgba(10, 32, 55, 1)");
      g.addColorStop(0.72, "rgba(3, 10, 18, 1)");
      g.addColorStop(1, "rgba(2, 8, 14, 1)");
      curtainCtx.fillStyle = g;
      curtainCtx.fillRect(0, 0, 32, 256);
    }
    const curtainGradTex = new THREE.CanvasTexture(curtainGrad);
    curtainGradTex.colorSpace = THREE.SRGBColorSpace;

    const curtainGeo = new THREE.PlaneGeometry(46, 18);
    const curtainMat = new THREE.MeshStandardMaterial({
      color: 0x06141f,
      roughness: 0.6,
      metalness: 0.45,
      emissive: 0xffffff,
      emissiveMap: curtainGradTex,
      emissiveIntensity: 0.55,
    });
    const curtain = new THREE.Mesh(curtainGeo, curtainMat);
    curtain.position.set(0, 3.2, -4.6);
    scene.add(curtain);

    // ------------------------------------------------------------
    // ATMOSPHERIC VOLUMETRIC HALO
    // ------------------------------------------------------------
    const haloCanvas = document.createElement("canvas");
    haloCanvas.width = 512;
    haloCanvas.height = 512;
    const haloCtx = haloCanvas.getContext("2d");
    if (haloCtx) {
      const grad = haloCtx.createRadialGradient(256, 256, 12, 256, 256, 256);
      grad.addColorStop(0, "rgba(0, 180, 240, 0.45)");
      grad.addColorStop(0.35, "rgba(0, 100, 160, 0.18)");
      grad.addColorStop(0.7, "rgba(0, 35, 65, 0.06)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      haloCtx.fillStyle = grad;
      haloCtx.fillRect(0, 0, 512, 512);
    }
    const haloTex = new THREE.CanvasTexture(haloCanvas);
    haloTex.colorSpace = THREE.SRGBColorSpace;
    const haloSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: haloTex,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    haloSprite.scale.set(11, 8.5, 1);
    haloSprite.position.set(0, 1.35, -2.8);
    scene.add(haloSprite);

    // ------------------------------------------------------------
    // 3D VOLUMETRIC GLASS CUBES (The 9 Tiles)
    // ------------------------------------------------------------
    const cubesGroup = new THREE.Group();
    scene.add(cubesGroup);

    const boxGeo = new RoundedBoxGeometry(TILE_W, TILE_H, TILE_D, 4, 0.08);
    const boxEdgesGeo = new THREE.EdgesGeometry(boxGeo, 16);

    const glassBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x051c2a,
      emissive: 0x021622,
      emissiveIntensity: 0.4,
      roughness: 0.12,
      metalness: 0.88,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      reflectivity: 0.92,
      transparent: true,
      opacity: 0.96,
    });

    const initialLetters = grid.split("");
    const newTiles: Tile3D[] = [];

    for (let i = 0; i < 9; i++) {
      const tileGrp = new THREE.Group();
      const initialPos = getSlotPos(i);
      tileGrp.position.copy(initialPos);

      // Glass core
      const cubeMesh = new THREE.Mesh(boxGeo, glassBodyMat.clone());
      cubeMesh.castShadow = true;
      cubeMesh.receiveShadow = true;
      tileGrp.add(cubeMesh);

      // Glowing electric-cyan edge bevels
      const edgeMat = new THREE.LineBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
      });
      const edgeLines = new THREE.LineSegments(boxEdgesGeo, edgeMat);
      tileGrp.add(edgeLines);

      // Front Face Decal / Canvas Plate
      const frontCanvas = document.createElement("canvas");
      frontCanvas.width = 512;
      frontCanvas.height = 512;
      const frontCtx = frontCanvas.getContext("2d")!;
      drawTileFrontCanvas(frontCtx, initialLetters[i] || "", {
        isSelected: false,
        isHinted: false,
        isMatched: false,
        isHovered: false,
      });
      const frontTexture = new THREE.CanvasTexture(frontCanvas);
      frontTexture.colorSpace = THREE.SRGBColorSpace;

      // Decal planes sized to the FLAT region of the rounded box (bevel is
      // 0.08 per side) — otherwise highlights paint past the tile edge when
      // the tile lifts or glows.
      const frontFaceGeo = new THREE.PlaneGeometry(TILE_W * 0.84, TILE_H * 0.84);
      const frontFaceMat = new THREE.MeshBasicMaterial({
        map: frontTexture,
        transparent: true,
        depthWrite: false,
      });
      const frontMesh = new THREE.Mesh(frontFaceGeo, frontFaceMat);
      frontMesh.position.z = TILE_D / 2 + 0.005;
      tileGrp.add(frontMesh);

      // Top Face Glossy Decal Plate
      const topCanvas = document.createElement("canvas");
      topCanvas.width = 512;
      topCanvas.height = 512;
      const topCtx = topCanvas.getContext("2d")!;
      drawTileTopCanvas(topCtx);
      const topTexture = new THREE.CanvasTexture(topCanvas);
      topTexture.colorSpace = THREE.SRGBColorSpace;

      const topFaceGeo = new THREE.PlaneGeometry(TILE_W * 0.84, TILE_D * 0.84);
      const topFaceMat = new THREE.MeshBasicMaterial({
        map: topTexture,
        transparent: true,
        depthWrite: false,
      });
      const topMesh = new THREE.Mesh(topFaceGeo, topFaceMat);
      topMesh.rotation.x = -Math.PI / 2;
      topMesh.position.y = TILE_H / 2 + 0.005;
      tileGrp.add(topMesh);

      cubesGroup.add(tileGrp);

      newTiles.push({
        id: i,
        group: tileGrp,
        cubeMesh,
        edgeLines,
        edgeMaterial: edgeMat,
        frontMesh,
        topMesh,
        frontCanvas,
        frontCtx,
        frontTexture,
        topCanvas,
        topCtx,
        topTexture,
        currentPos: initialPos.clone(),
        startPos: initialPos.clone(),
        targetPos: initialPos.clone(),
        animTime: 1,
        isPrimary: false,
        letter: initialLetters[i] || "",
        gridSlot: i,
      });
    }

    tilesRef.current = newTiles;

    // ------------------------------------------------------------
    // ANIMATION TICK LOOP
    // ------------------------------------------------------------
    let animId: number;
    const clock = new THREE.Clock();

    function animate() {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      // Ambient movements
      haloSprite.material.opacity = 0.82 + Math.sin(elapsed * 1.2) * 0.12;
      keyCyan.intensity = 26 + Math.sin(elapsed * 1.6) * 3;

      // Update 3D Tile positions with fluid cubic easing & 3D arcing
      const tiles = tilesRef.current;
      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];

        if (tile.animTime < 1) {
          tile.animTime += dt / 0.36; // 360ms silky smooth duration
          if (tile.animTime > 1) tile.animTime = 1;

          const p = tile.animTime;
          // Smooth ease-in-out cubic
          const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

          tile.currentPos.x = THREE.MathUtils.lerp(tile.startPos.x, tile.targetPos.x, ease);
          tile.currentPos.y = THREE.MathUtils.lerp(tile.startPos.y, tile.targetPos.y, ease);

          // 3D Arc depth effect: Primary mover lifts forward towards the camera!
          const baseZ = THREE.MathUtils.lerp(tile.startPos.z, tile.targetPos.z, ease);
          const arc = tile.isPrimary
            ? Math.sin(p * Math.PI) * 0.44  // lifts forward
            : -Math.sin(p * Math.PI) * 0.14; // slides recessed behind

          tile.currentPos.z = baseZ + arc;

          // Subtle tilt during slide for dynamic physical weight
          if (tile.isPrimary) {
            const dx = tile.targetPos.x - tile.startPos.x;
            const dy = tile.targetPos.y - tile.startPos.y;
            tile.group.rotation.y = Math.sin(p * Math.PI) * dx * 0.18;
            tile.group.rotation.x = -Math.sin(p * Math.PI) * dy * 0.18;
          } else {
            tile.group.rotation.y = 0;
            tile.group.rotation.x = 0;
          }
        } else {
          tile.group.rotation.y = 0;
          tile.group.rotation.x = 0;
        }

        // Hover & Selection elevation
        const isHovered = hoveredCellRef.current === tile.gridSlot;
        const targetHoverZ = isHovered ? 0.14 : 0;
        tile.currentPos.z = THREE.MathUtils.lerp(tile.currentPos.z, tile.targetPos.z + targetHoverZ, dt * 14);

        tile.group.position.copy(tile.currentPos);
      }

      composer.render();
    }

    animate();

    // ------------------------------------------------------------
    // RESIZE HANDLER
    // ------------------------------------------------------------
    function handleResize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      composer.setSize(w, h);
      bloomPass.setSize(w, h);
    }

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);

      composer.dispose();
      renderer.dispose();
      boxGeo.dispose();
      boxEdgesGeo.dispose();
      glassBodyMat.dispose();
      pedestalGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      curtainGeo.dispose();
      curtainMat.dispose();
      curtainGradTex.dispose();
      curtainMat.dispose();
      haloSprite.material.map?.dispose();
      haloSprite.material.dispose();
      floorGeo.dispose();
      floorMat.dispose();
    };
  }, []);

  // Synchronize 3D Tiles with Game State (grid, selection, hints, matched lines)
  useEffect(() => {
    const currentGrid = grid;
    const prevGrid = prevGridRef.current;
    const tiles = tilesRef.current;
    if (!tiles || tiles.length !== 9) return;

    // Check if a swap occurred between two cells
    if (currentGrid !== prevGrid) {
      let changedA = -1;
      let changedB = -1;
      for (let i = 0; i < 9; i++) {
        if (currentGrid[i] !== prevGrid[i]) {
          if (changedA === -1) changedA = i;
          else if (changedB === -1) changedB = i;
        }
      }

      if (changedA !== -1 && changedB !== -1) {
        // Find which tile was at slot changedA and which at changedB
        const tileAtA = tiles.find((t) => t.gridSlot === changedA);
        const tileAtB = tiles.find((t) => t.gridSlot === changedB);

        if (tileAtA && tileAtB) {
          // Animate tileAtA from slot changedA to changedB
          tileAtA.startPos.copy(tileAtA.currentPos);
          tileAtA.targetPos.copy(getSlotPos(changedB));
          tileAtA.animTime = 0;
          tileAtA.isPrimary = true;
          tileAtA.gridSlot = changedB;
          tileAtA.letter = currentGrid[changedB];

          // Animate tileAtB from slot changedB to changedA
          tileAtB.startPos.copy(tileAtB.currentPos);
          tileAtB.targetPos.copy(getSlotPos(changedA));
          tileAtB.animTime = 0;
          tileAtB.isPrimary = false;
          tileAtB.gridSlot = changedA;
          tileAtB.letter = currentGrid[changedA];
        }
      } else {
        // Direct reset or reorganization
        for (let i = 0; i < 9; i++) {
          const tile = tiles[i];
          tile.gridSlot = i;
          tile.letter = currentGrid[i];
          tile.startPos.copy(getSlotPos(i));
          tile.targetPos.copy(getSlotPos(i));
          tile.currentPos.copy(getSlotPos(i));
          tile.animTime = 1;
        }
      }
      prevGridRef.current = currentGrid;
    }

    // Update canvas textures for all 9 tiles with active selection/hint/matched styling
    for (let i = 0; i < 9; i++) {
      const tile = tiles[i];
      const slot = tile.gridSlot;
      const isSel = selected === slot;
      const isHnt = hintCells ? hintCells.includes(slot) : false;
      const row = Math.floor(slot / 3);
      const col = slot % 3;
      const isMtch = lines.includes(row) || lines.includes(3 + col);

      drawTileFrontCanvas(tile.frontCtx, tile.letter, {
        isSelected: isSel,
        isHinted: isHnt,
        isMatched: isMtch,
        isHovered: hoveredCellRef.current === slot,
      });
      tile.frontTexture.needsUpdate = true;

      // Electric cyan or gold edge highlight
      if (isSel) {
        tile.edgeMaterial.color.setHex(0x56e6ff);
        tile.edgeMaterial.opacity = 1.0;
      } else if (isHnt) {
        tile.edgeMaterial.color.setHex(0xffd76e);
        tile.edgeMaterial.opacity = 1.0;
      } else if (isMtch) {
        tile.edgeMaterial.color.setHex(0x4ee1ff);
        tile.edgeMaterial.opacity = 0.95;
      } else {
        tile.edgeMaterial.color.setHex(0x00f0ff);
        tile.edgeMaterial.opacity = 0.88;
      }
    }
  }, [grid, selected, hintCells, lines]);

  // Pointer interactions (supports both direct canvas raycasting and DOM clicks)
  const handlePointerDown = (cell: number) => (e: React.PointerEvent) => {
    pointerDownRef.current = { cell, x: e.clientX, y: e.clientY, time: Date.now() };
  };

  const handlePointerUp = (cell: number) => (e: React.PointerEvent) => {
    const start = pointerDownRef.current;
    pointerDownRef.current = null;
    if (!start) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    if (Math.hypot(dx, dy) > 24) {
      const dir =
        Math.abs(dx) > Math.abs(dy)
          ? dx > 0
            ? "right"
            : "left"
          : dy > 0
            ? "down"
            : "up";
      cbRef.current.onCellDrag(start.cell, dir);
    } else if (start.cell === cell) {
      cbRef.current.onCellTap(cell);
    }
  };

  const isMatched = (index: number) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    return lines.includes(row) || lines.includes(3 + col);
  };

  return (
    <div className="signal-game" data-grid={grid} ref={containerRef}>
      {/* 3D WebGL Canvas */}
      <canvas ref={canvasRef} className="signal-canvas" />

      <div className="signal-vignette" />

      {/* ------------------------------------------------------
          TOP HUD (Matching Pic 2)
      ------------------------------------------------------- */}
      <header className="signal-header">
        <button className="home-button" onClick={onHome} aria-label="Back to level map">
          <span>⌂</span>
        </button>

        <div className="level-label">
          <div className="level-number">LEVEL 01</div>
          <div className="game-name">THE SIGNAL</div>
        </div>

        <div className="header-spacer" />

        <div className="stat-pill">
          <span className="stat-title">MOVES</span>
          <strong className="stat-value">
            {moves}/{par}
          </strong>
        </div>

        <div className={`stat-pill${timeCritical ? " critical" : ""}`}>
          <span className="stat-title">TIME</span>
          <strong className="stat-value">{timeLabel}</strong>
        </div>

        <button className="icon-button" onClick={onRestart} aria-label="Restart level">
          ↻
        </button>

        <button
          className="icon-button"
          onClick={onToggleMuted}
          aria-label={muted ? "Turn sound on" : "Mute sound"}
        >
          {muted ? "◌" : "♪"}
        </button>
      </header>

      {/* ------------------------------------------------------
          TARGET WORDS AREA (Matching Pic 2)
      ------------------------------------------------------- */}
      <section className="target-area">
        <div className="target-bracket-header">
          <span className="target-label">TARGET WORDS</span>
        </div>

        <div className="target-word-row">
          {GRID_TARGET_WORDS.map((word, index) => (
            <div key={index} className="target-tile-box">
              {word.split("").map((ch, ci) => (
                <span key={ci} className="target-letter">
                  {ch}
                </span>
              ))}
            </div>
          ))}
        </div>

        <p className="target-instructions">
          Rearrange the tiles to form the target words.
          <br />
          <span>You can only move adjacent tiles.</span>
        </p>
      </section>

      {/* ------------------------------------------------------
          3D CUBE INTERACTION OVERLAY (For touch, drag & test runners)
      ------------------------------------------------------- */}
      <main className="board-area">
        <div className={`board-glow${victory ? " victory" : ""}`} />

        <div className="signal-board">
          {grid.split("").map((letter, index) => (
            <button
              key={index}
              className={[
                "signal-tile",
                selected === index ? "selected" : "",
                hintCells?.includes(index) ? "hinted" : "",
                isMatched(index) ? "matched" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onPointerDown={handlePointerDown(index)}
              onPointerUp={handlePointerUp(index)}
              onPointerEnter={() => {
                hoveredCellRef.current = index;
              }}
              onPointerLeave={() => {
                if (hoveredCellRef.current === index) hoveredCellRef.current = null;
              }}
              aria-label={`Tile ${index}: ${letter}`}
            >
              <span className="sr-only">{letter.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </main>

      {/* ------------------------------------------------------
          NOTIFICATION TOAST
      ------------------------------------------------------- */}
      {message && (
        <div className={`signal-toast${messageIsError ? " error" : ""}`}>{message}</div>
      )}

      {/* ------------------------------------------------------
          BOTTOM CONTROLS (Matching Pic 2)
      ------------------------------------------------------- */}
      <div className="bottom-hud">
        <div className="left-controls">
          <button className="hint-pill-button" onClick={onHint}>
            <div className="pill-bracket left" />
            <div className="hint-bulb-icon">💡</div>
            <span className="hint-pill-text">HINT {hintStage ? "1/2" : ""}</span>
            <span className="hint-pill-dash">—</span>
          </button>

          <button className="undo-pill-button" onClick={onUndo} disabled={!canUndo}>
            ↶ UNDO
          </button>
        </div>

        <div className="right-controls">
          <div className="control-guide-pill">
            <div className="guide-bracket left">&lt;</div>
            <div className="guide-cross-icon">✛</div>
            <div className="guide-text-stack">
              <strong>DRAG / SWIPE TO MOVE</strong>
              <small>TAP TWO NEIGHBOURS TO SWAP</small>
            </div>
            <div className="guide-bracket right">&gt;</div>
          </div>
        </div>
      </div>
    </div>
  );
}


# WORDSHIFT

> **You aren't guessing words. You are manipulating words.**

A CrazyGames-ready word-ladder puzzle built with React, TypeScript, Vite, and Three.js. The player changes one letter at a time; every intermediate state must be a curated common English word. Twenty-two solver-validated levels across six worlds climb from basic transforms to lock-breaking wildcards, authored two-word reactions, and deep-difficulty finale worlds — each rendered over a procedural animated real-place backdrop with the level's playable word graph drawn as a living constellation.

## Run locally

```bash
npm install
npm run graph       # rebuild dictionary + adjacency graph offline
npm run validate    # validate all 22 levels and bake optimal paths
npm test            # engine/solver/validator tests
npm run dev         # http://localhost:5173 (override with --port)
npm run build       # production output in dist/
npm run preview     # preview the exact production bundle
```

Node.js 20+ is recommended.

## Architecture

- `scripts/build-word-graph.ts` intersects a frequency-ranked 10,000-word list with a curated English lexicon, applies a PEGI-oriented content filter, builds one-letter adjacency, and writes static JSON. The browser never builds the graph.
- `src/engine/puzzleSolver.ts` performs breadth-first search over full puzzle states, including locked positions, wildcard consumption, and scripted reactions. First result is therefore optimal.
- `src/engine/puzzleValidator.ts` is the pre-ship gate: dictionary membership, reachability under active constraints, true shortest length, and unintended-shortcut detection.
- `scripts/validate-levels.ts` validates the complete campaign and writes solver-derived `optimalMoveCount`, `optimalPath`, and wildcard requirements into the shipped level pack. It also enforces the difficulty ladder: levels 13–22 must each be strictly harder than the level before them.
- `src/three/wordScene.ts` renders interactive letter tiles with Three.js, joined by glowing letter chains so each word reads as a connected circuit. Motion is delta-time based and honors `prefers-reduced-motion`.
- `src/engine/graphLayout.ts` extracts each level's playable state graph (vertices = word states, edges = legal moves); the scene draws it as an animated constellation with trail pulses, and reveals the optimal route on victory.
- `src/three/backdrop.ts` builds a procedural animated real-place scene per level — glacier aurora, sunken library, volcano, deep-sea wreck, storm, orbit, reactor, singularity, and more — from silhouettes, sky gradients, ambient particles and specials. No image assets.
- `src/components/` provides the responsive portal UI, keyboard/touch letter input, escalating solver-derived hints, scoring, level map, and completion flow.
- `src/engine/progressManager.ts` stores stars, best moves, best times, hint counts, and sound preference in `localStorage`. It degrades gracefully when iframe storage is denied.

## Campaign

| World | Levels | Mechanic | Optima |
|---|---|---|---|
| 01 The Signal | 1–4 | Level 1 is the **Signal Cube** — a 3D 3×3 glass-tile cube over a lit podium in a cyan plexus sanctum. Three 3-letter targets (CAT / DOG / SUN); swap adjacent tiles (tap-tap or drag, smooth glide) until the rows **or columns** read the targets. Matched lines get a rotating comet ring; solving fires a grand victory sequence and a shaking "LEVEL FINISHED" title card. **1:30 time limit** — run out and it's game over. The rest are base one-letter transforms | 3–8 swaps / 3–5 |
| 02 The Vault | 5–8 | Locked tiles + mandatory wildcard | 4–7 |
| 03 The Mirror | 9–12 | Two linked words, scripted reactions | 5–8 |
| 04 The Depths | 13–16 | Deep five-letter ladders, sealed tiles | 9–12 |
| 05 The Storm | 17–20 | Twin five-letter ladders with synced reactions | 13–16 |
| 06 The Core | 21–22 | Locks + wildcard + reactions combined | 17–18 |

Cube par is computed by a bidirectional BFS over all 9! swap permutations (`src/engine/gridLevel.ts`); its hints, stars and undo follow the same solver-derived rules as the ladder worlds. The scramble is seeded, so every player gets the same cube.

Every backdrop is a themed real place tied to the level's words (glacier for COLD→WARM, library for BOOK→HOME, volcano for FIRE→COAL, and so on).

## Controls

Level 1 (Signal Cube): tap a tile then an adjacent tile to swap, or drag a tile toward its neighbour. Arrow keys move the selection and swap; rows reading a target word light up gold.

Ladder levels (2–22):

1. Click or tap a tile.
2. Pick a replacement letter, or type it on a keyboard.
3. Every result must be a valid common word.
4. Use **Undo** to reverse a shift and **Hint** up to three times for escalating guidance.
5. In World 2, a wildcard can break one locked tile. In World 3, specific letter changes trigger a linked word reaction.

## CrazyGames Basic Launch checklist

- [x] Static HTML5 build; no server, login, SDK, ads, cookies, or external runtime requests.
- [x] Relative Vite asset paths (`base: './'`) for CDN/iframe hosting.
- [x] Responsive down to 360 CSS pixels and landscape 16:9 iframe layout.
- [x] Mouse, touch, and keyboard controls.
- [x] Audio starts only after user interaction; mute control included.
- [x] Page prevents scroll/overscroll and browser selection during gameplay.
- [x] Delta-time animation; display refresh-rate independent.
- [x] WebGL renderer caps device pixel ratio for Chromebook/mobile performance.
- [x] `prefers-reduced-motion` support.
- [x] Curated, filtered PEGI 12-oriented playable vocabulary.
- [x] Production build far below the 20 MB mobile-homepage threshold and 1,500-file limit.
- [x] No Canvas particle framework or third-party telemetry.
- [x] Natural future ad breaks exist only between levels/worlds; no SDK integration in Basic Launch.

### Portal packaging

Run `npm run build`, then ZIP the **contents** of `dist/` so `index.html` is at the archive root. Upload that ZIP as the Basic Launch build. Do not add the CrazyGames SDK until a Full Launch invitation.

Before upload, manually test the ZIP-served build in current Chrome, Edge, and Safari; check touch behavior on one Android/iOS device and verify WebGL is enabled on a 4 GB Chromebook-class device.

## Validation rules

A level is rejected when:

1. A start, target, or traversed word is absent from the curated dictionary.
2. No path exists under its real locks, wildcard budget, and reaction rules.
3. The solver finds a shorter route than the designer intended.
4. Level data is structurally invalid.

`npm run validate` must exit successfully immediately before each release build.

## MVP scope

Included: 22 levels across six worlds, base ladders, locks, one-use wildcards, authored reactions, solver-generated hints, stars, timer, local progress, touch/keyboard input, per-level animated backdrops, and the word-graph constellation.

Explicitly excluded: gravity, forbidden-word traps, timed decay, branching or dual targets, 100-level campaign, endless mode, daily challenge, SDK, and ads.

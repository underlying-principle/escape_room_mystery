# WORDSHIFT release gate

Run from the project root before creating a portal ZIP:

```bash
npm ci
npm run graph
npm test
npm run validate
npm run build
```

## Automated acceptance

- All solver, constraint, reaction, validator, and scoring tests pass.
- All 12 campaign levels pass the real constrained solver.
- The validator writes true optimal paths and finds no unintended shortcut.
- TypeScript strict checking passes.
- Vite production build succeeds.
- `dist/` remains below 20 MB and below 1,500 files.
- The final build contains no `http://` or `https://` runtime dependency.

## Manual acceptance matrix

| Target | Viewport | Required check |
|---|---:|---|
| Chrome / Edge | 1280×720 iframe | Map, all controls, WebGL tile selection, hints, completion, persistence |
| Chrome | 360×640 | No overflow; tile and letter-picker targets remain usable |
| Safari | current macOS/iOS | WebGL, audio after gesture, localStorage fallback |
| Chromebook class | 1366×768 / 4 GB | Stable input and animation; no sustained frame stalls |

For each world, complete at least one level by hand. For World 2, verify the wildcard is consumed only on a locked edit. For World 3, verify both the board and move history reflect the forced reaction in one move.

## ZIP

1. Build with `npm run build`.
2. ZIP the contents of `dist/`, not the directory itself.
3. Confirm `index.html` is at ZIP root.
4. Serve the extracted ZIP over HTTP and replay the smoke test.
5. Upload as CrazyGames Basic Launch without SDK or ad code.

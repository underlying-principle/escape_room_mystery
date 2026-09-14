# SAVE_SYSTEM_AUDIT — THE SIGNAL

Architecture: `src/services/saveService.ts` — single authoritative model (`the-signal-save-v1`), schema version 1, optional CrazyGames Data sync (newest `savedAt` wins), debounced ordinary writes (800 ms), immediate writes for completions/unlocks/checkpoint-critical moments, `pagehide`/`visibilitychange` flush guarded by a dirty flag (a stale snapshot can never clobber newer storage).

| Scenario | Status |
|---|---|
| New player → fresh save, boots into Level 1 | PASS (e2e) |
| Complete Level 1 → S02 unlocks, survives reload | PASS (e2e) |
| Quit mid-level → checkpoint written immediately per move | PASS (e2e) |
| Reload mid-level → RESUME with exact board (tile-ID permutation), moves, elapsed time, hints | PASS (e2e) |
| Complete level → checkpoint cleared | PASS (unit) |
| 3 stars / best time / best moves persist across reload | PASS (unit) |
| Malformed JSON → safe fresh save, no crash | PASS (unit) |
| Partially corrupt fields → sanitized per-field | PASS (unit) |
| Migrations | PASS (schema version field present; v1 is the first version — future migrations hook here) |
| Map position/zoom restored | PASS (e2e seeds map pos; map restores) |
| Guest / SDK absent / adblock | PASS (localStorage-only path fully functional) |
| Storage denied (privacy iframe) | PASS (gameplay continues, progress lives in session memory) |

Known limitations (honest):
- Multi-tab simultaneous play is last-writer-wins (acceptable for a portal puzzle game).
- CrazyGames Data sync is exercised only when the portal SDK is present; locally it is untestable and marked MANUAL CHECK.

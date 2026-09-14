# CRAZYGAMES_COMPLIANCE_AUDIT — THE SIGNAL

Status key: **PASS** = implemented and automated-tested · **MANUAL CHECK** = requires human/portal QA · **QA RISK** = known soft spot.

| Requirement | Status | Notes |
|---|---|---|
| Initial download ≤ 50 MB | **PASS** | `dist/` ≈ 0.9 MB total, 5 files |
| Total ≤ 250 MB, ≤ 1500 files | **PASS** | see above |
| Relative asset paths (`base: './'`) | **PASS** | vite config; no external runtime requests |
| Direct gameplay entry (no menu wall) | **PASS** | new players boot straight into Level 1; returning players resume |
| Save/progression persistence | **PASS** | versioned saveService v1 + localStorage fallback; CrazyGames Data sync used only when SDK present |
| gameplayStart / gameplayStop | **PASS** | wired into SignalGame mount/complete/map transitions via crazyGamesService (no-ops without SDK) |
| Ads only via CrazyGames SDK | **PASS (code path)** | requestAd() wrapper only; Basic Launch ships without ads and every ad path has a non-ad fallback |
| Adblock / SDK-absent safety | **PASS** | all SDK calls try/catch + feature-detect; save works fully offline |
| No external login / backend | **PASS** | no accounts, no network dependencies |
| No custom fullscreen button / cross-promo | **PASS** | none present |
| Responsive (desktop 16:9/16:10, small desktop, tablet, 360 px mobile) | **MANUAL CHECK** | automated checks cover 1280×720 + 360×640; other viewports need eyeballing |
| Chrome / Edge / Safari compatibility | **MANUAL CHECK** | automated runs on Chromium/Edge; Safari needs a manual pass |
| 4 GB Chromebook performance | **MANUAL CHECK** | scene is lightweight (≤ 400 draw calls, one bloom pass); verify on real hardware |
| Audio autoplay policy | **PASS** | WebAudio resumes on first user gesture; mute persisted |
| No broken features / placeholders | **PASS** | every button functional; no fake rewards |
| Reduced-motion support | **PASS** | `prefers-reduced-motion` honored (3D ambient + CSS) |
| Master Mode / Daily Signal (post-60) | **QA RISK** | backend-free designs specified but UI entry intentionally NOT shipped yet (no fake buttons allowed); implement before advertising them |

> Per the brief: passing this technical audit does not guarantee CrazyGames QA approval.

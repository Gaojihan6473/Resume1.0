---
name: viewport-visual-check
description: >-
  Fast multi-viewport visual verification and screenshot capture for this app using Playwright Chromium.
  Use whenever inspecting UI/UX across screen sizes (2560px ultrawide, 1920px desktop, 1440px/1280px laptop,
  1024px compact, 390px mobile), verifying responsive layouts, checking topbar/panel alignment, or auditing
  visual regressions on `/editor`, `/applications`, `/analytics`, `/me`, or `/`.
---

# Multi-Viewport Visual Check

Reusable, fast procedure for capturing real Chromium screenshots and layout metrics across multiple screen sizes without wasting time on cold reloads, Vite HMR hangs, or CPU contention.

## Core Rules (Lessons Learned)

1. **Serve built `dist/` statically by default (skip Vite dev 30–50s dep-scan)**:
   - Cold `vite dev` re-optimizes `pdfjs-dist` / `docx` / `echarts` / `tesseract.js` on startup and can block the first `page.goto()` for 30–50s.
   - Always build first (`npm run build`, ~4.5s) and let the script serve `dist/` via its built-in in-process `node:http` SPA server (<5ms boot) while intercepting all `*.supabase.co` traffic locally with Playwright routes. Only pass `--dev` when explicitly testing unbuilt dev-only behavior.
2. **Reuse one page & switch `setViewportSize()` by default (`--mode=fast`)**:
   - Load the target route **once** in a single `BrowserContext`, wait for actual content readiness, then resize through all viewports via `page.setViewportSize()`.
   - Only pass `--mode=cold` (reload per viewport) when specifically verifying cold-start auto-fit/hydration logic.
3. **Never use `waitUntil: 'networkidle'` with Vite dev server**:
   - Vite HMR keeps an open WebSocket connection, causing `networkidle` to hang until timeout.
   - Always use `waitUntil: 'domcontentloaded'` plus an explicit visible content selector (e.g., `iframe[title="简历预览"]` -> `#resume-page-stack .resume-page-frame` on `/editor`, or page heading elsewhere).
4. **Never compete with heavy Vitest runs**:
   - Do **not** run `npm run check` / `vitest` in parallel with headless Chromium capture. Run them sequentially, or attach `--url=http://127.0.0.1:<port>` to an already-running server.
5. **Loopback execution on Windows**:
   - Try sandboxed first if unsure; if Chromium reports `net::ERR_NETWORK_ACCESS_DENIED` on `127.0.0.1`, rerun with `BypassSandbox: true` (the script uses synthetic fixture routes and never hits external networks or production Supabase).

## Quick Usage

Run the reusable helper [capture-viewports.mjs](./scripts/capture-viewports.mjs):

```bash
# Fast 6-viewport capture of /editor (default mode=fast, outputs to .cache/viewport-check)
node .agents/skills/viewport-visual-check/scripts/capture-viewports.mjs

# Custom route, sizes, and output directory (e.g., artifact directory for visual review)
node .agents/skills/viewport-visual-check/scripts/capture-viewports.mjs \
  --route=/editor \
  --sizes=2560x1440,1920x1080,1440x900,1280x800,1024x768,390x844 \
  --out=.cache/viewport-check

# Reuse an already-running local Vite server (finishes in ~3-5s)
node .agents/skills/viewport-visual-check/scripts/capture-viewports.mjs --url=http://127.0.0.1:5173

# Verify cold-start auto-zoom per viewport (reloads each size once)
node .agents/skills/viewport-visual-check/scripts/capture-viewports.mjs --mode=cold
```

## Verification Checklist After Capture

1. Read the script's JSON summary:
   - Check `docOverflow === false` and `topbarOverflow === false` for every viewport.
   - On `/editor`, check `leftPanel.right < centerLine`, `leftPanel.bottom === rightTray.bottom`, `hasCornerLauncher === 0`, and expected `zoom`.
2. Inspect the generated PNGs directly via `read_file` to catch subtle visual issues (clipping, alignment, text wrapping, z-index overlap) that DOM bounds alone can miss.
3. If presenting screenshots to the user in a markdown artifact, copy the PNGs into the conversation artifact directory first (or pass `--out=<artifactDir>`) and embed them with a `carousel`.

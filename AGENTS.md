# AGENTS.md

Repository-level guidance for coding agents (Codex, Claude Code, etc.).

## Project Overview
- Name: `main` (Resume Parser & Editor)
- Purpose: Parse resume files (`PDF/DOCX/TXT`) into structured data, edit in a visual form, preview A4 layout, export to `PDF/DOCX`.
- UI language: Primarily Chinese (keep existing labels/copy style unless explicitly requested otherwise).

## Tech Stack
- Frontend: React 19 + TypeScript + Vite 8
- Styling: Tailwind CSS 4
- State: Zustand
- Parsing: `pdfjs-dist`, `mammoth`, rule-based parser + optional AI parsing
- Export: service-side Chromium PDF rendering for official resume PDFs, `docx` for Word export. Legacy `jsPDF`/`html2canvas` dependencies may still exist, but do not use browser print/screenshot flows for official PDF output.
- Package manager: `npm` (lockfile present: `package-lock.json`)

## Repo Map
- `src/components/*`: UI modules (Upload, Editor, Preview, Toolbar)
- `src/store/resumeStore.ts`: central app state and mutation actions
- `src/parsers/*`: file parsing and AI/rule parsing flow
- `src/utils/exporters.ts`: PDF/DOCX export logic
- `src/types/resume.ts`: canonical data model
- `public/*`: static assets
- `supabase/.temp/*`: local CLI link metadata (generated files)

## Setup & Commands
- Install deps: `npm install`
- Start dev server: `npm run dev`
- Build production bundle: `npm run build`
- Lint: `npm run lint`
- Preview production build: `npm run preview`

## Testing & Validation
- There is currently no dedicated `test` script in `package.json`.
- Minimum validation for most changes:
- Run `npm run lint`
- Run `npm run build`
- If UI behavior changed, manually verify in `npm run dev` (upload, edit, preview, export path touched by the change).

## Working Agreements
- Keep changes scoped and minimal; do not refactor unrelated parts.
- Preserve existing component/file organization patterns.
- Do not commit secrets/tokens or hardcode new credentials.
- Update `README.md` when commands or user-facing behavior changes.

## PDF Export & Preview Agreements
- Product promise: the resume editor preview should feel real-time, and the exported PDF should match the preview in layout, pagination, fonts, and content as closely as the current architecture allows.
- Do not reintroduce `window.print()`, browser print CSS as the primary export path, DOM screenshot slicing, or full-page image PDF generation for official resume PDFs.
- Official PDF generation should go through `/render-resume-pdf` using a controlled Chromium runtime, A4 pages, `printBackground`, embedded Chinese fonts, and vector text.
- Resume PDF output must not depend on the user's OS fonts, browser print implementation, local DPI, or installed Chinese font fallback.
- The editor preview should remain lightweight and responsive. Do not generate a PDF on every edit; use HTML/iframe A4 preview for real-time editing and generate PDFs on explicit export or background save tasks.
- Preview-only state such as JD analysis focus/highlight must not be included in official PDFs or cached as the normal resume preview.
- If modifying resume rendering, keep these paths aligned: `src/utils/resumeHtmlRenderer.ts`, `scripts/resume-pdf-renderer.mjs`, `api/render-resume-pdf.js`, `scripts/pdf-render-server.mjs`, and the Vite dev middleware in `vite.config.ts`.
- If modifying pagination, verify multi-page resumes, long rich text, avatars/images, line-height changes, font switching, and JD analysis anchor scrolling.
- For Vercel deployment, avoid bundling a full Playwright browser into the function. Prefer `playwright-core` plus the configured serverless Chromium package, and watch function size limits.
- `VITE_PDF_RENDER_URL` should remain optional when same-origin `/render-resume-pdf` is available.
- When touching PDF or preview code, run at least `npm run lint`, `npm run build`, and `npm run check:encoding`.

## Product Clarification Heuristics
- Before large implementation changes, clarify the product-level acceptance criteria before choosing the technical mechanism.
- Separate user goals from implementation ideas. For example, "preview equals export" means real-time visual preview plus stable exported output; it does not automatically mean generating a PDF on every keystroke.
- Explicitly identify what must be deterministic, what can be async, and what can be cached.
- For "exactly the same" requirements, clarify whether the user means pixel-level identity, layout/pagination identity, or visual/semantic equivalence.
- Prefer low-risk incremental changes with a fallback path when the feature touches preview, export, save, upload, and deployment at the same time.

## Security Notes
- Treat API keys/tokens as sensitive.
- If touching code around AI parsing (`src/parsers/index.ts`, `src/store/resumeStore.ts`), prefer environment/config-based secrets over hardcoded values.

## Supabase Notes
- The active runtime project is `resume-parser` with ref `xvtklyowohmuqrolmgka`. Confirm `VITE_SUPABASE_URL` / `VITE_EDGE_FUNCTIONS_URL` before runtime or deployment work; local CLI link state under `supabase/.temp` is generated and is not version-controlled.
- The app may point to a different Supabase project through `.env`; for runtime auth work, confirm `VITE_SUPABASE_URL` / `VITE_EDGE_FUNCTIONS_URL` first instead of assuming `supabase/.temp/project-ref`.
- `supabase/.temp` files are generated state; avoid manual edits unless explicitly needed.

## Login Key Creation
- Login uses the `auth-sign-in` Edge Function. It hashes the submitted `sk-...` key with SHA-256, looks up `public.valid_keys.key_hash` where `is_active = true`, then generates a Supabase magic-link token server-side and exchanges it for a session. Do not reintroduce shared or hardcoded Auth passwords.
- To create new login keys, generate fresh `sk-...` plaintext keys, compute their SHA-256 hashes, create the corresponding Supabase Auth users through the Supabase Auth Admin API (not by direct SQL into `auth.users`), then insert `public.valid_keys` rows with `user_id`, `key_hash`, `key_name`, and `is_active = true`.
- Do not directly SQL-insert Auth users: rows can appear in `auth.users` while `supabase.auth.admin.getUserById` still fails with `用户不存在`.
- After creation, call `auth-sign-in` with each new plaintext key and verify a session is returned before giving the keys to the user.
- Plaintext login keys are only recoverable at generation time. Store or deliver them immediately; the database should retain only hashes. Do not commit generated keys or service-role tokens.
- If a temporary Edge Function is used to call the Auth Admin API, protect it during use and disable or remove it immediately after successful verification.

## Non-Source Artifacts
- `package/` and `supabase-2.90.0.tgz` are local installation artifacts from CLI setup flow.
- Do not rely on them for app logic; avoid editing unless task is specifically about CLI install/debug.

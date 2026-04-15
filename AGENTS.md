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
- Export: `jsPDF`, `html2canvas`, `docx`
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

## Security Notes
- Treat API keys/tokens as sensitive.
- If touching code around AI parsing (`src/parsers/index.ts`, `src/store/resumeStore.ts`), prefer environment/config-based secrets over hardcoded values.

## Supabase Notes
- This repo is CLI-linked locally to project ref `uxuyetdlhgjsbkguawzi` via `supabase/.temp/project-ref`.
- `supabase/.temp` files are generated state; avoid manual edits unless explicitly needed.

## Non-Source Artifacts
- `package/` and `supabase-2.90.0.tgz` are local installation artifacts from CLI setup flow.
- Do not rely on them for app logic; avoid editing unless task is specifically about CLI install/debug.

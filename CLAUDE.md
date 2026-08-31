# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a **Resume Parser & Editor** — a React web app that parses resume files (PDF/DOCX/TXT), presents structured data in a visual editor, renders A4 previews, tracks job applications, runs JD-based resume analysis, and exports to PDF/DOCX.

- UI language: Primarily Chinese (preserve existing labels/copy style unless asked to change)
- Tech stack: React 19 + TypeScript + Vite 8 + Tailwind CSS 4 + Zustand + React Router 7
- Drag-and-drop: `@dnd-kit/core` + `@dnd-kit/sortable` (section reordering, sortable module wrappers)
- Charts: `echarts` / `echarts-for-react` and `recharts` (analytics dashboards)
- OCR fallback: `tesseract.js` (used inside `parsers/jdParser.ts` for image JD inputs)

## Commands
```bash
npm install        # Install dependencies
npm run dev        # Start Vite dev server
npm run build      # Production build (tsc -b && vite build)
npm run lint       # ESLint check
npm run preview    # Preview production build
npm run check:encoding   # Scan src/ and supabase/functions/ for mojibake text (exits non-zero on hits)
```

There is no test script — minimum validation for a change is `npm run lint`, `npm run build`, and (if UI behavior changed) a manual pass through the affected flow in `npm run dev`.

## High-Level Architecture

### Two parallel pipelines share the resume store
```
┌──────────────────────────┐    ┌─────────────────────────────┐
│  Resume parsing path     │    │  JD analysis path           │
│  Upload file             │    │  Application JD modal /     │
│  → parsers/* (PDF/DOCX/  │    │  EditorAnalysisLayout tab   │
│    TXT, AI or rule)      │    │  → Analytics/jdAnalysis.tsx │
│  → utils/template.ts    │    │    (AI over MiniMax)        │
│    (applyReference…      │    │  → analytics types +        │
│    Template normalizes)  │    │    utils/analysisAnchors.ts │
│  → resumeStore           │    │  → Suggestions hover/click  │
└──────────────────────────┘    └─────────────────────────────┘
         │                                       │
         └──────────────┬────────────────────────┘
                        ↓
              Editor + Preview + Sidebar
```

### Parsing & export modules
- `src/parsers/pdfParser.ts` — `pdfjs-dist`
- `src/parsers/docxParser.ts` — `mammoth`
- `src/parsers/textParser.ts` — raw text
- `src/parsers/ruleParser.ts` — regex fallback when AI is disabled
- `src/parsers/index.ts` — `parseFile()` + `parseByAI()` (MiniMax API, JSON-schema prompt)
- `src/parsers/jdParser.ts` — JD extraction (AI prompt + OCR for image inputs)
- `src/utils/template.ts` — `applyReferenceTemplate()` cleans/normalizes every field
- `src/utils/exporters.ts` — PDF (html2canvas + jsPDF) and DOCX (`docx`) exporters
- `src/utils/richText.ts` — plain text / bullets → HTML used by Preview's `rich-content` styles
- `src/utils/analysisAnchors.ts` — stable DOM anchor keys so JD suggestions can hover/click into Editor sections

### Editor layout
- `src/components/Editor/EditorAnalysisLayout.tsx` — hosts both the `Editor` and the JD analysis panel; routes between the two via `activeTab`.
- `src/components/Editor/Editor.tsx` — tabs (`edit` | `analysis` when JD present). Sub-modules are self-contained: `BasicInfo`, `Education`, `Internship`, `Project`, `Skills`, `Summary`, `RichTextEditor`. Sortable wrappers use `@dnd-kit`.
- `src/components/Preview/Preview.tsx` + `PreviewContent.tsx` — A4 page renderer (single- and multi-page modes).
- `src/components/Sidebar/` — `Sidebar` + `useHoverSidebar` hook. Hover the top-left brand area; sidebar stays open while pointer is over it, then closes after a short delay when it leaves both the trigger and the sidebar.
- `src/components/Toolbar/Toolbar.tsx` — actions (save, export, sidebar trigger, auth-required event).

### Two-zone split (home route)
- Left: Editor (~45% width)
- Right: Preview (~55% width)
- Sidebar overlays with a backdrop; positioning uses `topOffset` and `backdropTop` props (toolbar height = 56px).

## Routes (App.tsx)
| Path | Auth | Purpose |
| --- | --- | --- |
| `/login` | public | Login page |
| `/me` | protected | Resume list, sync, account |
| `/applications` | protected | Job application tracker |
| `/analytics` | protected | Delivery/sourcing analytics dashboards |
| `/` | public | HomePage when idle/parsing; Editor + Preview when a resume is loaded |

Unknown paths redirect to `/`.

## State Stores
- `resumeStore` — `resumeData`, `parseStatus`, `rawText`, `zoom`, `showMultiPage`, `isAIEnabled`, `apiKey`, `isDirty`, `currentResumeId`, `currentFile`, `cachedResumes`. Mutations live alongside the data (e.g. `addEducation`, `reorderSections`, `updateStyle`).
- `authStore` — `isAuthenticated`, `user`, `authInitializing`, plus `checkSession()` called once on app mount.
- `applicationStore` — applications list, status mutations, sync with Supabase.
- `analyticsStore` — analytics queries and aggregations.

## Authentication
- Login uses the Supabase Edge Function `auth-sign-in` with an `sk-...` API key.
- The function SHA-256 hashes the key, looks up `public.valid_keys.key_hash` where `is_active = true`, then generates a Supabase magic-link token server-side and exchanges it for a session.
- Session is stored in the Supabase client; auth state hydrates on app mount via `checkSession()`.
- `ProtectedRoute` guards `/me`, `/applications`, `/analytics`. `AuthRequiredModal` is shown when an unauthenticated user tries `new` / `upload` from the Toolbar/Upload (the `auth:required` window event carries the original action so the login redirect can resume it).
- API key for resume AI parsing lives in Zustand (`resumeStore.apiKey`); API key for JD analysis is read from `import.meta.env.VITE_MINIMAX_API_KEY` (see `.env.example`).

## Dirty State Navigation
When `isDirty` is true and the user navigates away from `/` or to `/me`, `DirtyConfirmModal` offers **Save & Navigate**, **Discard & Navigate**, or **Cancel**. `App.tsx` wires both `home` and `me` targets to the same modal.

## Key Data Shapes
- `ResumeData` (`src/types/resume.ts`): `basic`, `education[]`, `internships[]` (with nested `projects[]`), `projects[]`, `summary` (`text` | `highlights` mode), `skills` (`technical`, `languages`, `certificates`, `interests`), `style` (font/spacing), `sectionOrder`.
- `AppState`: store interface in the same file (see "State Stores" above for the headline fields).
- `Resume` (`src/lib/api.ts`): cloud entity — `id`, `user_id`, `title`, `content` (JSON), `source` (`local` | `cloud` | `blank`), `created_at`, `updated_at`.

## Key Files
- `src/App.tsx` — Router, auth init, modal coordination, conditional editor/home rendering
- `src/store/resumeStore.ts` — Main resume state
- `src/store/authStore.ts` — Auth session
- `src/lib/api.ts` — Supabase resume CRUD + Edge Function auth calls
- `src/lib/supabase.ts` — Supabase client init
- `src/utils/exporters.ts` — PDF/DOCX export
- `src/parsers/index.ts` — `parseFile()` / `parseByAI()`
- `src/parsers/jdParser.ts` — JD extraction + OCR fallback
- `src/utils/analysisAnchors.ts` — suggestion ↔ editor anchor key resolver
- `scripts/check-mojibake.mjs` — backs the `check:encoding` script

## Working Agreements
- Keep changes scoped and minimal; do not refactor unrelated parts.
- Preserve existing component/file organization patterns.
- No secrets in commits. Treat API keys/tokens as sensitive; prefer env/config for new secrets.
- When touching AI parsing (`src/parsers/index.ts`, `src/parsers/jdParser.ts`, `src/store/resumeStore.ts`) keep credentials out of source.
- Update `README.md` when commands or user-facing behavior changes.

## Login Key Provisioning (Supabase)
- Generate a fresh `sk-...` plaintext key. Compute its SHA-256 hash.
- Create the linked Supabase Auth user via the **Auth Admin API** (not by direct SQL into `auth.users` — direct inserts can leave `auth.users` rows that `supabase.auth.admin.getUserById` still reports as "用户不存在").
- Insert `public.valid_keys` with `user_id`, `key_hash`, `key_name`, `is_active = true`.
- Call `auth-sign-in` with each new plaintext key and verify a session is returned before handing keys over.
- Do not use shared or hardcoded Auth passwords for key login.
- Plaintext keys are only recoverable at generation — deliver/store them immediately; the DB keeps only hashes. Never commit generated keys or service-role tokens.
- If a temporary Edge Function calls the Auth Admin API, protect it during use and disable/remove it immediately after verification.

## Supabase / Env Notes
- `.env` is the runtime source of truth. Confirm `VITE_SUPABASE_URL` and `VITE_EDGE_FUNCTIONS_URL` before assuming the `supabase/.temp/project-ref` value (they may differ).
- `supabase/.temp/` is generated CLI state — do not hand-edit.
- `package/` and `supabase-2.90.0.tgz` are local install artifacts; avoid editing unless debugging CLI install.

## Non-Source Artifacts
- `package/` — local Supabase CLI npm package artifact
- `supabase/` — CLI project metadata
- `supabase-2.90.0.tgz` — CLI tarball
- These are installation artifacts; avoid editing unless debugging CLI setup

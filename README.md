# Resume Parser & Editor

A React + TypeScript + Vite app for importing resumes (`PDF/DOCX/TXT`), extracting structured fields, editing content, previewing A4 layout, and exporting to `PDF/Word`.

## Features

- Upload and parse resume files
- Rule-based section extraction (basic info, education, internships, projects, summary, skills)
- Visual editor + live A4 preview from the same HTML used for PDF export
- Save/load resumes with Supabase
- Track applications and review delivery dashboard
- JD analysis runs inside the resume editor
- Hover the top-left brand area to open the side navigation; it closes after the pointer leaves the trigger and sidebar.
- Export vector PDF / DOCX

## Tech Stack

- React 19
- TypeScript
- Zustand (state)
- Vite 8
- Tailwind CSS 4
- pdfjs-dist / mammoth (text extraction)
- Playwright PDF rendering + docx (export)

## Scripts

```bash
npm run dev
npm run pdf:server
npm run lint
npm run build
npm run preview
npm run check:encoding
```

## Notes

- Resume/JD parsing calls are proxied through the `minimax-chat` Supabase Edge Function. Configure `MINIMAX_API_KEY` on the Edge Function environment; do not expose it as a `VITE_` frontend variable.
- JD analysis calls are proxied through the `deepseek-chat` Supabase Edge Function and use `deepseek-v4-flash`. Configure `DEEPSEEK_API_KEY` on the Edge Function environment; do not expose it as a `VITE_` frontend variable.
- Login uses the `auth-sign-in` Supabase Edge Function: it verifies an `sk-...` key against `public.valid_keys`, then exchanges a server-generated magic-link token for a Supabase Auth session. Configure `SUPABASE_SERVICE_ROLE_KEY` for auth and AI Edge Functions.
- The `resumes` storage bucket is private. The frontend stores object paths in `file_url` / `preview_url` and resolves them to signed URLs when rendering.
- The editor preview renders the same A4 HTML document that is sent to Playwright for PDF export. In local `npm run dev`, Vite serves `/render-resume-pdf` directly, so a separate 8787 service is not required for development. For production or standalone rendering, set `VITE_PDF_RENDER_URL` to the Node Playwright service from `npm run pdf:server`.
- For production, set `ALLOWED_ORIGINS` on auth Edge Functions to a comma-separated list of trusted browser origins.
- Production build uses code splitting for parser/export modules.

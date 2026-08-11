# Resume Parser & Editor

A React + TypeScript + Vite app for importing resumes (`PDF/DOCX/TXT`), extracting structured fields, editing content, previewing A4 layout, and exporting to `PDF/Word`.

## Features

- Upload and parse resume files
- Rule-based section extraction (basic info, education, internships, projects, summary, skills)
- Visual editor + live A4 preview from the same HTML used for PDF export
- Save/load resumes with Supabase
- Track applications in a delivery dashboard with shareable URL filters and switchable detail, status-distribution, and resume-job relationship views
- The signed-in homepage paginates resume cards 5 at a time and job cards 8 at a time with looping previous/next controls and a lightweight slide transition.
- JD analysis runs inside the resume editor with a viewport-height input panel; the editor column stays fixed while long JD content scrolls inside the text area
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
- The editor preview renders the same A4 HTML document that is sent to Playwright for PDF export. In local `npm run dev`, Vite serves `/render-resume-pdf` directly. On Vercel, `/render-resume-pdf` is rewritten to the Node Function in `api/render-resume-pdf.js`. For a separate render service, set `VITE_PDF_RENDER_URL`.
- For production, set `ALLOWED_ORIGINS` on auth Edge Functions to a comma-separated list of trusted browser origins.
- Production build uses code splitting for parser/export modules.

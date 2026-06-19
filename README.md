# Resume Parser & Editor

A React + TypeScript + Vite app for importing resumes (`PDF/DOCX/TXT`), extracting structured fields, editing content, previewing A4 layout, and exporting to `PDF/Word`.

## Features

- Upload and parse resume files
- Rule-based section extraction (basic info, education, internships, projects, summary, skills)
- Visual editor + A4 preview
- Save/load resumes with Supabase
- Track applications and review delivery dashboard
- JD analysis runs inside the resume editor
- Hover the top-left brand area to open the side navigation; it closes after the pointer leaves the trigger and sidebar.
- Export to PDF / DOCX

## Tech Stack

- React 19
- TypeScript
- Zustand (state)
- Vite 8
- Tailwind CSS 4
- pdfjs-dist / mammoth (text extraction)
- html2canvas + jsPDF + docx (export)

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run preview
npm run check:encoding
```

## Notes

- MiniMax calls are proxied through the `minimax-chat` Supabase Edge Function. Configure `MINIMAX_API_KEY` on the Edge Function environment; do not expose it as a `VITE_` frontend variable.
- Production build uses code splitting for parser/export modules.

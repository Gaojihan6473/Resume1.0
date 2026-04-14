# Resume Parser & Editor

A React + TypeScript + Vite app for importing resumes (`PDF/DOCX/TXT`), extracting structured fields, editing content, previewing A4 layout, and exporting to `PDF/Word`.

## Features

- Upload and parse resume files
- Rule-based section extraction (basic info, education, internships, projects, summary, skills)
- Visual editor + A4 preview
- Save/load local draft
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
```

## Notes

- Draft is stored in `localStorage` under key `resume_draft`.
- Production build uses code splitting for parser/export modules.

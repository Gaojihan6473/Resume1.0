# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a **Resume Parser & Editor** — a React web app that parses resume files (PDF/DOCX/TXT), presents structured data in a visual editor, renders A4 previews, and exports to PDF/DOCX.

- UI language: Primarily Chinese (preserve labels/copy style)
- Tech stack: React 19 + TypeScript + Vite 8 + Tailwind CSS 4 + Zustand

## Commands
```bash
npm install        # Install dependencies
npm run dev        # Start dev server
npm run build      # Production build (tsc + vite)
npm run lint       # ESLint check
npm run preview    # Preview production build
```

## Architecture

### State Flow
```
Upload (file) → parsers/index.ts:parseFile()
                          ↓
              ┌─────────────────────────┐
              │  AI Parse (optional)   │ → MiniMax API → ResumeData
              │  Rule Parse (fallback) │
              └─────────────────────────┘
                          ↓
              utils/template.ts:applyReferenceTemplate()  (normalizes & sanitizes)
                          ↓
              store/resumeStore.ts (Zustand) → components re-render
```

### Parsing Pipeline
- **File extraction**: `pdfParser.ts` (pdfjs-dist), `docxParser.ts` (mammoth), `textParser.ts` (raw text)
- **AI parsing**: `parseByAI()` in `parsers/index.ts` calls MiniMax API with JSON schema prompt
- **Rule parsing**: `ruleParser.ts` regex-based fallback when AI is disabled/unavailable
- **Template normalization**: `applyReferenceTemplate()` in `utils/template.ts` cleans and normalizes all fields

### Editor Architecture
The editor is split into modular sections (Editor/, Preview/, Toolbar/, Upload/), each responsible for a specific UI domain. Editor sections are self-contained with their own state logic.

### Rich Text Rendering
- `utils/richText.ts` converts plain text/bullet points to HTML for the preview
- Preview uses `rich-content` CSS classes to style lists, bold, italic

### Export Pipeline
```
resumeData (Zustand) → utils/exporters.ts
                              ↓
              ┌────────────────┴───────────────┐
              ↓                                 ↓
      html2canvas + jsPDF              docx library
              ↓                                 ↓
         PDF blob                         DOCX blob
```

## Key Data Structures

### ResumeData (`src/types/resume.ts`)
- `basic`: name, contact, targetTitle, summaryTags
- `education[]`: school, major, degree, dates, GPA
- `internships[]`: company, position, projects[], content (rich text)
- `projects[]`: name, role, dates, content (rich text)
- `summary`: mode (text/highlights), text, highlights[], content
- `skills`: technical[], languages[], certificates[], interests[]
- `style`: fontFamily, fontSize, lineHeight, spacing

### AppState (`src/types/resume.ts`)
Zustand store includes: resumeData, parseStatus ('idle'|'parsing'|'success'|'error'), rawText, zoom, showMultiPage, isAIEnabled, apiKey

## Security Notes
- API key is stored in Zustand state (not env var) — treat as sensitive
- AI parsing flows through MiniMax API at `api.minimaxi.com`
- Never commit hardcoded credentials; use config-based secrets

## Non-Source Artifacts
- `package/` — local Supabase CLI npm package artifact
- `supabase/` — CLI project metadata
- `supabase-2.90.0.tgz` — CLI tarball
- These are installation artifacts; avoid editing unless debugging CLI setup

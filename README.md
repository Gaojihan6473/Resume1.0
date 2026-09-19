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
- Resume Agent uses a global launcher that expands upward to select a base resume and target job, then creates an independently reviewable job-specific version without overwriting the base resume. It is available to authenticated users by default.
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
npm test
npm run eval:resume-agent
npm run preview
npm run check:encoding
```

## Notes

- Resume/JD parsing calls are proxied through the `minimax-chat` Supabase Edge Function. Configure `MINIMAX_API_KEY` on the Edge Function environment; do not expose it as a `VITE_` frontend variable.
- JD analysis calls are proxied through the `deepseek-chat` Supabase Edge Function and use `deepseek-v4-flash`. Configure `DEEPSEEK_API_KEY` on the Edge Function environment; do not expose it as a `VITE_` frontend variable.
- Resume Agent uses the separate `resume-agent` Edge Function. The frontend is enabled by default and can be rolled back per environment with `VITE_RESUME_AGENT_ENABLED=false`; keep server-side `RESUME_AGENT_ENABLED=true` after deploying the function. The default Eval command validates 20 synthetic fixtures locally; add `-- --live` only for an explicit local DeepSeek run.
- Login uses the `auth-sign-in` Supabase Edge Function: it verifies an `sk-...` key against `public.valid_keys`, then exchanges a server-generated magic-link token for a Supabase Auth session. Configure `SUPABASE_SERVICE_ROLE_KEY` for auth and AI Edge Functions.
- The `resumes` storage bucket is private. The frontend stores object paths in `file_url` / `preview_url` and resolves them to signed URLs when rendering.
- The editor preview renders the same A4 HTML document that is sent to Playwright for PDF export. In local `npm run dev`, Vite serves `/render-resume-pdf` directly. On Vercel, `/render-resume-pdf` is rewritten to the Node Function in `api/render-resume-pdf.js`. For a separate render service, set `VITE_PDF_RENDER_URL`.
- For production, set `ALLOWED_ORIGINS` on auth Edge Functions to a comma-separated list of trusted browser origins.
- Production build uses code splitting for parser/export modules.

### Agent 任务隔离与恢复

- Agent 按账号、基础简历和目标岗位独立保存配置、进度、结果、审核决定与草稿。不同组合可以同时分析；切换简历或岗位不会中断其他任务。
- 编辑区只显示当前简历所选岗位的任务，右下角入口汇总运行数和待审核任务数，可按简历与岗位打开任务。每个组合保留最近一次任务，旧结果从分析历史查看。
- 手工 JD 使用公司、岗位名称和 JD 内容组成稳定标识。修改未运行的手工输入只更新配置草稿；已运行任务保留在任务列表。
- 当前浏览器标签页刷新后恢复已保存结果及审核决定；尚未完成的分析提示中断，不会自动重发模型请求。关闭标签页不保证恢复审核决定，可从服务端历史查看结果。缓存不可用时会提示恢复限制。
- 简历或岗位 JD 变化后，旧结果仍可查看，但校验通过或重新分析前不能应用建议或创建岗位版。取消、清空与重试只作用于指定任务。
- 岗位版独立保存。并发创建时，岗位关联使用条件更新；若关联已被其他任务修改，则保留所有产物并提示到岗位页手动选择，不覆盖已变更关联。
- 刷新时创建中的岗位版按运行标识查找已保存产物，防止重复生成。退出或切换账号会终止本地请求并清除当前账号的任务状态。

相关回归测试：`npm run test -- src/store/resumeAgentIsolation.test.tsx src/store/jdAnalysisHistoryStore.test.ts src/components/Agent`。

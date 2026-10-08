# Resume Parser & Editor

A React + TypeScript + Vite app for importing resumes (`PDF/DOCX/TXT`), extracting structured fields, editing content, previewing A4 layout, and exporting to `PDF/Word`.

## Features

- Upload and parse resume files
- Rule-based section extraction (basic info, education, internships, projects, summary, skills)
- Visual editor + live A4 preview from the same HTML used for PDF export
- Save/load resumes with Supabase
- Track applications in a delivery dashboard with shareable URL filters and switchable detail, status-distribution, and resume-job relationship views
- The signed-in homepage shows recruitment batch cards and one responsive row each of recently edited resumes and jobs. Each batch opens an independent workspace with the existing resume/job cards and responsive pagination.
- JD analysis runs inside the resume editor with a viewport-height input panel; the editor column stays fixed while long JD content scrolls inside the text area
- Resume Agent uses a global launcher that expands upward to select a base resume and target job, then creates an independently reviewable job-specific version without overwriting the base resume. It is available to authenticated users by default.
- The launcher task list uses compact single-line rows with color-coded status badges and scrolls when more tasks are present.
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
npm run test:batches
npm run test:workspace
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

### 批次工作空间与迁移

- 总首页展示平级批次，按创建时间倒序排列。批次可自定义名称、说明和预设主题色；最近简历和岗位分别按容器宽度展示一行（常规桌面宽度 5 份简历、4 条岗位），不提供翻页；后台 PDF 和缩略图生成不改变编辑排序。
- 首页仅纵向滚动。最近编辑分为上下两个区域，不单独显示“简历”“岗位”小标题及图标；简历和岗位均复用原首页（现批次详情）的卡片样式，所属批次可独立点击，编辑时间保留，长名称自动换行或截断。
- 求职空间首页与批次详情共用紧凑的渐变标题栏，统一高度、内边距、图标和文字对齐；长批次名称截断显示，说明放在标题栏下方，详情底色随批次主题色变化。顶部切换、岗位/统计页范围和管理侧栏中的来源/目标批次均复用统一下拉组件，展开菜单浮于侧栏之上；按 Esc 先收起下拉菜单。
- `/batches/:batchId` 展示该批次的简历和岗位，正文标题使用“求职空间 > 当前批次”面包屑；点击“求职空间”返回首页，支持悬停、按下和键盘聚焦反馈，顶部品牌旁不显示导航。新建、上传和岗位解析自动使用当前批次。`/editor?resumeId=...` 支持直接打开、刷新恢复及未保存修改保护。岗位页、面板使用 `?batch=...` 统一范围，省略时查看全部批次。
- 简历编辑页顶部直接显示工具栏，不额外展示“返回批次 / 所属批次”导航行；可通过品牌区域的侧栏导航离开编辑页，未保存修改仍需确认。
- 首页卡片菜单和详情页共用管理抽屉；批次详情页的卡片不显示多选框，也不提供“移动 / 复制”或“移动岗位”快捷入口，统一进入“管理批次 → 内容管理”后搜索、多选、移入、移出和复制简历。移动简历会带走全部关联岗位；单独移动岗位会在目标批次复制其关联简历，同次操作共享一份副本。确认前展示完整影响清单。
- 简历副本独立编辑，使用新的 ID、来源标记及资源路径，不复制 JD 分析和 Agent 历史。已有记录移动保留 ID 和历史。删除非空批次必须整体迁移到另一个批次，不生成副本；空的最后一个批次可直接删除。
- 迁移脚本为 `supabase/migrations/20261007_recruitment_batches.sql`。为每个已有用户创建“默认批次”并回填已有内容，保留原 ID 与关联。新用户仅初始化一次；主动删除后不会自动重建。旧客户端未传 `batch_id` 的创建请求优先沿用关联简历批次，否则使用现存默认/最早批次；没有批次时明确报错。
- 数据库使用用户隔离、批次归属与同批次简历关联约束。预览与执行 RPC 复核影响集合，关联变化要求重新确认；批量操作使用事务与请求 ID，防止部分迁移和重复生成副本。

上线时先核对 `.env` 的 `VITE_SUPABASE_URL` / `VITE_EDGE_FUNCTIONS_URL` 与 CLI 项目，目标应为 `resume-parser`（`xvtklyowohmuqrolmgka`）。先通过 Supabase CLI 登录或配置 `SUPABASE_ACCESS_TOKEN`，查看待执行迁移，再应用数据库迁移、发布 `resume-agent` Edge Function 和前端；不要先发布依赖新表的前端。

`npm run test:batches` 在隔离的 PGlite PostgreSQL 中执行实际迁移，覆盖回填、用户隔离、移动/复制/删除、重复提交、并发变更和事务回滚。`npm run test:workspace` 需要先启动 `npm run dev -- --host 127.0.0.1 --port 5175`，使用本机 Chrome/Edge；可通过 `WORKSPACE_TEST_URL`、`PDF_CHROMIUM_EXECUTABLE_PATH` 覆盖地址与浏览器路径。浏览器请求接入隔离数据库，不写入远程 Supabase，截图位于 `.cache/batch-check/`。

### Agent 任务隔离与恢复

- Agent 按账号、基础简历和目标岗位独立保存配置、进度、结果、审核决定与草稿。不同组合可以同时分析；切换简历或岗位不会中断其他任务。
- 编辑区只显示当前简历所选岗位的任务，右下角入口汇总运行数和待审核任务数，可按简历与岗位打开任务。每个组合保留最近一次任务，旧结果从分析历史查看。
- 手工 JD 使用公司、岗位名称和 JD 内容组成稳定标识。修改未运行的手工输入只更新配置草稿；已运行任务保留在任务列表。
- 当前浏览器标签页刷新后恢复已保存结果及审核决定；尚未完成的分析提示中断，不会自动重发模型请求。关闭标签页不保证恢复审核决定，可从服务端历史查看结果。缓存不可用时会提示恢复限制。
- 简历或岗位 JD 变化后，旧结果仍可查看，但校验通过或重新分析前不能应用建议或创建岗位版。取消、清空与重试只作用于指定任务。
- 岗位版独立保存。并发创建时，岗位关联使用条件更新；若关联已被其他任务修改，则保留所有产物并提示到岗位页手动选择，不覆盖已变更关联。
- 刷新时创建中的岗位版按运行标识查找已保存产物，防止重复生成。退出或切换账号会终止本地请求并清除当前账号的任务状态。

相关回归测试：`npm run test -- src/store/resumeAgentIsolation.test.tsx src/store/jdAnalysisHistoryStore.test.ts src/components/Agent`。

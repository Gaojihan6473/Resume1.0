# 运行配置与发布

[返回项目说明](../README.md)。本文记录当前行为与维护约定；后续变更更新对应条目。

## 技术栈

登录、岗位、面板、个人库和简历编辑界面按访问加载。看板只打包使用中的 ECharts 模块，PDF 缩略图渲染器在实际生成缩略图时加载。

- React 19
- TypeScript
- Zustand (state)
- Vite 8
- Tailwind CSS 4
- pdfjs-dist / mammoth (text extraction)
- Playwright PDF rendering + docx (export)

## 运行约定

### PDF 公共渲染与跨域配置

`scripts/resume-pdf-renderer.mjs` 提供 `prepareResumePdfHtml` 和 `renderResumePdf`，Vite、独立服务与 Vercel API 共用字体注入、HTML 隔离、字体等待、A4 参数及一次浏览器关闭重试。保留 HTML 快照输入（用于预览分页结果）和结构化数据回退（用于没有快照的客户端与保存版本）；移除回退前需确认这些调用方已不再需要。各入口管理启动、复用、缓存失效与浏览器释放，默认复用策略保持不变：Vite 复用，独立服务除非显式关闭否则复用，Vercel 仅在 `PDF_RENDER_REUSE_BROWSER=true` 时复用。

`PDF_RENDER_ALLOWED_ORIGINS` 支持逗号分隔的精确来源和显式 `*`。配置白名单后，不匹配或无 Origin 的请求不返回 `Access-Control-Allow-Origin`，OPTIONS 仍返回 204；POST 的 Bearer 鉴权保持独立执行。未配置时 Vercel API 保留反射来源的兼容行为，独立服务默认允许 `http://localhost:5173` 和 `http://127.0.0.1:5173`。生产跨域部署应显式设置白名单；CORS 不替代服务端鉴权。

### 导入、账户与存储

- AI resume import uses DeepSeek `deepseek-flash` through the `deepseek-chat` Edge Function. PDFs send bounded inline page images and positioned text blocks; DOCX/TXT send native content blocks. Model output identifies sections and source block references; the client assembles the original text, checks missing or conflicting blocks, retries the affected region once, and retains uncertain text in 其他补充 with a review warning. Rule parsing remains available if AI fails. Scans that cannot be read show an upload warning. Old `.doc` files require conversion to DOCX or PDF before upload.
- PDF imports keep the source section order, infer name/date alignment and body font size from text coordinates, remove header text already represented by fields, and join physical PDF line wraps inside each content item. The editable preview preserves the source's text layout where possible; photographs and decorative color blocks are not reconstructed. A resume with no uploaded avatar does not show a placeholder image.
- Set `VITE_RESUME_IMPORT_MODE=legacy` only to roll back resume import to the previous MiniMax route. This does not remove the new data categories. Keep `MINIMAX_API_KEY` on the Edge Function for this rollback and existing MiniMax calls; never use `VITE_` for API keys.
- JD analysis calls are proxied through the `deepseek-chat` Supabase Edge Function and use `deepseek-v4-flash`. Configure `DEEPSEEK_API_KEY` on the Edge Function environment; do not expose it as a `VITE_` frontend variable.
- Existing resumes are normalized on read: absent `studentWork`, `awards`, and `other` arrays become empty arrays. New content survives editing, saving, copying, preview, PDF, and Word export. Import status shows 读取文件、识别内容、检查完整性 and, when needed, 补充识别. Requests are isolated so cancelling or uploading a new file cannot apply an earlier result.
- Resume Agent uses the separate `resume-agent` Edge Function. The frontend is enabled by default and can be rolled back per environment with `VITE_RESUME_AGENT_ENABLED=false`; keep server-side `RESUME_AGENT_ENABLED=true` after deploying the function. The default Eval command validates 20 synthetic fixtures locally; add `-- --live` only for an explicit local DeepSeek run.
- Login uses the `auth-sign-in` Supabase Edge Function: it verifies an `sk-...` key against `public.valid_keys`, then exchanges a server-generated magic-link token for a Supabase Auth session. Configure `SUPABASE_SERVICE_ROLE_KEY` for auth and AI Edge Functions.
- The `resumes` storage bucket is private. The frontend stores object paths in `file_url` / `preview_url` and resolves them to signed URLs when rendering.
- Apply `supabase/migrations/20261030022811_close_resume_storage_public_access.sql` to remove legacy public/owner-only Storage policies that can bypass account isolation or key revocation. Active owners retain access to versioned assets and legacy `previews/<resume-id>.png` thumbnails. `npm run test:storage` reproduces the old anonymous access and verifies anonymous, cross-account, revoked-key and normal owner operations against the migration. Previously issued signed URLs are bearer links and can remain usable until expiry; changing RLS does not revoke those links.
- Generated PDFs and thumbnails use a new immutable object path for each version. Copies may share the saved snapshot, while later saves of the original write new objects and leave that snapshot intact. Existing fixed-path snapshots remain readable for their original resume and are no longer overwritten by new saves. Historical copies pointing at another resume's mutable PDF fall back to their own structured content; their next save creates fresh assets.
- Clearing imported personal-summary text is an explicit edit; saving does not restore the legacy text/highlights fields.
- The editor preview renders the same A4 HTML document that is sent to Playwright for PDF export. In local `npm run dev`, Vite serves `/render-resume-pdf` directly. On Vercel, `/render-resume-pdf` is rewritten to the Node Function in `api/render-resume-pdf.js`. For a separate render service, set `VITE_PDF_RENDER_URL`.
- Official PDF export uses server-side Chromium. Browser acceptance also reimports an exported DOCX through the actual importer to check XML parser compatibility.
- All PDF render entry points isolate client HTML: document scripts and network requests are disabled, active elements/attributes are removed, and only embedded `data:` images/fonts load. The normal avatar uploader already supplies an embedded image. Pagination geometry and server-embedded Chinese fonts are retained. Run `node scripts/pdf-render-security.check.mjs` with local Chromium to verify blocked requests, multipage Chinese text, and avatars.
- Signing out clears local credentials before attempting remote revocation, so a network outage cannot restore the local session on reload. Remote revocation is best effort with a five-second timeout; local cleanup failures remain visible instead of reporting success.
- In the Manage Batch drawer, clicking outside the drawer saves batch information changes before closing. If saving fails, the drawer stays open and shows the error.
- For production, set `ALLOWED_ORIGINS` on auth Edge Functions to a comma-separated list of trusted browser origins.
- Production build uses code splitting for parser/export modules.
- Import logs contain only stage, timing, block counts, and error category; raw resumes, images, and credentials must not be logged or committed. No cross-user parsing cache is used.

### Resume import release order

Run `npm test`, `npm run lint`, `npm run build`, and `npm run check:encoding`; verify multi-page previews and PDF/DOCX exports. Release the compatible `deepseek-chat` Edge Function and PDF renderer first, then the frontend. The renderer normalizes old and new resume data. Confirm `VITE_SUPABASE_URL` and `VITE_EDGE_FUNCTIONS_URL` point to the intended Supabase project before a release. This change does not deploy those services automatically.

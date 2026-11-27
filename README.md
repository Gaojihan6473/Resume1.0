# Resume Parser & Editor

面向求职流程的简历解析与编辑应用：管理招聘批次，导入 PDF / DOCX / TXT，在可视化表单中编辑并实时预览 A4 简历，导出 PDF / Word，关联岗位、查看投递看板，并使用 Resume Agent 创建独立的岗位版本。

## 本地启动

使用 Node.js 24 和 npm，依赖版本由 `package-lock.json` 锁定。

```bash
npm ci
npm run dev
```

本地运行需配置 `.env` 中的 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` 与 `VITE_EDGE_FUNCTIONS_URL`。项目与凭证配置见[密钥登录与云同步](./docs/auth-system-design.md)。模型密钥和服务端凭证只配置在服务端，不使用 `VITE_` 前缀。

Vite 开发服务直接提供同源 `/render-resume-pdf`，需要已安装的 Chrome / Edge 或 Playwright Chromium。可通过 `PDF_CHROMIUM_EXECUTABLE_PATH` 指定浏览器路径。无需单独启动 PDF 服务即可开发预览和导出。

## 主要能力

- 招聘批次、跨批次个人库和岗位关联管理。
- 从工作区顶栏左侧打开侧边导航，在主要页面间切换。在批次内可通过「当前批次」返回批次详情。
- AI 与规则解析导入，保留来源内容与待核对提示。
- 可视化编辑、HTML / iframe 实时预览、中文字体和多页布局。
- 服务端 Chromium 矢量 PDF、DOCX 导出及不可变 PDF / 缩略图版本。
- 账号隔离的云端保存、未保存修改保护和异步请求隔离。
- 自定义投递看板、JD 分析与可独立审核的 Resume Agent 岗位版本。

前端使用 React 19、TypeScript、Vite 8、Tailwind CSS 4 和 Zustand；解析使用 pdfjs-dist / mammoth，云端数据与鉴权使用 Supabase，导出使用 Playwright Chromium / docx。

## 开发与验证

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 本地开发，包含 PDF 渲染入口 |
| `npm run build` / `npm run preview` | 生产构建 / 本地预览构建 |
| `npm run pdf:server` | 启动独立 PDF 渲染服务 |
| `npm test` | 单元、组件及 PDF 服务回归测试 |
| `npm run check` | lint、测试、构建、编码检查 |
| `npm run check:core` | 基线检查及数据库、Storage 权限、Agent 合成评测 |
| `npm run check:acceptance` | 自动启动本地服务，运行 PDF 与浏览器工作流验收 |
| `npm run check:acceptance -- --pdf` | 仅 PDF 安全、中文字体与分页验收 |
| `npm run check:acceptance -- --workspace` | 仅工作区、导入、保存与导出浏览器验收 |

独立检查还有 `npm run lint`、`npm run check:encoding`、`npm run test:batches`、`npm run test:storage` 和 `npm run eval:resume-agent`。`npm run test:workspace` 是需要已启动服务的底层脚本，日常优先使用自动管理服务的验收入口。

完整流程见[日常开发与验收](./docs/development-workflow.md)：行为变更先建立失败证据，交付前运行受影响检查。验收使用合成数据、隔离数据库与模拟 AI / Storage，不代表生产服务或真实模型已验证。CI 见[quality.yml](./.github/workflows/quality.yml)，分支保护和发布门禁需单独配置。

## PDF 与部署

编辑时使用轻量 HTML / iframe 预览，导出或后台保存时才生成 PDF。正式 PDF 通过 `/render-resume-pdf` 使用受控 Chromium、A4 页面、嵌入中文字体与矢量文字；预览分析高亮不进入正式输出。

编辑器中的「导出 PDF」会等待当前版本的分页预览就绪，并按该分页生成 PDF。若预览未能就绪，界面会提示稍后重试。后台保存和 Agent 已创建版本的独立导出在缺少快照时仍可由 Chromium 分页。

- 本地开发：Vite 中间件。
- Vercel：同源路径重写到 `api/render-resume-pdf.js`，配置见 [vercel.json](./vercel.json)。
- 独立服务：`npm run pdf:server`，前端通过可选的 `VITE_PDF_RENDER_URL` 指向服务。

三个入口共用 `scripts/resume-pdf-renderer.mjs` 的字体注入、隔离页面、字体等待、A4 导出和一次浏览器关闭重试。浏览器启动与复用、鉴权和 HTTP 响应由各入口管理。

生产环境应配置 `PDF_RENDER_ALLOWED_ORIGINS` 为可信来源的逗号分隔列表；配置后不匹配或无 Origin 的请求不返回跨域允许头，POST 仍执行原有 Bearer 鉴权。显式 `*` 允许任意来源；未配置时 Vercel API 保持原有跨域兼容行为，独立服务默认仅允许本地开发来源。详细配置与发布顺序见[运行配置与发布](./docs/runtime-and-release.md)。

发布前核对目标项目和迁移，先部署兼容的数据库 / Edge Functions / PDF 服务，再发布依赖它们的前端。常规测试不自动发布或写入生产环境。

## 文档导航

| 文档 | 内容 |
| --- | --- |
| [AGENTS.md](./AGENTS.md) | 仓库结构、开发约束与代理工作约定 |
| [日常开发与验收](./docs/development-workflow.md) | 检查分层、异常探索、验收环境与证据边界 |
| [运行配置与发布](./docs/runtime-and-release.md) | 导入 / AI / PDF 配置、Storage 安全和发布顺序 |
| [密钥登录与云同步](./docs/auth-system-design.md) | 当前鉴权与账号数据行为 |
| [界面与交互约定](./docs/product-behavior.md) | 页面行为、控件与细粒度交互要求 |
| [批次工作空间与迁移](./docs/batch-workspace.md) | 批次、移动 / 复制 / 删除、看板与迁移要求 |
| [Agent 任务与历史](./docs/agent-task-guide.md) | 任务隔离、恢复、审核与历史清理 |
| [UI 约定](./docs/ui-conventions.md) | 共用样式、响应式布局与控件 |
| [待办需求](./docs/pending-requirements.md) | 后续产品需求 |

本地日志、`.cache/`、`.tmp/`、`output/`、覆盖率目录与 CLI 安装产物已配置忽略规则；已受 Git 跟踪的文件仍保留，设计稿按项目资料保留。不要提交真实简历、凭证或敏感日志。

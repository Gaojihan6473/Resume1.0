# 日常开发、测试与验收

本规范由 `AGENTS.md` 引用，适用于后续本项目开发。采用 Superpowers 的测试先行、根因排查、完成前验证原则，结合现有 Vitest、PGlite、Playwright 和 Chromium PDF 检查。使用仓库自身工具，不依赖全局安装整个 Superpowers，也不改变其他项目的工作流。

## 从需求到完成

1. **明确结果**：说明用户可观察的行为、受影响的数据/接口、验收条件。检查现有实现、工作区改动和测试。只有影响产品方向的实质歧义才需要澄清，常规实施选择自行处理。
2. **先建立失败证据**：行为变更和 Bug 修复先补最小回归用例，并运行确认失败原因符合预期。已有准确的失败用例可直接使用。测试应覆盖用户结果或持久化效果，而非复制实现细节；纯文档/外观变动不强制添加逻辑测试。
3. **查清根因**：先复现并沿 UI → 请求 → API → 数据 → 响应追踪。一次验证一个假设；连续失败则重审证据与设计，不累加猜测性补丁。日志保留状态、计数、时间和错误类型，不记录简历正文、密钥或签名链接。
4. **最小修改并转绿**：修复根因，运行原失败用例；需要重构时保留绿灯。保留用户已有工作，不为遵循流程删除既有实现。不通过弱化断言、跳过失败用例或降低安全要求“修好测试”。
5. **分层回归与探索**：按下表选择检查；涉及跨模块流程时检查真实浏览器和导出文件。根据改动主动增加异常路径，不把既有用例全绿视为穷尽所有风险。
6. **凭证据交付**：最后一次相关修改后运行对应检查，阅读实际输出和退出码。报告“改了什么、为什么、测试命令/结果、测试环境、仍未验证的内容”。未通过或被环境阻断的部分明确列出，不声称已完成该项验收。

## 按改动范围选择检查

| 改动 | 日常要求 | 额外验收 |
| --- | --- | --- |
| 文档、注释、纯文案 | 检查差异、链接与编码 | 不机械添加业务测试 |
| 局部组件/样式 | `npm run check`；涉及行为时先跑对应测试 | 浏览器验证受影响交互、窄屏、键盘；纯外观修改保留截图即可 |
| 保存、导入、共享状态、账号、Agent | `npm run check:core` | 完整用户路径＋对应异步/失败探索；跨模块时运行 `npm run check:acceptance` |
| 数据库、批次、Storage/RLS | `npm run check:core`；迁移在隔离数据库验证 | 匿名/其他账号/停用凭证拒绝、本人操作允许、事务/重试；部署后重新检查实际策略 |
| 预览、分页、PDF、Word | `npm run check:core`＋`npm run check:acceptance` | 多页、末条正文、头像、中文字体、行高/字体切换、JD 高亮不进入正式输出 |
| 发布 | `npm run check:core`＋`npm run check:acceptance` | 环境目标核对、兼容发布次序、真实环境抽查和回退路径 |

## 可重复命令

```bash
# 先跑单个行为用例（示例），观察正确的失败，再修改
npm test -- src/utils/saveResume.test.ts

# 日常代码基线：lint → 单元/组件 → build → 编码
npm run check

# 核心回归：基线 → 批次数据库 → Storage 权限 → Agent 合成校验
npm run check:core

# 完整验收：独立 PDF 回归 → 自动启停 Vite → 浏览器完整流程
npm run check:acceptance

# 仅验证对应路径
npm run check:acceptance -- --workspace
npm run check:acceptance -- --pdf
```

验收入口只监听 `127.0.0.1`，自动选择空闲端口，等待服务就绪并在成功、失败或中断时清理进程树；每个验收套件最多运行 5 分钟，超时按失败报告。Vitest 默认使用 1 个 worker，避免受限机器上多个 jsdom 套件争用资源导致 UI 定时器超时，功能断言与单用例超时不放宽；机器资源充分时可显式覆盖 `--maxWorkers`。同一台机器先跑核心检查再跑浏览器验收，CI 两类任务使用独立 runner。验收入口强制使用合成 Supabase 项目配置、隔离 PostgreSQL 和模拟登录/Storage/AI；不需要 `.env` 或生产凭证。已有 Chrome/Edge 可直接运行；没有浏览器时使用锁定依赖对应的 Chromium：

```bash
node node_modules/playwright-core/cli.js install chromium
# Linux CI 需要系统依赖时：
node node_modules/playwright-core/cli.js install --with-deps chromium
```

也可通过 `PDF_CHROMIUM_EXECUTABLE_PATH` 选择已有 Chromium。若沙箱阻止临时目录或本机连接，修正测试环境或使用获准的执行环境；不要关闭产品鉴权、放宽 RLS 或跳过断言。`npm run test:workspace` 是底层脚本，需要已启动的服务；日常优先使用自动管理服务的验收入口。

## 按风险做探索式验收

只选与本次改动有关的场景，记录操作和预期/实际结果；可自动化且有长期价值的已确认缺陷沉淀为回归用例。

- **保存/异步**：保存时继续编辑；保存未完成就切换简历；连点保存；后台 PDF 更新晚于新编辑；失败后重试。
- **导入**：取消后旧请求返回；连续上传两个文件；空文件、扫描件或超长输入；AI 失败后原文是否保留，状态是否准确。
- **账号/权限**：退出后迟到响应；账号切换；匿名/其他账号；停用凭证；旧文件与副本正常访问。
- **批次/关联**：移动关联岗位；多个岗位共享副本；确认前关系变化；操作中途失败；同请求重试不重复复制。
- **Agent**：切换简历时流仍返回；取消与错误流；补丁冲突、事实风险、逐项接受/撤销；基础简历不被覆盖。
- **预览/导出**：长文末条、跨页、头像、富文本；字体/行高变化；预览与 PDF 页数/内容；DOCX 重新提取正文检查。
- **多窗口/网络**：两窗口编辑同份简历、断网重连、超时与重试。尚无版本冲突保护时，明确记录后写覆盖风险，不能用单窗口通过代替此项结论。

## 发布与证据边界

`.github/workflows/quality.yml` 在 push/PR 上执行核心检查与独立浏览器验收，不使用生产 secrets，不部署或写线上。采用固定 Action 提交与 `npm ci`。文件提交并推送后 CI 才会生效；仓库的分支保护、required checks 和 Vercel 发布检查需单独配置，不能声称已有自动拦截发布能力。

本地记录 `.cache/quality/acceptance.json`、`.cache/quality/vite.log`；浏览器产物在 `.cache/batch-check/`，独立 PDF 结果在 `.tmp/pdf-security/`。CI 仅上传这些合成产物。不要上传 `.env`、真实用户简历、浏览器真实会话或敏感日志。

隔离数据库和模拟 AI/Storage 通过，只证明对应本地链路；真实供应商可用性、模型效果、生产对象存储、容量、备份恢复需独立验证。真实模型调用、线上写入与发布仍遵循用户任务范围，不由常规测试命令隐式触发。

## 方法来源

本项目按风险调整方法，不逐字执行上游的所有强制流程：

- [Superpowers — Test-Driven Development](https://github.com/obra/superpowers/tree/main/skills/test-driven-development)：行为改变前建立可信失败用例，再实现并保持回归通过。
- [Superpowers — Systematic Debugging](https://github.com/obra/superpowers/tree/main/skills/systematic-debugging)：复现、追踪根因、逐个检验假设。
- [Superpowers — Verification Before Completion](https://github.com/obra/superpowers/tree/main/skills/verification-before-completion)：完成结论建立在当前运行证据上。
- [Playwright CI](https://playwright.dev/docs/ci-intro)：浏览器依赖、CI 执行和测试产物管理。

上游更新先评估再调整项目规范，不自动拉取或执行远端技能内容。

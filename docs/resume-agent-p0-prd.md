# Resume Agent P0 MVP 需求文档

> 文档级别：P0 / MVP
> 依赖总览：[Resume Agent 总路线图](./resume-agent-roadmap.md)
> 更新日期：2026-08-22
> 核心关系：`1X → 1Y → X′`

## 0. P0 实施冻结决策（2026-08-22）

> 本节是 P0 的实现基线；若正文其他章节与本节冲突，以本节为准。`X / Y / X′` 仅为研发内部术语，任何用户可见文案均不得展示这些字母代号。

- 用户界面统一使用“基础简历”“目标岗位”“岗位专属版本”；关系说明为“基于当前简历生成独立岗位版本，不覆盖原简历”。
- 全局 Dock 可从全部已保存简历中选择一份基础简历，但每个任务仍只处理一份简历和一个岗位。岗位卡快捷入口延后至 P0.1。
- Dock 只在已登录业务页显示，只继承页面明确上下文，不猜测最近简历或岗位；非编辑器页面的选择在提交配置时才加载。所有入口进入 JD Tab 确认卡后才真正运行。
- JD Tab 默认保持“快速分析”；Agent 历史与快速分析历史按模式隔离。手工 JD 支持可选公司、岗位元数据。
- Agent 草稿不可手工编辑。审核阶段只允许接受、拒绝及撤销；基础简历和草稿预览切换时，草稿模式禁用普通保存和导出。
- 目标页数是软约束。预览展示实际页数及不匹配警告，但不阻止创建岗位专属版本。
- Agent 请求不上传完整简历。服务端按当前用户读取已保存简历和 Application，校验期望 hash；手工 JD 使用请求快照。
- `resume-agent` 使用 NDJSON 流式事件、`deepseek-v4-flash` 原生 Tool Calls、关闭思考模式。上下文读取属于服务端预检；工具注册表收敛为证据检索、锚点校验、Proposal 校验三个工具。
- 模型最多调用 3 次，计划/工具参数/Proposal 共享一次修订机会；工具最多执行 6 次。运行硬截止 120 秒，每 10 秒心跳，总 completion token 上限 20K。
- JD 最多 12,000 字符、简历可分析纯文本最多 40,000 字符、总模型输入最多 80,000 字符；超限拒绝，不静默截断。
- Patch 仅支持实习/项目/总结正文的精确替换，以及技能数组项的 add/remove/replace；使用稳定 item ID、字段路径、原文和数组 hash 定位，不增删完整经历，不修改基本信息、教育、公司、职位或日期。
- 无证据要求进入 `missingEvidence`。显式新增数字、日期、工具、技能、证书等事实判高风险并禁止应用；责任强度升级或跨条目证据至少为中风险，接受时需要用户逐条确认。
- 接受和拒绝均可撤销；批量接受低风险修改采用原子操作。零 Patch 为“完成但无可用修改”；合法 partial 可进入审核。
- `runId` 使用 UUID。`sessionStorage` 只保存用户绑定的 ID、hash 和审核键，不保存完整简历、JD、Proposal 或草稿。运行中刷新标记中断；审核中刷新从历史记录恢复；退出登录清空。
- `jd_analysis_records.analysis_result` 在前端使用可判别联合类型。Agent 记录带 `kind: 'resume-agent'`，由 Edge Function 在进入审核前写入；取消和中断不写历史。
- 创建版本使用 `source = agent-p0:{runId}` 做无迁移幂等恢复；创建失败保留审核，岗位关联失败保留已创建版本并只重试关联。创建成功后后台生成官方 PDF/缩略图，完成页导出直接使用新版本数据。
- 前后端 feature flag 默认关闭。远端部署、Secrets 和开关启用不属于代码实现步骤，必须另行执行。

## 1. 背景

现有产品已经具备完整的单次 JD Analysis Workflow：

```text
当前简历 X
  +
单个岗位/JD Y
  ↓
LLM 一次分析
  ↓
结构化建议
  ↓
右侧栏定位、应用和撤销
```

它已经有较好的产品和技术底座，但仍属于“模型返回一次结果，用户逐条操作”的工作流。P0 的目标不是重做现有系统，而是在保持旧链路可用的前提下，补上 Agent 必需的能力：

- 目标理解和任务约束。
- 结构化规划。
- 运行时工具选择。
- 工具结果观察。
- 有限修订。
- 任务内短期记忆。
- 可复用的历史上下文。
- 人工批准后的确定性写入。

---

## 2. P0 目标

### 2.1 用户目标

用户可以从全局 Agent 或现有 `JD分析` Tab 发起：

> 使用当前基础简历，针对一个目标岗位，生成一份不编造经历、可审核、可导出的岗位专属简历。

### 2.2 产品目标

完成以下端到端闭环：

```text
选择当前简历 X
→ 选择一个岗位 Y
→ 确认目标和约束
→ Agent 规划并调用只读/校验工具
→ 生成有证据的修改方案
→ 用户在右侧栏审核
→ 中间预览展示 Agent 草稿
→ 用户确认
→ 使用现有 API 创建新简历 X′
→ 使用现有 API 关联岗位
```

### 2.3 技术目标

- 新增单 Agent 编排能力，但不修改现有 `deepseek-chat` Workflow 行为。
- P0 不进行数据库迁移。
- P0 不修改 `ResumeData` schema。
- P0 不重写 Resume Store 的现有更新动作。
- P0 不移除现有快速 JD 分析。
- Agent 草稿与当前基础简历隔离。
- 所有数据库写入均由用户批准后的确定性代码执行。

### 2.4 MVP 成功定义

P0 成功不是“出现了 Agent UI”，而是：

1. 用户能完成一个真实 `1X → 1Y → X′` 任务。
2. Agent 至少根据运行时观察调用一次工具，而非只在 Prompt 中假装规划。
3. 所有可应用 Patch 都能定位到当前简历原文。
4. 用户能看到修改理由、证据和风险。
5. 新版本可以正常保存、编辑、预览和导出。
6. 基础简历误覆盖次数为 0。

---

## 3. P0 范围

### 3.1 In Scope

- 全局 Agent 悬浮身份卡与可展开 Dock 的最小入口。
- 只支持“为一个岗位生成定岗简历方案”。
- 左侧 `JD分析` Tab 的 Agent 模式适配。
- 保留当前快速分析模式和历史选择能力。
- 单 Agent Planner/Executor。
- 5 个以内的只读/校验工具。
- 任务内短期记忆。
- 复用现有简历、岗位和 JD 历史作为只读长期上下文。
- 右侧栏执行、审核、完成、失败状态。
- Agent 草稿 A4 预览。
- 用户接受、拒绝、撤销 Patch。
- 使用现有 `createResume` 创建岗位专属版本。
- 使用现有 `updateApplication` 关联岗位。
- 复用 `jd_analysis_records` 保存最终结果和失败记录。
- 基础日志、延迟、Token、工具事件和错误记录。

### 3.2 Out of Scope

- 完整经历库。
- 多份简历选一份。
- 一份简历匹配多个岗位。
- 多岗位批量任务。
- 自动投递。
- 求职信、面试问题和作品集。
- 投递结果学习。
- 后台长任务恢复和多设备同步。
- 多 Agent、handoff、角色团队。
- 让模型直接执行数据库写入。
- 自动删除或覆盖任何简历。
- 复杂语音、拖拽和主动提醒。

---

## 4. 当前能力与复用方案

| 当前能力 | P0 用法 | 改造原则 |
|---|---|---|
| 左侧 `简历编辑/JD分析` Tab | 保留结构，在 JD Tab 内增加 Agent 模式 | 不新建重复的 JD 输入页 |
| 岗位选择、JD 文本、历史分析 | 直接作为 Y 的选择与快照来源 | 保持旧 Workflow 逻辑 |
| `useJDAnalysisSessionStore` | 继续服务旧 Workflow | 新建 Agent Store，避免污染旧会话 |
| `JDAnalysisResult/SuggestionItem` | 作为 Agent Proposal 的兼容输出基础 | 只增加可选 Agent 元数据 |
| 原文定位、高亮、应用、撤销 | 复用定位和交互算法 | 抽取纯 Patch 辅助函数，避免重写 UI |
| `jd_analysis_records` JSONB | 保存 Agent 最终提案/失败快照 | 不新增表、不迁移列 |
| ResumeData / Resume Store | 基础简历 X 的权威数据 | schema 不变、Store 动作不变 |
| `createResume` | 创建岗位专属 X′ | 不引入版本表 |
| `updateApplication` | 把 Y 关联到 X′ | 不改变 Application schema |
| PDF/A4 预览 | 展示 Agent 草稿 | 仅增加可选数据覆盖，不改变官方导出链路 |
| `deepseek-chat` | 保留旧分析服务 | Agent 使用新业务端点，避免影响旧调用 |

### 4.1 必须新增但范围受控的模块

- `ResumeAgentDock`：紧凑悬浮身份卡、X/Y 选择、自然语言要求、进度和待审核任务胶囊。
- `resumeAgentSessionStore`：Agent 短期会话与草稿。
- `resume-agent` Edge Function：服务端编排和工具循环。
- `ResumeAgentProposal` 类型：计划、工具摘要、证据、风险和 Patch。
- `AgentRunPanel`：右侧执行状态。
- `AgentPatchReview`：右侧审核状态。
- `applyPatchesToResumeData`：纯函数，在副本上生成草稿。
- Preview 的可选 `dataOverride` 或等价草稿渲染入口。

---

## 5. 用户与场景

### 5.1 目标用户

- 已有一份结构基本完整的简历。
- 已保存一个岗位，或能够粘贴一个 JD。
- 希望针对岗位优化，但不愿接受编造内容。
- 需要明确知道为什么修改，以及修改后是否可直接导出。

### 5.2 前置条件

- 用户已登录。
- 当前简历已保存，存在 `resume_id`。
- 当前简历没有未保存修改；若有，先引导保存。
- 岗位有非空 JD，或用户在 JD Tab 中粘贴 JD。

### 5.3 核心用户故事

> 作为正在投递 AI 产品经理岗位的用户，我希望用当前基础简历针对一个已保存岗位生成定岗版本；系统只能使用真实简历内容，并在创建新版本前让我逐项审核修改。

---

## 6. 核心交互流程

### 6.1 入口 A：全局 Agent Dock

```text
用户点击全局“小鱼 Agent”悬浮身份卡
→ 身份卡在原位置展开为底部 Agent Dock
→ Dock 显示当前简历 X 和岗位 Y
→ 用户可点击 X/Y，向上展开下拉列表进行切换
→ 缺 X：简历选择器显示“选择简历”
→ 缺 Y：岗位选择器显示“选择岗位”，并提供“添加新 JD”
→ 用户可在输入框补充自然语言要求，也可直接使用默认任务
→ Dock 明确展示 1X → 1Y 和“生成独立草稿、不覆盖基础版”
→ 用户点击执行按钮或按 Enter 确认
→ 确认后导航到对应简历的 /?tab=jd
→ 左侧 JD Tab 自动填充岗位和目标
→ 创建 Agent 会话
```

### 6.2 入口 B：左侧 JD 分析 Tab

```text
用户打开当前简历
→ 切换“JD分析”
→ 选择已有岗位或粘贴 JD
→ 选择“Agent 定岗”模式
→ 填写目标页数/优化重点/保留要求
→ 点击“生成定岗方案”
→ 展示确认卡
→ 开始 Agent
```

### 6.3 入口 C：岗位卡快捷入口

P0 可选但推荐：在已有岗位卡增加“生成定制简历”。

```text
点击岗位卡 CTA
→ Y 已确定
→ 选择基础简历 X
→ 导航至 X 的 JD Tab
→ 自动填充 Y
→ 进入同一确认流程
```

若时间受限，入口 C 可在 P0.1 小版本补充，不影响 P0 核心闭环。

---

## 7. 前端需求

## 7.1 全局 Agent Dock

### 7.1.1 P0 形态

- 挂载在 App 主布局层，不属于具体页面。
- 默认空闲态为紧凑悬浮身份卡，不常驻占用大面积页面。
- 点击后从原位置横向展开为底部悬浮 Agent Dock。
- 展开态由“上下文选择行 + 自然语言输入行”组成。
- 运行态保持为同位置的进度 Dock。
- 生成完成后收起为待审核任务胶囊。
- 只支持一个活动任务。
- 不提供完整聊天历史。
- Dock 不是右侧结果面板的替代品。

### 7.1.2 紧凑身份卡

显示：

- Agent 标识：`小鱼 Agent`。
- 上下文摘要：`X + Y 已就绪`、`请选择岗位 Y` 或 `请选择简历 X`。
- 有运行结果时显示待审核数量。
- 点击身份卡展开 Dock；不直接进入通用聊天。

### 7.1.3 展开态 Agent Dock

第一行是结构化上下文：

```text
[简历 X：AI 产品经理 · 基础版 ▾] → [岗位 Y：字节跳动 · AI 产品经理 ▾]
```

第二行是操作输入：

```text
[＋] [突出 Agent 产品经验，弱化传统项目管理描述……] [生成定岗简历 ↑]
```

要求：

- 点击“简历 X”向上展开单选下拉框，列出当前简历和已保存简历。
- 点击“岗位 Y”向上展开单选下拉框，列出当前岗位、已保存岗位和“添加新 JD”入口。
- 下拉项至少显示名称、辅助信息和当前选中标记；支持键盘移动、Enter 选择和 Esc 关闭。
- 切换 X 后同步当前简历上下文；存在未保存编辑时复用现有离开确认机制，不得静默丢失内容。
- 切换 Y 后同步左侧 `JD分析` Tab 的选中岗位和 JD 内容。
- 用户在左侧切换 Y 时，Dock 的 Y 也必须同步更新。
- 自然语言输入是可选约束，不承担选择 X/Y 的职责。
- 执行前 X 和 Y 都必须存在；缺失项在对应选择器上给出明确提示。
- 点击执行按钮或输入框按 Enter 发起；Shift+Enter 仅在未来支持多行输入时保留。
- 展开态支持收起，收起不清空已选 X/Y 和未提交要求。

### 7.1.4 运行态与待审核任务胶囊

```text
✦ 正在生成“百度-AI产品经理”定岗方案 · 3/5
```

- 运行期间锁定本次任务使用的 X/Y；如需更换，应先取消并重新发起。
- 点击后进入当前简历 JD Tab 并打开右侧栏。
- 支持取消。
- SPA 路由切换期间保持状态。
- 浏览器刷新时，若任务仍为运行中，将状态恢复为“已中断，可安全重试”；P0 不承诺服务端后台续跑。

完成后同一位置显示：

```text
✓ 6 项建议待审核
```

点击后打开对应 X/Y 的编辑器和右侧 Agent 审核工作台。

### 7.1.5 上下文规则

- 不得静默选择错误的简历或岗位。
- 提交前必须显示 X、Y 和主要约束。
- 用户可以修改或移除上下文。
- P0 不根据模糊指令自动执行写操作。
- X/Y 的展示名称来自现有数据；Dock 不复制或创建新的业务对象。
- 当前页面上下文、Dock 选择和左侧 JD Tab 必须使用同一个会话状态源，避免三处状态不一致。

### 7.1.6 P0 验收标准

- 用户最多两次点击即可从紧凑身份卡打开任一 X/Y 下拉列表。
- 用户能分别切换 X 和 Y，并在 Dock、顶部当前简历和左侧岗位卡看到一致结果。
- 下拉菜单在 Dock 上方向展开，不遮挡输入和执行按钮。
- 未选择 X 或 Y 时不能启动任务，并能明确定位缺失项。
- 输入自定义要求后可通过按钮或 Enter 发起同一任务。
- 发起后 Dock 连续呈现执行进度，完成后呈现待审核数量。
- 点击待审核胶囊后进入右侧工作台，结果不堆叠在浮层中。
- 收起、切换页面再返回时，未提交的 X/Y 选择在当前 SPA 会话内保留。

---

## 7.2 左侧 1/3：`JD分析` Tab 适配

### 7.2.1 保留现状

- Tab 名称仍为 `JD分析`。
- 保留已有岗位选择。
- 保留 JD 文本框。
- 保留历史记录和旧版提示。
- 保留当前 `开始分析/重新分析/查看详情/清空` Workflow。

### 7.2.2 增加模式

在 JD Tab 内增加轻量模式选择：

```text
[快速分析] [Agent 定岗]
```

- `快速分析`：调用现有逻辑，现有结果和交互不变。
- `Agent 定岗`：显示任务配置并调用新 Agent 端点。
- 通过 feature flag 控制 Agent 模式是否开放。

### 7.2.3 Agent 定岗配置

必填：

- 当前简历：自动使用当前 X，只读显示。
- 目标岗位/JD：复用当前选择和文本框。

选填：

- 目标页数：`保持当前 / 1页 / 2页`。
- 优化重点：自由文本，最多 200 字。
- 必须保留：自由文本，最多 200 字。

固定约束：

- 不编造事实。
- 不覆盖基础简历。
- 修改需审核后写入。

主按钮：`生成定岗方案`。

### 7.2.4 任务确认卡

开始前展示：

- X 的名称和保存状态。
- Y 的公司、岗位和 JD 来源。
- 用户约束。
- “只生成方案，不直接修改基础简历”的说明。

操作：`返回修改`、`确认开始`。

---

## 7.3 中间预览区：基础简历与 Agent 草稿

### 7.3.1 草稿隔离

P0 新增 `agentDraftResumeData`，它是当前 `resumeData` 的深拷贝：

- 接受 Patch 只修改草稿。
- 拒绝 Patch 不修改草稿。
- 当前 Resume Store 仍保存基础简历 X。
- 用户未创建 X′ 前，工具栏普通保存不得写入 Agent 草稿。

这是 P0 唯一不能以“少改代码”为理由省略的安全要求。

### 7.3.2 预览模式

右侧开始审核后，中间顶部增加：

```text
[基础版] [Agent草稿]
```

- 默认进入 `Agent草稿`。
- 基础版读取现有 Store。
- Agent 草稿读取 `dataOverride`。
- P0 不要求完整双栏 Diff 预览；Diff 仍在右侧卡片展示。

### 7.3.3 联动

- 悬停 Patch：临时高亮原文位置。
- 点击 Patch：滚动并锁定目标。
- 接受 Patch：草稿预览更新并绿色闪烁。
- 撤销 Patch：草稿恢复并显示恢复反馈。
- 锚点失效：禁止应用并提示重新运行或人工处理。

---

## 7.4 右侧边栏：Agent 任务工作台

右侧栏消费左侧 JD Tab/全局 Dock 创建的任务，不独立选择 JD。

### 7.4.1 头部

固定显示：

- 任务标题：`公司-岗位定岗简历`。
- 状态：`执行中/待审核/已完成/失败/已取消`。
- 当前简历名称。
- 收起按钮。

### 7.4.2 执行状态

阶段固定展示为用户语言：

1. 理解岗位要求。
2. 读取简历和证据。
3. 制定修改计划。
4. 生成候选修改。
5. 校验证据与格式。

每个阶段展示状态和简短观察，例如：

```text
✓ 找到 8 条可用证据
● 正在校验 5 项修改
○ 等待版面预览
```

不展示 Chain of Thought、完整 Prompt 或模型原始推理。

### 7.4.3 审核状态

顶部摘要：

- 岗位核心要求数量。
- 有证据覆盖数量。
- 无证据要求数量。
- 候选 Patch 数量。
- 预计页数（若 P0 无自动页数工具，则显示“待预览确认”）。

Patch 按现有四个模块分组：实习、项目、总结、技能。

### 7.4.4 Patch 卡片

必显字段：

- 模块和条目标题。
- 优先级。
- 修改前。
- 修改后。
- JD 目标。
- 修改理由。
- 证据来源摘要。
- 风险等级。
- 状态。

操作：

- `定位原文`
- `接受`
- `拒绝`
- 已接受后 `撤销`

风险规则：

- 低风险：可以接受和批量接受。
- 中风险：只能单条接受。
- 高风险：P0 不允许应用，只能拒绝或忽略。

### 7.4.5 底部固定操作区

- `接受全部低风险修改`
- `创建岗位版本（已接受 N 项）`
- 无任何接受项时主按钮禁用。
- 创建过程中禁用重复点击。

### 7.4.6 完成状态

展示：

- 新版本名称。
- 应用/拒绝/忽略数量。
- 新简历 ID。
- 是否已关联岗位。
- `打开新版本`
- `导出 PDF`
- `返回基础简历`

### 7.4.7 失败状态

展示：

- 失败阶段。
- 已完成阶段。
- 是否产生写入：P0 在审核前恒为“否”。
- `安全重试`
- `返回任务配置`
- `使用快速分析`

---

## 8. Agent 设计

## 8.1 架构原则

- 单 Agent，不做角色拆分。
- 服务端编排，前端不保存模型密钥。
- Agent 只拥有只读和校验工具。
- Agent 不拥有任意 SQL、创建简历、更新岗位或删除工具。
- 最终写入由前端/业务 API 在用户批准后执行。
- 规划和工具事件必须结构化，前端只展示用户可理解摘要。

## 8.2 服务端端点

新增业务端点：

```text
POST /resume-agent
```

推荐使用独立 Supabase Edge Function `resume-agent`：

- 复用现有用户认证和有效 Key 检查方式。
- 复用现有 DeepSeek API Key。
- 不修改 `deepseek-chat` 的请求/响应协议。
- 对输入长度、工具次数、模型轮次、Token 和超时设置上限。

若当前模型原生工具调用不可用，使用服务端受控的 `next_action` JSON 协议作为兼容实现；对外产品语义保持一致。

## 8.3 输入协议

```ts
interface ResumeAgentRequest {
  resumeId: string
  applicationId?: string | null
  resumeData: ResumeData
  resumeText: string
  jdText: string
  company?: string
  position?: string
  goal: string
  constraints: {
    targetPages: 'keep' | 1 | 2
    mustKeep?: string
    noFabrication: true
    createNewVersion: true
  }
  resumeHash: string
  jdHash: string
}
```

服务端仍需校验用户身份、输入长度和字段类型；不得信任前端声明的用户 ID。

## 8.4 计划结构

Agent 首次模型调用必须输出结构化计划：

```ts
interface ResumeAgentPlan {
  goalSummary: string
  constraints: string[]
  targetRequirements: Array<{
    id: string
    requirement: string
    priority: 'high' | 'medium' | 'low'
  }>
  steps: Array<{
    id: string
    label: string
    expectedObservation: string
  }>
  nextAction: AgentToolCall | 'finish'
}
```

计划不是一次写死的展示文本。每次工具返回 Observation 后，Agent 可以：

- 调用另一个允许的工具。
- 修订剩余步骤。
- 结束并生成 Proposal。

P0 最多允许一次 Proposal 修订。

## 8.5 P0 工具

### Tool 1：`get_resume_context`

用途：读取当前 X 的结构化模块和可定位文本。

输入：`resumeId`。

输出：

- 标题和目标岗位。
- 实习、项目、总结、技能模块。
- 可定位条目摘要。
- resume hash。

实现：从请求上下文或鉴权后的现有 Resume 记录读取；P0 不跨简历读取。

### Tool 2：`get_job_context`

用途：读取单个 Y 的公司、职位和 JD。

输入：`applicationId` 或当前 JD snapshot。

输出：公司、职位、JD、jd hash、来源类型。

实现：优先读取已保存 Application；手工 JD 使用请求快照。

### Tool 3：`search_resume_evidence`

用途：根据一个或一组岗位要求，在当前 X 中检索可承接证据。

输入：

- requirement IDs。
- section 范围。
- 最大结果数。

输出：

- section。
- item title。
- original content。
- problem/target text。
- relevance summary。
- evidence strength。

实现：P0 可采用结构化字段遍历、关键词/语义模型联合匹配；返回结果必须能映射到现有 Suggestion 锚点字段。

### Tool 4：`validate_patch_anchor`

用途：判断候选 Patch 是否可在当前 X 中安全定位和应用。

输入：section、itemTitle、originalContent、originalText、revisedText。

输出：

- anchor found。
- exact match count。
- target key。
- conflict reason。

实现：复用或抽取现有建议定位算法；不得用模型猜测锚点。

### Tool 5：`validate_resume_proposal`

用途：对最终 Proposal 做确定性校验。

输入：全部 requirements、evidence 和 patches。

输出：

- 每个 Patch 是否有 Evidence。
- 是否存在失效锚点。
- 是否重复修改同一位置。
- 是否存在不允许的高风险 Patch。
- schema 是否完整。
- 是否满足数量和停止条件。

P0 不将自动 PDF 页数修订放入 Agent 工具；页面目标作为建议约束和人工预览结果。自动版面迭代属于 P1。

## 8.6 Agent 循环

```text
1. Observe：读取 goal、X、Y、约束
2. Plan：生成 requirements、步骤和 nextAction
3. Act：调用 get_resume_context/get_job_context
4. Observe：获得结构化上下文
5. Act：调用 search_resume_evidence
6. Observe：获得证据结果
7. Generate：生成 ResumeAgentProposal
8. Validate：调用 anchor/proposal 校验工具
9. 若失败：向 Agent 返回校验问题，允许修订一次
10. 若通过：输出 Final Proposal
11. Stop：等待用户审核，不执行写工具
```

实际工具顺序可以由 Agent调整，但必须在白名单和上限内。

## 8.7 停止条件

满足任一条件即停止：

### 正常完成

- 已识别岗位核心要求。
- 每个可应用 Patch 都绑定证据。
- 每个 Patch 锚点有效。
- Proposal schema 校验通过。
- 不存在可自动应用的高风险内容。
- Patch 数量在 1—7 条之间。

### 受限停止

- 最多 6 次工具调用。
- 最多 3 次模型调用。
- 最多 1 次 Proposal 修订。
- 总耗时达到服务端上限。
- Token 达到任务预算。
- 请求取消。

受限停止必须返回明确状态：`partial`、`failed` 或 `cancelled`，不得伪装成功。

---

## 9. 记忆设计

## 9.1 短期记忆（P0 必须）

短期记忆只服务当前 Agent 任务：

```ts
interface ResumeAgentSessionState {
  runId: number
  status: 'idle' | 'confirming' | 'running' | 'review' | 'creating' | 'completed' | 'failed' | 'cancelled' | 'interrupted'
  stage: string | null
  resumeId: string | null
  applicationId: string | null
  goal: string
  constraints: Record<string, unknown>
  plan: ResumeAgentPlan | null
  toolEvents: AgentToolEvent[]
  proposal: ResumeAgentProposal | null
  acceptedPatchKeys: string[]
  rejectedPatchKeys: string[]
  agentDraftResumeData: ResumeData | null
  createdResumeId: string | null
  error: string | null
}
```

实现要求：

- 新建独立 Zustand Store。
- SPA 路由切换时保留。
- 可使用 `sessionStorage` 保存非敏感序列化状态。
- 不把原始模型推理写入浏览器。
- 切换 X 或 Y 时必须提示当前任务将失效。

## 9.2 长期记忆（P0 复用，不新建）

P0 的“长期记忆”不是个性化学习，只是复用现有持久化事实：

- Resumes：用户已保存的简历事实。
- Applications：岗位、JD 和关联简历。
- JD Analysis History：历史快照、hash、模型、Prompt 版本和结果。

复用策略：

- 相同 `resume_hash + jd_hash + agent prompt version` 可提示存在历史结果。
- P0 默认让用户选择“载入历史”或“重新运行”。
- 不自动把历史建议当作用户偏好。
- 不跨用户共享任何记忆。

## 9.3 P0 不做的长期记忆

- 用户写作偏好学习。
- 用户拒绝原因学习。
- 投递结果归因。
- 经历事实确认库。
- 向量库或跨简历检索。

这些在 P1/P2 建设。

---

## 10. 输出协议

```ts
interface ResumeAgentProposal {
  schemaVersion: 1
  goalSummary: string
  targetRequirements: Array<{
    id: string
    requirement: string
    priority: 'high' | 'medium' | 'low'
    coverage: 'covered' | 'partial' | 'missing'
    evidenceKeys: string[]
  }>
  evidence: Array<{
    key: string
    section: JDAnalysisSectionId
    itemTitle: string
    originalContent: string
    targetText?: string
    strength: 'strong' | 'medium' | 'weak'
    explanation: string
  }>
  sectionAnalyses: JDSectionAnalysis[]
  patches: Array<{
    key: string
    section: JDAnalysisSectionId
    itemTitle: string
    originalContent: string
    originalText: string
    revisedText: string
    requirementIds: string[]
    evidenceKeys: string[]
    reason: string
    risk: 'low' | 'medium' | 'high'
    anchorStatus: 'valid' | 'invalid'
  }>
  missingEvidence: Array<{
    requirementId: string
    message: string
  }>
  validation: {
    passed: boolean
    warnings: string[]
  }
  runSummary: {
    toolCallCount: number
    revisionCount: number
    durationMs: number
    completionTokens?: number | null
  }
}
```

兼容要求：

- `sectionAnalyses` 能继续供现有右侧建议组件使用。
- 可将 patches 映射为现有 `SuggestionItem.rewriteDraft`。
- 新字段采用可选扩展，不要求修改 ResumeData。

---

## 11. 新版本创建

### 11.1 草稿生成

```text
base ResumeData
→ deep clone
→ 在副本上应用 accepted patches
→ normalizeResumeData
→ 设置新 resumeTitle
→ createResume
```

禁止直接调用当前 Resume Store 的保存动作覆盖 X。

### 11.2 命名规则

默认：

```text
{公司}-{岗位}-v1
```

重名时递增版本号或追加时间，不覆盖现有简历。

### 11.3 岗位关联

若 Y 来源于 Application：

```text
createResume 成功
→ updateApplication(applicationId, { resume_id: newResumeId })
```

若岗位关联失败：

- 新简历保留。
- 显示“版本已创建，岗位关联失败”。
- 提供重试关联。
- 不删除新简历。

### 11.4 P0 限制

由于不新增版本表，P0 不提供严格的父子版本关系和版本树。基础版与岗位版的关系通过：

- 新版本命名。
- 当前 Agent 历史快照。
- Application 的 `resume_id`。

进行弱关联。正式版本谱系在 P1 建设。

---

## 12. 历史记录复用

Agent 结果继续写入 `jd_analysis_records`：

- `resume_id`：发起任务时的基础简历 ID。
- `application_id`：目标岗位 ID，可空。
- `status`：沿用 `running/success/failed`。
- `analysis_result`：保存兼容的 `JDAnalysisResult` 和可选 Agent 扩展。
- `model`：实际模型。
- `prompt_version`：使用 `agent-p0-*` 前缀区分旧 Workflow。
- snapshot/hash：沿用现有逻辑。

注意：当前 API 只有 create，没有 update。P0 可采用以下任一最小方案：

1. 任务结束时一次性 create success/failed 记录；运行中仅保存在 Session Store。
2. 若必须展示跨刷新 running 状态，再为现有表新增 update API，但不迁移数据库。

推荐 P0 采用方案 1，避免扩大改造范围。

---

## 13. 状态机

```text
idle
  → configuring
  → confirming
  → running
      → review
          → creating
              → completed

running → failed / cancelled / interrupted
review  → cancelled
creating → completed / failed(partial)
```

状态约束：

- `running` 时不可再次开始同一任务。
- `review` 时不可修改 X/Y 上下文。
- `creating` 时按钮防重复。
- `completed` 后只能打开新版本或开始新任务。
- `failed(partial)` 必须说明简历是否已创建、岗位是否已关联。

---

## 14. 错误、边界和安全

### 14.1 输入错误

- 未登录：引导登录。
- 简历未保存：先保存。
- 简历有未保存编辑：先保存或取消任务。
- JD 为空：禁止开始。
- JD 过长：提示精简非职责信息。

### 14.2 Agent 错误

- 非法工具：拒绝并终止。
- 工具参数不合法：返回校验错误，允许一次修订。
- Proposal 非法：返回 validator，允许一次修订。
- 超时/额度：保留已完成阶段并安全重试。
- 取消：AbortController 终止前端和服务端请求。

### 14.3 Patch 错误

- 原文找不到：禁止接受。
- 原文多处重复：要求人工定位或重新生成。
- 原文在任务后发生变化：标记结果过期。
- 高风险 Patch：禁止自动应用。

### 14.4 安全边界

- JD 是不可信内容，不能改变系统工具权限。
- 模型不能构造任意数据库查询。
- 工具输入经过 schema 校验。
- 服务端根据用户身份读取数据。
- 不把 API Key、Auth Token、系统 Prompt 返回前端。
- 不记录或展示 Chain of Thought。

---

## 15. 埋点与指标

### 15.1 事件

- `agent_dock_opened`
- `agent_task_configured`
- `agent_task_confirmed`
- `agent_run_started`
- `agent_stage_completed`
- `agent_run_succeeded`
- `agent_run_failed`
- `agent_run_cancelled`
- `agent_patch_located`
- `agent_patch_accepted`
- `agent_patch_rejected`
- `agent_patch_undone`
- `agent_version_create_started`
- `agent_version_created`
- `agent_application_link_succeeded`
- `agent_application_link_failed`

### 15.2 P0 观察指标

- 任务确认率。
- Agent 任务成功率。
- 从开始到进入审核的耗时。
- 每次任务工具调用数和模型调用数。
- Patch 锚点有效率。
- Patch 接受/拒绝率。
- 从审核到创建版本的完成率。
- 新版本导出率。
- 基础简历误覆盖率。

### 15.3 内测建议门槛

- 基础简历误覆盖率：0。
- 已应用 Patch 锚点有效率：100%。
- 未经批准的数据写入：0。
- 20—50 个固定案例均能给出明确成功或失败状态。
- 失败任务可以取消或安全重试。

模型效果指标在建立基线后确定，不在首次 PRD 中虚构数值目标。

---

## 16. 验收用例

### Case 1：正常任务

- 已保存 X。
- 已保存含 JD 的 Y。
- Agent 成功返回 4—7 条候选 Patch。
- 用户接受 3 条、拒绝 2 条。
- 创建 X′ 并关联 Y。
- X 内容不变。

### Case 2：手工 JD

- X 已保存。
- 用户粘贴 JD，无 Application。
- Agent 正常运行。
- 创建 X′，不尝试关联岗位。

### Case 3：无证据要求

- JD 要求简历中不存在的工具/成果。
- Agent 将其放入 missingEvidence。
- 不生成可自动接受的肯定性表述。

### Case 4：原文变化

- Agent 运行后 X 被编辑。
- resume hash 不一致。
- 结果标记过期，Patch 禁止应用。

### Case 5：任务取消

- 运行中取消。
- 请求终止。
- 不创建简历、不关联岗位。
- 可以重新开始。

### Case 6：创建成功、关联失败

- X′ 创建成功。
- updateApplication 失败。
- 明确提示部分成功并允许重新关联。
- 不删除 X′。

### Case 7：旧 Workflow 回归

- 选择快速分析。
- 原有开始分析、历史、右侧建议、定位、应用和撤销行为不变。

---

## 17. 实施顺序

### Slice 0：契约与 Mock UI

- 定义 Request、Plan、ToolEvent、Proposal、Patch 和 State 类型。
- 用 Mock 数据完成全局 Dock、左侧配置、右侧执行/审核/完成状态。
- 验证三栏联动和草稿隔离方案。

### Slice 1：Agent 编排最小闭环

- 新增 `resume-agent` Edge Function。
- 接入现有 DeepSeek。
- 实现计划、工具 registry 和受限循环。
- 返回 Proposal，不执行写入。

### Slice 2：审核和草稿

- 新建 Agent Session Store。
- 复用定位算法。
- 在草稿副本上应用/撤销 Patch。
- 中间预览支持基础版/Agent 草稿。

### Slice 3：创建版本

- 复用 `createResume`。
- 复用 `updateApplication`。
- 完成部分失败处理。
- 写入 JD 分析历史。

### Slice 4：回归与灰度

- 跑 lint/build/encoding。
- 回归旧 Workflow。
- 固定案例 Eval。
- feature flag 小范围开放。

---

## 18. 发布与回滚

- Agent 模式使用独立 feature flag。
- 关闭 flag 后，旧 JD Analysis Workflow 完整可用。
- 新增 Edge Function 失败不影响 `deepseek-chat`。
- P0 无数据库迁移，因此回滚不涉及 schema 恢复。
- Agent 新版本已创建后按普通 Resume 处理，不依赖 Agent 功能继续存在。

---

## 19. P0 决策摘要

| 决策 | 选择 | 原因 |
|---|---|---|
| 是否新建 Agent 页面 | 否 | 复用现有三栏工作台 |
| 是否保留 JD 分析 | 是 | 旧 Workflow 是回退路径和基线 |
| Agent 在哪配置 | 左侧 JD Tab + 全局 Dock | 与当前 X/Y 上下文一致 |
| Agent 结果在哪审核 | 右侧栏 | 可与 A4 预览和原文定位联动 |
| 是否修改 ResumeData | 否 | 降低风险 |
| 是否迁移数据库 | 否 | 复用现有表和 JSONB |
| 是否新建 Agent Store | 是 | 避免污染旧 JD 会话 |
| 是否让 Agent 写数据库 | 否 | 用户批准后确定性写入 |
| 是否自动版面迭代 | 否 | P1；P0 先保证内容和证据闭环 |
| 是否支持多 Agent | 否 | 单 Agent 足够验证价值 |

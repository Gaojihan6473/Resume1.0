# UI 约定

- 在 [src/index.css](../src/index.css) 的 Tailwind `@theme` 中维护跨功能共用的值。品牌主操作使用 `--color-brand-action`，相同的悬停态、圆角和阴影沿用 `brand-action` 系列变量。工作区文字和键盘焦点颜色使用 `--color-workspace-text` 与 `--color-workspace-focus`。布局尺寸和图表数据色可随功能定义。
- 工作区桌面断点由 `--breakpoint-workspace` 定义，单位为 CSS 像素。独立样式表通过 `@reference` 引入全局样式，再用 `@variant workspace` 和 `@variant max-workspace` 应用。看板从同一变量读取编辑模式的最小宽度。改动断点时检查边界两侧的布局和交互。
- 新增筛选或日期输入时优先复用 [CustomSelect](../src/components/Application/CustomSelect.tsx) 和 [CalendarInput](../src/components/Application/CalendarInput.tsx)。批次范围复用 [BatchScopeSelector](../src/components/Batch/BatchControls.tsx)，工作区顶栏复用 [WorkspaceTopbar](../src/components/Layout/WorkspaceTopbar.tsx) 与浮岛侧边栏 [Sidebar](../src/components/Sidebar/Sidebar.tsx)，工作区标题复用 [WorkspaceHeader](../src/components/Batch/WorkspaceHeader.tsx) 中的现有实现。
- 弹窗和抽屉需有可访问名称，打开时聚焦有效操作，Tab 留在模态区域内，关闭后焦点回到触发控件。有嵌套菜单时，Esc 先收起最上层。 [登录提示](../src/components/AuthRequiredModal.tsx) 和 [批次弹层](../src/components/Batch/BatchControls.tsx) 提供现有实现。
- 保持中文操作文案，检查看板与岗位页的窄屏、键盘焦点和减少动态效果。浏览器验证见 [日常开发与验收](./development-workflow.md)。简历 A4 排版从独立渲染入口维护。

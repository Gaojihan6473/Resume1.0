# 界面与交互约定

[返回项目说明](../README.md)。本文记录当前行为与维护约定；后续变更更新对应条目。

- Upload and parse resume files
- Source-backed AI import with page images for PDFs, native DOCX/TXT content, completeness checks, and rule-based fallback
- Edit student work, awards, and other supplementary content as multiline entries in 技能与其他
- Visual editor + live A4 preview from the same HTML used for PDF export
- Save/load resumes with Supabase
- Global new/import actions ask for a recruitment batch when needed, then open the editor or upload dialog once; the destination remains interactive after the handoff.
- Saving preserves edits made while the request is in flight; responses from another document cannot replace the current editor. Closing an import or switching documents cancels the previous parse.
- “保存并切换”在新草稿保存并补全编辑器 URL 后仍会前往原目标页面；后台缩略图只发布到对应 PDF 版本，版本已变化时跳过本次更新。
- Track applications in a customizable dashboard with nine repeatable modules, global filters, draggable/resizable layouts, and account-scoped cloud saves
- The jobs page uses two soft white panels: 我的简历 initially shows only a searchable thumbnail list; selecting a resume reveals its preview and separate edit button below the list. Selecting it again or using 取消选择 hides the preview and returns the space to the list. 我的岗位 keeps compact cards, job/company search, filters, card/list switching and creation inside its panel. Switching views preserves the search, filters and selected resume. Selection gently highlights linked jobs without hiding other jobs. Narrow screens stack the panels and job cards. JD analysis remains inside the resume editor.
- The jobs page panels use fine borders without outer shadows. When a resume is selected, its preview and guidance share a near-white gradient across the bottom of 我的简历, with a soft shadow along the top edge.
- On wide desktop screens, the jobs workspace expands with the viewport instead of stopping at 1480px. Outer spacing is a compact 28–48px; space recovered by narrowing both margins goes entirely to the left resume panel, preserving the jobs panel's width at the same viewport. Tablet and phone layouts stay the same.
- 我的简历 shows the number of resumes in the current batch scope. Both lists keep native scrolling and a stable scrollbar gutter; scrollbar thumbs appear while scrolling and fade after one second of inactivity, without shifting the content.
- Clicking the selected resume's preview opens an enlarged, centered image overlay. Close it with the top-right button, by clicking outside the image, or with Escape; the current resume selection is preserved and keyboard focus returns to the preview.
- Job cards use a compact “公司 - 岗位” title, with a semibold company name and a readable muted-blue role; the second line shows the location with a pin icon, resume/channel association and application date. Full titles remain available on hover when truncated.
- The jobs panel's list view uses borderless rows with faint inset separators and a square-cornered soft blue hover background extending 10px beyond each separator endpoint and meeting the separators above and below; keyboard focus remains visible.
- The “新建岗位” menu matches its trigger's 12px text, 15px icons and compact spacing for “图文解析” and “手动填写”.
- 岗位表单中，点击「关联简历」旁的问号可查看提示：岗位与简历需属于同一批次才能建立关联。
- The signed-in homepage shows recruitment batch cards and two side-by-side white panels of recently edited resumes and jobs, with the latest three items in each list. Visible category headings and subtle dividers organize compact rows; only the jobs heading offers a borderless text-and-arrow link to view all jobs. Narrow screens stack the panels. Each batch opens an independent workspace with the existing resume/job cards and responsive pagination.
- Recent rows provide a square-cornered soft blue hover/keyboard-focus background and a right arrow, without edit/view action text. Job status badges align to the right beside the arrow. Batch links have independent hover feedback; clicking the rest of a row opens its resume or job. Motion follows the system's reduced-motion preference.
- “我的” is a cross-batch library with 简历 / 岗位 / 批次 tabs, keyword and batch filters, job status filtering, and 5-item “加载更多” browsing. Returning from a detail/editor page restores filters, loaded rows and scroll position during the signed-in session; signing out clears that position history. Resume actions remain visible, creation follows the selected batch (or asks for one), and copies retain their original batch without job links.
- Library search keeps typing responsive and waits for Chinese IME composition to finish before updating filters and the URL. Typing or clearing a keyword preserves the current scroll position and other selected filters.
- The account section sits above the library. Compact rows use clear title/secondary-text hierarchy using the homepage background, white cards and shared blue accents; batch descriptions and job timestamps remain in detail views or tooltips. Library rows show batch ownership and resume/job associations. Clicking a resume's linked-job count opens its batch on the jobs page and selects that resume for the existing highlight behavior; all jobs in that batch remain visible. Deleting a resume preserves jobs and removes their resume link. Library refresh is independent of saving: only an unsaved draft shows the shared “保存当前草稿” action, and partial loading failures preserve cached data with explicit retry messages.
- JD analysis runs inside the resume editor with a viewport-height input panel; the editor column stays fixed while long JD content scrolls inside the text area
- Resume Agent uses a global launcher that expands upward to select a base resume and target job, then creates an independently reviewable job-specific version without overwriting the base resume. It is available to authenticated users by default.
- The launcher task list uses compact single-line rows with color-coded status badges and scrolls when more tasks are present.
- Hover the top-left brand area to open the side navigation; it closes after the pointer leaves the trigger and sidebar.
- Dropdowns share one visual style across job forms, batch controls, the editor toolbar, font sizes, and JD history, with keyboard selection and menus that stay above scroll containers.
- Imported resumes default to left-aligned basic information, regardless of the name's position in the source file.
- 批次删除确认按钮在请求准备、删除和列表刷新期间显示“删除中”并保持禁用；失败后恢复“确认删除”，可重试。
- Imported dates default to the right. Education details include college, major, degree and GPA in preview, PDF and DOCX. Personal tags and school locations without a direct output slot are retained in “其他补充” with a review warning; unmatched source content continues to be retained for review.
- PDF, DOCX, TXT and scanned imports use a fixed 9px body size (10px section headings and 15.3px name), including rule/legacy fallbacks. Body sizes remain manually editable after import; saved resumes keep their existing sizes.
- Export vector PDF / DOCX
- Education school tags use a compact row with 985/211 shortcuts and custom labels such as “QS 前 50”. Click + to open the inline input, confirm with Enter or ✓, click a custom tag to rename it, and remove it with ×. The input collapses after saving or cancelling; custom tags persist in saved resumes, previews, PDF and DOCX exports.

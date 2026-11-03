export function AgentHistoryDeleteOption({ checked, onChange, disabled = false }: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return <div className="mt-3 text-xs leading-6 text-slate-500">
    <p>默认保留 Agent 分析历史，其中的简历与职位描述内容快照仍会保留。已生成的简历版本不受影响。</p>
    <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="mt-1.5 shrink-0 accent-rose-500" />
      同时删除相关 Agent 分析历史
    </label>
    {checked && <p className="mt-1 text-rose-600">相关 Agent 分析历史及其中的快照将永久删除，无法恢复。普通 JD 分析历史会保留。</p>}
  </div>
}

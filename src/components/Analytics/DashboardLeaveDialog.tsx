import { useEffect, useRef } from 'react'
import { useDashboardStore } from '../../store/dashboardStore'

export function DashboardLeaveDialog({ open, onStay, onDiscard }: { open: boolean; onStay: () => void; onDiscard: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const saving = useDashboardStore(s => s.saving)
  useEffect(() => {
    if (open) ref.current?.showModal()
    else if (ref.current?.open) ref.current.close()
  }, [open])
  return <dialog ref={ref} className="board-leave-dialog" aria-label="离开看板" onCancel={e => { e.preventDefault(); onStay() }}>
    <h2>是否放弃看板修改并离开？</h2>
    <p>{saving ? '正在保存，请等待保存结果后再离开。' : '未保存的模块和布局调整将被丢弃。'}</p>
    <div className="board-actions"><button className="board-button" autoFocus onClick={onStay}>继续编辑</button><button className="board-button primary" disabled={saving} onClick={onDiscard}>放弃并离开</button></div>
  </dialog>
}

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Download,
  ExternalLink,
  Loader2,
  MapPin,
  RotateCcw,
  XCircle,
} from 'lucide-react'
import { createResume, fetchResumes } from '../../lib/api'
import { useApplicationStore } from '../../store/applicationStore'
import { useResumeAgentSessionStore } from '../../store/resumeAgentSessionStore'
import { useResumeStore } from '../../store/resumeStore'
import type { ResumeAgentPatch, ResumeAgentStage } from '../../types/resumeAgent'
import type { ResumeData } from '../../types/resume'
import { normalizeResumeData, resumeDataToRecord } from '../../utils/resumeData'
import { createResumeAgentSource, findResumeCreatedForRun, resolveResumeAgentVersionTitle } from '../../utils/resumeAgentDelivery'
import { countPendingResumeAgentPatches, getVisibleResumeAgentPatches } from '../../utils/resumeAgentReview'
import { scheduleResumePdfRefresh } from '../../utils/saveResume'
import { toast } from '../Toast'

interface ResumeAgentTaskPanelProps {
  baseData: ResumeData
  isStale: boolean
  onLocatePatch: (patch: ResumeAgentPatch) => void
}

const STAGES: Array<{ id: ResumeAgentStage; label: string }> = [
  { id: 'understand_job', label: '理解目标岗位' },
  { id: 'read_evidence', label: '检索简历证据' },
  { id: 'plan_changes', label: '规划修改范围' },
  { id: 'generate_patches', label: '生成修改建议' },
  { id: 'validate_proposal', label: '校验事实与风险' },
]

const RISK_LABEL = { low: '低风险', medium: '需核实', high: '高风险' } as const
const RISK_CLASS = {
  low: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  medium: 'bg-amber-50 text-amber-700 ring-amber-100',
  high: 'bg-red-50 text-red-700 ring-red-100',
} as const
export function ResumeAgentTaskPanel({
  baseData,
  isStale,
  onLocatePatch,
}: ResumeAgentTaskPanelProps) {
  const navigate = useNavigate()
  const agent = useResumeAgentSessionStore()
  const updateApplication = useApplicationStore((state) => state.updateApplication)
  const [riskConfirmationKey, setRiskConfirmationKey] = useState<string | null>(null)
  const [pendingCreationConfirmation, setPendingCreationConfirmation] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!agent.proposal) return
    const proposal = agent.proposal as unknown as Record<string, unknown>
    const rawPatches = proposal.patches
    const rawMissingEvidence = proposal.missingEvidence
    const arrayFieldCounts = Object.fromEntries(
      Object.entries(proposal)
        .filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]))
        .map(([key, value]) => [key, value.length]),
    )
    console.info(`[ResumeAgent] proposal_rendered ${JSON.stringify({
      completionStatus: agent.completionStatus,
      proposalKeys: Object.keys(proposal).sort(),
      arrayFieldCounts,
      patchesFieldType: Array.isArray(rawPatches) ? 'array' : rawPatches === undefined ? 'missing' : typeof rawPatches,
      patchCount: Array.isArray(rawPatches) ? rawPatches.length : 0,
      missingEvidenceFieldType: Array.isArray(rawMissingEvidence) ? 'array' : rawMissingEvidence === undefined ? 'missing' : typeof rawMissingEvidence,
      missingEvidenceCount: Array.isArray(rawMissingEvidence) ? rawMissingEvidence.length : 0,
    })}`)
  }, [agent.completionStatus, agent.proposal])

  const patches = useMemo(() => {
    return getVisibleResumeAgentPatches(agent.proposal?.patches || [])
  }, [agent.proposal])
  const accepted = useMemo(() => new Set(agent.acceptedPatchKeys), [agent.acceptedPatchKeys])
  const rejected = useMemo(() => new Set(agent.rejectedPatchKeys), [agent.rejectedPatchKeys])
  const acceptedCount = patches.filter((patch) => accepted.has(patch.key)).length
  const pendingCount = countPendingResumeAgentPatches(patches, agent.acceptedPatchKeys, agent.rejectedPatchKeys)
  const acceptPatch = (patch: ResumeAgentPatch, confirmed = false) => {
    const result = agent.acceptPatch(baseData, patch.key, confirmed)
    if (!result.success) {
      if (result.error === 'MEDIUM_CONFIRM_REQUIRED' || result.error === 'HIGH_CONFIRM_REQUIRED') setRiskConfirmationKey(patch.key)
      else toast(result.error || '无法应用修改', 'error')
    } else {
      setRiskConfirmationKey(null)
    }
  }

  const createVersion = async () => {
    if (!agent.runId || !agent.agentDraftResumeData || !agent.versionTitle.trim()) return
    if (isStale) {
      toast('基础简历已变化，请重新运行 Agent', 'error')
      return
    }
    if (pendingCount > 0 && !pendingCreationConfirmation) {
      setPendingCreationConfirmation(true)
      return
    }

    agent.beginCreating()
    const source = createResumeAgentSource(agent.runId)
    try {
      const listResult = await fetchResumes()
      if (!listResult.success) throw new Error(listResult.error || '检查创建结果失败')
      const resumes = listResult.resumes || []
      let createdResume = findResumeCreatedForRun(resumes, agent.runId)
      let createdData: ResumeData

      if (createdResume) {
        createdData = normalizeResumeData(createdResume.content, createdResume.title)
      } else {
        const versionTitle = resolveResumeAgentVersionTitle(agent.versionTitle, resumes)
        createdData = normalizeResumeData({ ...agent.agentDraftResumeData, resumeTitle: versionTitle })
        const created = await createResume(versionTitle, resumeDataToRecord(createdData), source)
        if (!created.success || !created.resume) throw new Error(created.error || '创建岗位专属版本失败')
        createdResume = created.resume
        const resumeStore = useResumeStore.getState()
        resumeStore.setCachedResumes([createdResume, ...resumes], Date.now())
        scheduleResumePdfRefresh(createdResume.id, createdData)
      }

      let linkStatus: 'linked' | 'failed' | 'not_applicable' = 'not_applicable'
      if (agent.applicationId) {
        try {
          await updateApplication(agent.applicationId, { resume_id: createdResume.id })
          linkStatus = 'linked'
        } catch {
          linkStatus = 'failed'
        }
      }
      agent.creationCompleted({ resumeId: createdResume.id, resumeData: createdData, applicationLinkStatus: linkStatus })
      setPendingCreationConfirmation(false)
      toast('岗位专属版本已创建', 'success')
    } catch (error) {
      agent.creationFailed(error instanceof Error ? error.message : '创建岗位专属版本失败')
    }
  }

  const retryApplicationLink = async () => {
    if (!agent.applicationId || !agent.createdResumeId) return
    agent.setApplicationLinkStatus('idle')
    try {
      await updateApplication(agent.applicationId, { resume_id: agent.createdResumeId })
      agent.setApplicationLinkStatus('linked')
      toast('目标岗位关联已更新', 'success')
    } catch {
      agent.setApplicationLinkStatus('failed')
      toast('目标岗位关联仍未成功，请稍后重试', 'error')
    }
  }

  const openCreatedVersion = () => {
    if (!agent.createdResumeId || !agent.createdResumeData) return
    const resumeStore = useResumeStore.getState()
    resumeStore.setResumeData(agent.createdResumeData, agent.createdResumeData.resumeTitle)
    resumeStore.setCurrentResumeId(agent.createdResumeId)
    resumeStore.markCurrentResumeSaved(agent.createdResumeData)
    resumeStore.clearCurrentFile()
    resumeStore.setParseStatus('success')
    agent.setPreviewMode('base')
    navigate('/')
  }

  const exportCreatedPdf = async () => {
    if (!agent.createdResumeData || exporting) return
    setExporting(true)
    try {
      const { exportToPdf } = await import('../../utils/exporters')
      await exportToPdf(agent.createdResumeData, agent.createdResumeData.resumeTitle || agent.versionTitle)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'PDF 生成失败', 'error')
    } finally {
      setExporting(false)
    }
  }

  if (agent.status === 'running') {
    const activeIndex = STAGES.findIndex((stage) => stage.id === agent.stage)
    return (
      <div className="flex min-h-full flex-col p-4">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50"><Loader2 className="h-5 w-5 animate-spin text-cyan-600" /></span>
          <div><h3 className="text-sm font-semibold text-slate-900">正在生成岗位专属方案</h3><p className="mt-0.5 text-xs text-slate-500">完成前可留在当前页面查看进度</p></div>
        </div>
        <div className="space-y-1">
          {STAGES.map((stage, index) => {
            const completed = index < activeIndex
            const active = index === activeIndex
            return (
              <div key={stage.id} className={`rounded-xl px-3 py-2.5 ${active ? 'bg-cyan-50' : ''}`}>
                <div className="flex items-center gap-2">
                  {completed ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : active ? <Loader2 className="h-4 w-4 animate-spin text-cyan-600" /> : <Circle className="h-4 w-4 text-slate-300" />}
                  <span className={`text-sm ${active ? 'font-medium text-cyan-900' : completed ? 'text-slate-700' : 'text-slate-400'}`}>{stage.label}</span>
                </div>
                {agent.stageSummaries[stage.id] && <p className="ml-6 mt-1 text-xs leading-5 text-slate-500">{agent.stageSummaries[stage.id]}</p>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (agent.status === 'completed') {
    return (
      <div className="flex min-h-full flex-col p-4">
        <div className="rounded-2xl bg-emerald-50 p-4 text-center">
          <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
          <h3 className="mt-2 text-base font-semibold text-emerald-900">岗位专属版本已创建</h3>
          <p className="mt-1 text-xs text-emerald-700">基础简历保持不变，新版本可以继续编辑或直接导出。</p>
        </div>
        {agent.applicationLinkStatus === 'failed' && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">新版本已安全保存，但目标岗位关联未更新。<button type="button" onClick={() => void retryApplicationLink()} className="ml-1 font-medium underline">重试关联</button></div>}
        <div className="mt-4 space-y-2">
          <button type="button" onClick={openCreatedVersion} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-medium text-white"><ExternalLink className="h-4 w-4" />打开岗位专属版本</button>
          <button type="button" disabled={exporting} onClick={() => void exportCreatedPdf()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">{exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}导出 PDF</button>
        </div>
      </div>
    )
  }

  if (!agent.proposal) {
    return <TaskFailure message={agent.error || '任务尚未生成可审核结果'} onRetry={agent.clearTaskForRetry} />
  }

  if (agent.completionStatus === 'no_changes') {
    const noChangesMessage = agent.proposal.missingEvidence?.[0]?.message
      || agent.proposal.validation?.warnings?.[0]
      || '当前简历中没有足够证据支持安全修改。'
    return (
      <div className="p-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-slate-400" /><h3 className="mt-2 text-sm font-semibold text-slate-800">完成，但没有可用修改</h3><p className="mt-2 text-xs leading-5 text-slate-500">{noChangesMessage}</p></div>
        <button type="button" onClick={agent.clearTaskForRetry} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600"><RotateCcw className="h-4 w-4" />清空并重新运行</button>
      </div>
    )
  }

  return (
    <div className="min-h-full p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div><h3 className="text-sm font-semibold text-slate-900">审核修改建议</h3><p className="mt-1 text-xs text-slate-500">已接受 {acceptedCount} 项，待处理 {pendingCount} 项</p></div>
        <button type="button" disabled={agent.status === 'creating'} onClick={() => { const result = agent.acceptAllLowRisk(baseData); if (!result.success) toast(result.error || '批量应用失败', 'error') }} className="shrink-0 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40">接受全部低风险</button>
      </div>

      {!agent.historyPersisted && <div className="mb-3 flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>当前结果可继续审核，但刷新后可能无法恢复。<button type="button" onClick={() => void agent.retryHistoryPersistence()} className="ml-1 font-medium underline">重新校验并保存</button></span></div>}
      {isStale && <div className="mb-3 flex gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />基础简历已变化，修改建议已失效，请重新运行 Agent。</div>}

      <div className="space-y-3">
        {patches.map((patch) => {
          const isAccepted = accepted.has(patch.key)
          const isRejected = rejected.has(patch.key)
          const riskConfirming = riskConfirmationKey === patch.key
          return (
            <article key={patch.key} className={`rounded-2xl border p-3 ${isAccepted ? 'border-emerald-200 bg-emerald-50/30' : isRejected ? 'border-slate-200 bg-slate-50 opacity-75' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800">{patch.itemTitle}</p><p className="mt-1 text-xs leading-5 text-slate-500">{patch.reason}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ring-1 ${RISK_CLASS[patch.risk]}`}>{RISK_LABEL[patch.risk]}</span></div>
              <div className="mt-2 rounded-xl bg-slate-50 p-2.5 text-xs leading-5"><p className="text-slate-400">修改前</p><p className="line-clamp-3 text-slate-600">{getPatchBefore(patch)}</p><div className="my-1 flex items-center gap-1 text-cyan-600"><ChevronRight className="h-3.5 w-3.5" />建议</div><p className="line-clamp-4 text-slate-800">{getPatchAfter(patch)}</p></div>
              {patch.riskReasons.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{patch.riskReasons.slice(0, 1).map((reason, index) => <span key={`${patch.key}-risk-${index}`} className={`rounded-full px-2 py-1 text-[10px] leading-4 ring-1 ${patch.risk === 'high' ? 'bg-red-50 text-red-700 ring-red-100' : 'bg-amber-50 text-amber-700 ring-amber-100'}`}>{reason}</span>)}</div>}
              {riskConfirming && <div className={`mt-2 rounded-xl p-3 text-xs leading-5 ${patch.risk === 'high' ? 'bg-red-50 text-red-900' : 'bg-amber-50 text-amber-900'}`}><p className="font-medium">{patch.risk === 'high' ? '请确认接受这项高风险修改' : '请确认这项内容符合真实经历'}</p><p className={`mt-1 ${patch.risk === 'high' ? 'text-red-700' : 'text-amber-700'}`}>{patch.risk === 'high' ? '该内容存在事实或证据风险，确认真实无误后才会写入岗位专属草稿。' : '跨条目证据或责任强度变化需要你逐项核实。'}</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => setRiskConfirmationKey(null)} className={`flex-1 rounded-lg bg-white px-2 py-1.5 ring-1 ${patch.risk === 'high' ? 'ring-red-200' : 'ring-amber-200'}`}>返回</button><button type="button" onClick={() => acceptPatch(patch, true)} className={`flex-1 rounded-lg px-2 py-1.5 font-medium text-white ${patch.risk === 'high' ? 'bg-red-600' : 'bg-amber-600'}`}>{patch.risk === 'high' ? '确认并接受' : '已核实事实'}</button></div></div>}
              <div className="mt-2 flex items-center gap-2">
                <button type="button" onClick={() => onLocatePatch(patch)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-cyan-700 hover:bg-cyan-50"><MapPin className="h-3.5 w-3.5" />定位</button>
                {isAccepted || isRejected ? <button type="button" onClick={() => agent.resetPatchDecision(baseData, patch.key)} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100"><RotateCcw className="h-3.5 w-3.5" />撤销决定</button> : <><button type="button" onClick={() => agent.rejectPatch(baseData, patch.key)} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100"><XCircle className="h-3.5 w-3.5" />忽略</button><button type="button" disabled={isStale} onClick={() => acceptPatch(patch)} className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-40"><Check className="h-3.5 w-3.5" />接受</button></>}
              </div>
            </article>
          )
        })}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
        <label className="block text-xs font-medium text-slate-600">版本标题</label>
        <input value={agent.versionTitle} maxLength={120} onChange={(event) => agent.setVersionTitle(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-300" />
        {pendingCreationConfirmation && <div className="mt-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">还有 {pendingCount} 项未处理，创建后这些修改将计为忽略。<div className="mt-2 flex gap-2"><button type="button" onClick={() => setPendingCreationConfirmation(false)} className="flex-1 rounded-lg bg-white px-2 py-1.5 ring-1 ring-amber-200">继续审核</button><button type="button" onClick={() => void createVersion()} className="flex-1 rounded-lg bg-amber-600 px-2 py-1.5 font-medium text-white">确认忽略并创建</button></div></div>}
        <button type="button" disabled={agent.status === 'creating' || !agent.versionTitle.trim() || isStale} onClick={() => void createVersion()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50">{agent.status === 'creating' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}创建岗位专属版本</button>
        {agent.error && <p className="mt-2 text-xs leading-5 text-red-600">{agent.error}</p>}
      </div>
    </div>
  )
}

function TaskFailure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="p-4"><div className="rounded-2xl bg-red-50 p-4 text-center"><AlertCircle className="mx-auto h-8 w-8 text-red-500" /><h3 className="mt-2 text-sm font-semibold text-red-900">任务未完成</h3><p className="mt-2 whitespace-pre-line text-xs leading-5 text-red-700">{message}</p></div><button type="button" onClick={onRetry} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600"><RotateCcw className="h-4 w-4" />清空并重新运行</button></div>
}

function getPatchBefore(patch: ResumeAgentPatch): string {
  if (patch.kind === 'rich_text_replace') return patch.originalText
  if (patch.operation === 'add') return '当前技能列表中未包含该项'
  return patch.originalValue || '未提供原值'
}

function getPatchAfter(patch: ResumeAgentPatch): string {
  if (patch.kind === 'rich_text_replace') return patch.revisedText
  if (patch.operation === 'remove') return '移除该技能项'
  return patch.revisedValue || '未提供新值'
}

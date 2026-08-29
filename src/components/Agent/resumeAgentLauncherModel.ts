import type { ResumeAgentStage, ResumeAgentStatus } from '../../types/resumeAgent'

export interface ResumeAgentLauncherModelInput {
  status: ResumeAgentStatus
  stage: ResumeAgentStage | null
  stageSummary?: string
  patchCount: number
  hasResumes: boolean
  hasSelectedResume: boolean
  hasApplications: boolean
  hasSelectedApplication: boolean
  selectedApplicationHasJD: boolean
}

export interface ResumeAgentLauncherModel {
  summary: string
  primaryLabel: string
  primaryAction: 'new_resume' | 'select_resume' | 'add_job' | 'complete_jd' | 'generate' | 'open_task' | 'retry'
  tone: 'neutral' | 'progress' | 'success' | 'warning'
}

const ACTIVE_TASK_STATUSES = new Set<ResumeAgentStatus>(['confirming', 'running', 'review', 'creating', 'completed'])

export function hasActiveResumeAgentTask(status: ResumeAgentStatus): boolean {
  return ACTIVE_TASK_STATUSES.has(status)
}

export function deriveResumeAgentLauncherModel(input: ResumeAgentLauncherModelInput): ResumeAgentLauncherModel {
  if (input.status === 'running') {
    return {
      summary: input.stageSummary || stageLabel(input.stage) || '正在生成岗位专属建议',
      primaryLabel: '查看进度',
      primaryAction: 'open_task',
      tone: 'progress',
    }
  }
  if (input.status === 'review') {
    return {
      summary: `${input.patchCount} 项修改待审核`,
      primaryLabel: '继续审核',
      primaryAction: 'open_task',
      tone: 'warning',
    }
  }
  if (input.status === 'creating') {
    return {
      summary: '正在创建岗位专属版本',
      primaryLabel: '查看任务',
      primaryAction: 'open_task',
      tone: 'progress',
    }
  }
  if (input.status === 'completed') {
    return {
      summary: '岗位专属版本已创建',
      primaryLabel: '查看新版本',
      primaryAction: 'open_task',
      tone: 'success',
    }
  }
  if (input.status === 'confirming') {
    return {
      summary: '任务配置待确认',
      primaryLabel: '继续任务',
      primaryAction: 'open_task',
      tone: 'warning',
    }
  }
  if (input.status === 'failed' || input.status === 'interrupted' || input.status === 'cancelled') {
    return {
      summary: '上次任务未完成，可调整后重试',
      primaryLabel: '重新分析',
      primaryAction: 'retry',
      tone: 'warning',
    }
  }
  if (!input.hasResumes) {
    return {
      summary: '先建立一份可用于岗位优化的简历',
      primaryLabel: '新建简历',
      primaryAction: 'new_resume',
      tone: 'neutral',
    }
  }
  if (!input.hasSelectedResume) {
    return {
      summary: '选择一份已有简历作为优化基础',
      primaryLabel: '选择简历',
      primaryAction: 'select_resume',
      tone: 'neutral',
    }
  }
  if (!input.hasApplications || !input.hasSelectedApplication) {
    return {
      summary: '再选择一个目标岗位，即可开始定向分析',
      primaryLabel: '添加目标岗位',
      primaryAction: 'add_job',
      tone: 'neutral',
    }
  }
  if (!input.selectedApplicationHasJD) {
    return {
      summary: '这个岗位还缺少职位描述，补充后才能分析',
      primaryLabel: '补充 JD',
      primaryAction: 'complete_jd',
      tone: 'warning',
    }
  }
  return {
    summary: '分析岗位要求，并生成有证据、可逐项审核的修改建议',
    primaryLabel: '分析并生成建议',
    primaryAction: 'generate',
    tone: 'neutral',
  }
}

function stageLabel(stage: ResumeAgentStage | null): string | null {
  if (stage === 'understand_job') return '正在理解目标岗位'
  if (stage === 'read_evidence') return '正在检索简历证据'
  if (stage === 'plan_changes') return '正在规划修改范围'
  if (stage === 'generate_patches') return '正在生成修改建议'
  if (stage === 'validate_proposal') return '正在校验事实与风险'
  return null
}

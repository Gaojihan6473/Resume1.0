import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, Sparkles, Lightbulb, AlertCircle, FileText, Target } from 'lucide-react'
import type { Application } from '../../types/application'
import {
  JD_ANALYSIS_SECTIONS,
  type JDAnalysisResult,
  type JDScoreBreakdown,
  type JDAnalysisSectionId,
  type JDSectionStatus,
  type JDSectionAnalysis,
  type SuggestionItem,
} from '../../types/analytics'
import type { ResumeData } from '../../types/resume'
import { useResumeStore } from '../../store/resumeStore'
import { fetchResumes } from '../../lib/api'
import { CustomSelect } from '../Application/CustomSelect'
import { MatchScore } from './MatchScore'
import { Suggestions } from './Suggestions'

interface JDAnalyzerProps {
  applications: Application[]
}

export function JDAnalyzer({ applications }: JDAnalyzerProps) {
  const [searchParams] = useSearchParams()
  const resumeIdFromQuery = searchParams.get('resumeId') || ''
  const attemptedResumeLoadRef = useRef<string | null>(null)
  const [jdText, setJdText] = useState('')
  const [selectedResumeId, setSelectedResumeId] = useState<string>('')
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<JDAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { apiKey: userApiKey, cachedResumes, setCachedResumes } = useResumeStore()
  const apiKey = (import.meta.env.VITE_MINIMAX_API_KEY as string)?.trim() || userApiKey

  const applicationsWithJD = applications.filter((app) => app.jobDescription?.trim())

  useEffect(() => {
    if (resumeIdFromQuery) {
      setSelectedResumeId(resumeIdFromQuery)
    }
  }, [resumeIdFromQuery])

  useEffect(() => {
    if (!resumeIdFromQuery || cachedResumes.some((resume) => resume.id === resumeIdFromQuery)) return
    if (attemptedResumeLoadRef.current === resumeIdFromQuery) return

    let cancelled = false
    attemptedResumeLoadRef.current = resumeIdFromQuery

    async function loadResumes() {
      const result = await fetchResumes()
      if (!cancelled && result.success && result.resumes) {
        setCachedResumes(result.resumes, Date.now())
      }
    }

    loadResumes()

    return () => {
      cancelled = true
    }
  }, [cachedResumes, resumeIdFromQuery, setCachedResumes])

  const handleJobSelect = (jobId: string) => {
    setSelectedJobId(jobId)
    const job = applicationsWithJD.find((app) => app.id === jobId)
    if (job?.jobDescription) {
      setJdText(job.jobDescription)
    }
  }

  const handleAnalyze = async () => {
    if (!jdText.trim()) {
      setError('请先输入 JD 内容')
      return
    }
    if (!apiKey?.trim()) {
      setError('请先在设置中配置 API 密钥')
      return
    }
    if (!selectedResumeId) {
      setError('请先选择一份简历')
      return
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      const selectedResume = cachedResumes.find((r) => r.id === selectedResumeId)
      if (!selectedResume) {
        throw new Error('未找到选中的简历')
      }

      const resumeText = buildResumeText(selectedResume.content as unknown as ResumeData)
      const result = await analyzeJDWithAI(jdText, resumeText, apiKey)
      setAnalysisResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleClear = () => {
    setJdText('')
    setSelectedResumeId('')
    setSelectedJobId('')
    setAnalysisResult(null)
    setError(null)
  }

  const suggestionCount = analysisResult?.sectionAnalyses.reduce(
    (count, section) => count + section.suggestions.length,
    0
  ) ?? 0
  const prioritySectionCount = analysisResult?.sectionAnalyses.filter(
    (section) => section.status === '重点优化'
  ).length ?? 0

  return (
    <div className="grid h-full min-h-0 grid-cols-1 bg-slate-50 lg:grid-cols-[minmax(300px,34%)_minmax(0,66%)]">
      <aside className="min-h-0 overflow-y-auto border-b border-slate-200/70 bg-white/80 lg:border-b-0 lg:border-r">
        <div className="flex min-h-full flex-col p-4 lg:p-5">
          <div className="mb-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="rounded-md bg-blue-50 p-2">
                <FileText className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">输入 JD</h3>
                <p className="text-xs text-slate-400">选择岗位和简历后开始匹配</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <section>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">选择已有岗位</label>
            <CustomSelect
              value={selectedJobId}
              onChange={handleJobSelect}
              options={applicationsWithJD.map((app) => ({
                value: app.id,
                label: `${app.company} - ${app.position}`,
              }))}
              placeholder="— 从已投递岗位中选择 —"
            />
          </section>

          <section>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">匹配简历</label>
            <CustomSelect
              value={selectedResumeId}
              onChange={setSelectedResumeId}
              options={cachedResumes.map((resume) => ({
                value: resume.id,
                label: resume.title || '无标题简历',
              }))}
              placeholder="— 选择一份简历 —"
            />
          </section>

          <section className="flex min-h-[340px] flex-1 flex-col">
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              职位描述 {selectedJobId && <span className="text-blue-500">(已从岗位填充)</span>}
            </label>
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="粘贴 JD 内容，获取简历匹配度分析和优化建议..."
              className="min-h-[340px] w-full flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-700 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </section>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !jdText.trim() || !selectedResumeId}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-100 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  开始分析
                </>
              )}
            </button>
            <button
              onClick={handleClear}
              className="rounded-lg px-3 py-2 text-sm text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-800"
            >
              清空
            </button>
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </aside>

      <section className="min-h-0 overflow-y-auto bg-slate-50">
        <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-4 p-4 lg:p-6">
          {analysisResult ? (
            <>
              <div className="rounded-lg border border-slate-200/70 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <div className="rounded-md bg-emerald-50 p-2">
                    <Target className="h-4 w-4 text-emerald-500" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-700">匹配度评分</h3>
                </div>
                <MatchScore
                  score={analysisResult.matchScore}
                  breakdown={analysisResult.scoreBreakdown}
                  suggestionCount={suggestionCount}
                  prioritySectionCount={prioritySectionCount}
                  compact
                />
              </div>

              <div className="min-h-0 flex-1">
                <div className="mb-3 flex items-center gap-2">
                  <div className="rounded-md bg-amber-50 p-2">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-700">逐模块优化建议</h3>
                  <span className="ml-auto text-xs text-slate-400">{suggestionCount} 条建议</span>
                </div>
                <Suggestions sectionAnalyses={analysisResult.sectionAnalyses} />
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-100">
                  <Lightbulb className="h-10 w-10 text-slate-300" />
                </div>
                <p className="mb-1 font-medium text-slate-600">准备就绪</p>
                <p className="text-sm text-slate-400">输入 JD 并选择简历后</p>
                <p className="text-sm text-slate-400">点击“开始分析”获取逐模块结果</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function buildResumeText(content: ResumeData): string {
  const parts: string[] = []

  parts.push('【基础信息】')
  parts.push(`姓名: ${content.basic.name || '未填写'}`)
  if (content.basic.targetTitle) parts.push(`目标岗位: ${content.basic.targetTitle}`)
  if (content.basic.targetLocation) parts.push(`目标城市: ${content.basic.targetLocation}`)

  parts.push('\n【实习经历】')
  if (content.internships.length > 0) {
    content.internships.forEach((intern, index) => {
      parts.push(`实习${index + 1}: ${joinNonEmpty([intern.company, intern.department, intern.position], ' | ')}`)
      parts.push(`时间地点: ${joinNonEmpty([formatDateRange(intern.startDate, intern.endDate), intern.location], ' | ') || '未填写'}`)
      const body = cleanText(intern.content)
      if (body) {
        parts.push(`具体内容:\n${body}`)
      }
      if (intern.projects.length > 0) {
        parts.push('关联项目:')
        intern.projects.forEach((project, projectIndex) => {
          parts.push(`- ${projectIndex + 1}. ${project.title || '未命名项目'}`)
          appendLines(parts, project.description, project.bullets, project.achievements)
        })
      }
    })
  } else {
    parts.push('暂无')
  }

  parts.push('\n【项目经历】')
  if (content.projects.length > 0) {
    content.projects.forEach((project, index) => {
      parts.push(`项目${index + 1}: ${joinNonEmpty([project.name, project.role], ' | ')}`)
      parts.push(`时间: ${formatDateRange(project.startDate, project.endDate) || '未填写'}`)
      const body = cleanText(project.content)
      if (body) {
        parts.push(`具体内容:\n${body}`)
      } else {
        appendLines(parts, project.description, project.bullets, project.achievements)
      }
    })
  } else {
    parts.push('暂无')
  }

  parts.push('\n【个人总结】')
  const summaryContent = cleanText(content.summary.content || content.summary.text)
  if (summaryContent) {
    parts.push(summaryContent)
  } else if (content.summary.highlights.length > 0) {
    parts.push(content.summary.highlights.map((item) => `- ${item}`).join('\n'))
  } else {
    parts.push('暂无')
  }

  parts.push('\n【技能与其他】')
  parts.push(`技术技能: ${content.skills.technical.join('、') || '暂无'}`)
  parts.push(`语言能力: ${content.skills.languages.join('、') || '暂无'}`)
  parts.push(`证书资格: ${content.skills.certificates.join('、') || '暂无'}`)
  parts.push(`兴趣爱好: ${content.skills.interests.join('、') || '暂无'}`)

  return limitText(parts.join('\n'), 12000)
}

function appendLines(parts: string[], description: string, bullets: string[], achievements: string[]) {
  const lines = [
    cleanText(description),
    ...bullets.map(cleanText),
    ...achievements.map(cleanText),
  ].filter(Boolean)

  if (lines.length > 0) {
    parts.push(lines.map((line) => `  - ${line}`).join('\n'))
  }
}

function cleanText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function formatDateRange(startDate: string, endDate: string): string {
  return joinNonEmpty([startDate, endDate], ' - ')
}

function joinNonEmpty(values: string[], separator: string): string {
  return values.map((value) => value.trim()).filter(Boolean).join(separator)
}

function limitText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}\n...（内容过长，已截断）`
}

async function analyzeJDWithAI(
  jdText: string,
  resumeText: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<JDAnalysisResult> {
  const minimaxUrl = 'https://api.minimaxi.com/v1/chat/completions'

  try {
    const content = await requestAnalysisContent({
      minimaxUrl,
      apiKey,
      signal,
      messages: [
        { role: 'system', content: analyzeJDSystemPrompt },
        {
          role: 'user',
          content: `请分析以下 JD 和简历的匹配度，并严格按四个简历模块逐模块输出：

=== JD ===
${limitText(jdText.trim(), 8000)}

=== 简历内容 ===
${resumeText}`,
        },
      ],
    })

    try {
      return parseAnalysisResult(content, false)
    } catch (parseError) {
      console.warn('[JDAnalysis] 首次返回不是合法 JSON，准备自动重试:', parseError)
      const retryContent = await requestAnalysisContent({
        minimaxUrl,
        apiKey,
        signal,
        messages: [
          { role: 'system', content: strictJsonRetrySystemPrompt },
          {
            role: 'user',
            content: `上一次回复不是合法 JSON。请重新基于以下 JD 和简历输出唯一一个 JSON 对象。

重要：不要输出 <think>、推理过程、Markdown、解释文字。第一个字符必须是 {，最后一个字符必须是 }。

=== JD ===
${limitText(jdText.trim(), 8000)}

=== 简历内容 ===
${resumeText}`,
          },
        ],
      })
      return parseAnalysisResult(retryContent)
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('请求超时，请重试')
    }
    throw err
  }
}

type ChatMessage = {
  role: 'system' | 'user'
  content: string
}

async function requestAnalysisContent({
  minimaxUrl,
  apiKey,
  signal,
  messages,
}: {
  minimaxUrl: string
  apiKey: string
  signal?: AbortSignal
  messages: ChatMessage[]
}): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60000)
  const fetchSignal = signal ?? controller.signal

  try {
    const response = await fetch(minimaxUrl, {
      method: 'POST',
      signal: fetchSignal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.5',
        max_tokens: 8000,
        temperature: 0,
        messages,
      }),
    })

    if (!response.ok) {
      const message = await response.text().catch(() => '')
      throw new Error(`API 错误 ${response.status}: ${message}`)
    }

    const result = await response.json()
    const content = result?.choices?.[0]?.message?.content

    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('API 返回了空内容')
    }

    return content
  } finally {
    clearTimeout(timeout)
  }
}

const analyzeJDSystemPrompt = `你是一个资深求职辅导顾问，服务对象是已有成熟简历、准备针对具体 JD 做差异化投递优化的候选人。请基于用户提供的 JD 和简历内容，输出匹配度评分，并按简历模块顺序给出专业、克制、可落地的优化建议。

【分析顺序】
必须严格按以下 4 个模块逐模块分析，不能改变顺序，不能省略模块：
1. internships / 实习经历
2. projects / 项目经历
3. summary / 个人总结
4. skills / 技能与其他

【分析要求】
1. 匹配度评分（0-100）：基于技能关键词匹配、经历相关性、业务/行业场景契合度、表达质量综合判断。
2. scoreBreakdown 必须解释总分来源：skills=技能匹配、experience=经历相关、keywords=关键词覆盖、expression=表达质量；每项 score 为 0-100，并给出一句具体 reason。
3. 每个模块必须返回 status，取值只能是“重点优化”“可小修”“暂无问题”。如果建议较多或影响核心匹配，标为重点优化；只有小措辞问题标为可小修；无明显问题标为暂无问题。
4. 每条建议必须锚定到一整项简历内容：itemTitle 写该实习/项目/总结/技能条目的名称；originalContent 写该条目的完整原文；problemText 写 originalContent 中有问题、需要高亮的原文片段；targetText 可补充具体定位。
5. 不要只分析项目或经历开头；需要覆盖正文里的职责、技术栈、成果、指标、关键词表达。
6. 去重：同一问题、同一 JD 关键词、同一简历片段只提一次，不要换句话重复。
7. 不得编造事实、成果、技术栈、指标或经历。rewriteExample 只能基于已有事实改写；如果缺少事实，只能写“如确有相关经历，可补充...”。
8. 不要把 JD 中的事务性/招聘条件写入简历优化建议，包括但不限于：到岗时间、实习周期、每周到岗天数、薪资福利、招聘流程、工作地点偏好、转正机会、面试安排。除非简历原文已经自然包含相关信息，且它对岗位胜任力表达有明确帮助。
9. 对 internships 和 projects，必须主要围绕已有内容做优化：项目/经历排序、正文表述顺序、关键词前置、职责与成果的对应、已有技术栈/业务场景的表达强化。不要建议新增不存在的项目、职责、技术栈、成果指标或行业经验。
10. 对 internships 和 projects，如果 JD 要求但简历没有事实支撑，只能建议“如果确有相关经历，可在该项目中补充...”，不能写成确定发生过。
11. 对 summary，可以更主动地建议重写定位和关键词，但也不能编造具体经历或成果。
12. 建议必须聚焦成熟简历的差异化投递优化：岗位关键词、相关经历表达、业务场景匹配、技能栈呈现、成果量化、职责与 JD 的对应关系、表达优先级。
13. reason 负责资深顾问视角的专业分析；problem 负责指出原文与 JD 的具体差距；suggestion 负责修改策略；rewriteExample 负责给出可参考表达。
14. 某个模块没有明显优化点时，summary 简短说明原因，status 返回“暂无问题”，suggestions 返回空数组。

【输出格式】
只输出合法 JSON，不要输出 Markdown 代码块、解释文字、注释、<think> 或推理过程。第一个字符必须是 {，最后一个字符必须是 }：
{
  "matchScore": 75,
  "scoreBreakdown": {
    "skills": { "score": 72, "reason": "技能栈覆盖了JD中的核心要求，但缺少部分工具关键词" },
    "experience": { "score": 68, "reason": "项目/实习经历相关，但成果量化不足" },
    "keywords": { "score": 70, "reason": "覆盖部分JD关键词，仍缺少岗位高频表达" },
    "expression": { "score": 76, "reason": "表达清楚，但部分描述偏职责罗列" }
  },
  "sectionAnalyses": [
    {
      "section": "internships",
      "sectionLabel": "实习经历",
      "status": "重点优化",
      "summary": "本模块与JD的匹配概述",
      "suggestions": [
        {
          "type": "add|modify|highlight|remove",
          "category": "skill|experience|keyword|format",
          "itemTitle": "这条实习/项目/总结/技能内容的标题，例如：XX公司 | 前端实习生",
          "originalContent": "需要修改的这一整项简历原文，尽量完整保留标题、时间、正文和要点",
          "problemText": "originalContent中需要高亮的原文片段，必须能在originalContent里找到",
          "targetText": "可选：具体定位补充",
          "problem": "当前内容与JD要求之间的具体差距",
          "suggestion": "具体可操作的修改建议",
          "rewriteExample": "基于已有事实的示例改写；没有事实则使用“如确有相关经历，可补充...”",
          "reason": "为什么这样修改能提升匹配度"
        }
      ]
    },
    {
      "section": "projects",
      "sectionLabel": "项目经历",
      "status": "可小修",
      "summary": "",
      "suggestions": []
    },
    {
      "section": "summary",
      "sectionLabel": "个人总结",
      "status": "暂无问题",
      "summary": "",
      "suggestions": []
    },
    {
      "section": "skills",
      "sectionLabel": "技能与其他",
      "status": "暂无问题",
      "summary": "",
      "suggestions": []
    }
  ],
  "resumeText": "简历摘要",
  "jdText": "JD摘要"
}

【重要规则】
1. sectionAnalyses 必须包含且只包含上述 4 个模块，顺序固定。
2. scoreBreakdown 必须包含 skills、experience、keywords、expression 四项，且 reason 要说明具体依据。
3. 每个模块最多返回 3 条建议，总建议数建议控制在 4-10 条。
4. itemTitle、originalContent、problemText、problem、suggestion、reason 不能为空；rewriteExample 尽量给出。
5. matchScore 要客观真实，不要过高评分。`

const strictJsonRetrySystemPrompt = `${analyzeJDSystemPrompt}

【重试要求】
你上一次没有返回合法 JSON。本次必须只返回一个 JSON 对象。
- 禁止输出 <think>、思考过程、自然语言说明、Markdown 代码块。
- 不要先分析再输出 JSON。
- 不要省略 closing brace。
- 如果内容太长，减少 suggestions 数量，优先保证 JSON 完整合法。`

function parseAnalysisResult(content: string, fallbackOnError = true): JDAnalysisResult {
  try {
    const parsed = parseJsonObject(content)
    const legacySuggestions = normalizeSuggestions(parsed.suggestions)
    const sectionAnalyses = normalizeSectionAnalyses(parsed.sectionAnalyses, legacySuggestions)

    return {
      matchScore: typeof parsed.matchScore === 'number' ? parsed.matchScore : 0,
      scoreBreakdown: normalizeScoreBreakdown(parsed.scoreBreakdown, parsed.matchScore),
      suggestions: sectionAnalyses.flatMap((section) => section.suggestions),
      sectionAnalyses,
      resumeText: typeof parsed.resumeText === 'string' ? parsed.resumeText : '',
      jdText: typeof parsed.jdText === 'string' ? parsed.jdText : '',
    }
  } catch (error) {
    if (!fallbackOnError) {
      throw error
    }
    console.error('[JDAnalysis] JSON解析失败:', error, content.slice(0, 800))
    const sectionAnalyses = normalizeSectionAnalyses(undefined, [
      {
        type: 'modify',
        category: 'format',
        itemTitle: 'AI 返回结果',
        originalContent: '无法解析分析结果',
        problemText: '无法解析分析结果',
        targetText: 'AI 返回结果',
        current: '无法解析分析结果',
        problem: 'AI 返回格式异常',
        suggestion: '请重试或检查输入内容',
        rewriteExample: '',
        reason: 'AI 返回的内容不是合法 JSON',
      },
    ])

    return {
      matchScore: 50,
      scoreBreakdown: createDefaultScoreBreakdown(50),
      suggestions: sectionAnalyses.flatMap((section) => section.suggestions),
      sectionAnalyses,
      resumeText: '',
      jdText: '',
    }
  }
}

function parseJsonObject(content: string): Record<string, unknown> {
  const rawJson = extractFirstJsonObject(content)
  if (!rawJson) {
    throw new Error('AI 返回内容中未找到 JSON 对象')
  }

  const candidates = buildJsonCandidates(rawJson)
  let lastError: unknown = null

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (isRecord(parsed)) return parsed
      throw new Error('JSON 根节点不是对象')
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('解析 JSON 失败')
}

function extractFirstJsonObject(text: string): string | null {
  const cleaned = text
    .replace(/^\uFEFF/, '')
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim()

  let start = -1
  let depth = 0
  let inString = false
  let escaping = false

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i]

    if (inString) {
      if (escaping) {
        escaping = false
        continue
      }
      if (ch === '\\') {
        escaping = true
        continue
      }
      if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') {
      if (depth === 0) start = i
      depth += 1
      continue
    }
    if (ch === '}') {
      if (depth > 0) depth -= 1
      if (depth === 0 && start >= 0) {
        return cleaned.slice(start, i + 1)
      }
    }
  }

  return null
}

function buildJsonCandidates(rawJson: string): string[] {
  const normalized = rawJson
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u00A0/g, ' ')
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0)
      return code === 9 || code === 10 || code === 13 || code >= 32
    })
    .join('')

  return uniqueStrings([
    rawJson,
    normalized,
    normalized.replace(/,\s*([}\]])/g, '$1'),
    normalized.replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":'),
    normalized
      .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
      .replace(/,\s*([}\]])/g, '$1'),
  ])
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values))
}

function normalizeSectionAnalyses(value: unknown, legacySuggestions: SuggestionItem[]): JDSectionAnalysis[] {
  const rawSections = Array.isArray(value) ? value : []
  const legacyBySection = groupLegacySuggestions(legacySuggestions)

  return JD_ANALYSIS_SECTIONS.map(({ section, sectionLabel }) => {
    const rawSection = rawSections.find((item) => isRecord(item) && item.section === section)
    const rawSuggestions = isRecord(rawSection) ? normalizeSuggestions(rawSection.suggestions) : []
    const suggestions = rawSuggestions.length > 0 ? rawSuggestions : legacyBySection[section]

    return {
      section,
      sectionLabel,
      status: normalizeSectionStatus(
        isRecord(rawSection) ? rawSection.status : undefined,
        suggestions.length
      ),
      summary: isRecord(rawSection) && typeof rawSection.summary === 'string' ? rawSection.summary : '',
      suggestions: dedupeSuggestions(suggestions),
    }
  })
}

function normalizeScoreBreakdown(value: unknown, matchScore: unknown): JDScoreBreakdown {
  const fallbackScore = typeof matchScore === 'number' ? matchScore : 0
  const fallback = createDefaultScoreBreakdown(fallbackScore)
  if (!isRecord(value)) return fallback

  return {
    skills: normalizeScoreBreakdownItem(value.skills, fallback.skills),
    experience: normalizeScoreBreakdownItem(value.experience, fallback.experience),
    keywords: normalizeScoreBreakdownItem(value.keywords, fallback.keywords),
    expression: normalizeScoreBreakdownItem(value.expression, fallback.expression),
  }
}

function normalizeScoreBreakdownItem(value: unknown, fallback: JDScoreBreakdown['skills']) {
  if (!isRecord(value)) return fallback
  return {
    score: typeof value.score === 'number' ? clampScore(value.score) : fallback.score,
    reason: typeof value.reason === 'string' && value.reason.trim() ? value.reason.trim() : fallback.reason,
  }
}

function createDefaultScoreBreakdown(matchScore: number): JDScoreBreakdown {
  const score = clampScore(matchScore)
  return {
    skills: { score, reason: 'AI 未返回技能匹配分项，暂按总分估算' },
    experience: { score, reason: 'AI 未返回经历相关分项，暂按总分估算' },
    keywords: { score, reason: 'AI 未返回关键词覆盖分项，暂按总分估算' },
    expression: { score, reason: 'AI 未返回表达质量分项，暂按总分估算' },
  }
}

function normalizeSectionStatus(value: unknown, suggestionCount: number): JDSectionStatus {
  if (value === '重点优化' || value === '可小修' || value === '暂无问题') return value
  if (suggestionCount >= 2) return '重点优化'
  if (suggestionCount === 1) return '可小修'
  return '暂无问题'
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(Math.round(score), 100))
}

function groupLegacySuggestions(suggestions: SuggestionItem[]): Record<JDAnalysisSectionId, SuggestionItem[]> {
  const grouped: Record<JDAnalysisSectionId, SuggestionItem[]> = {
    internships: [],
    projects: [],
    summary: [],
    skills: [],
  }

  suggestions.forEach((suggestion) => {
    const section = inferSectionFromSuggestion(suggestion)
    grouped[section].push(suggestion)
  })

  return grouped
}

function inferSectionFromSuggestion(suggestion: SuggestionItem): JDAnalysisSectionId {
  const text = `${suggestion.targetText || ''} ${suggestion.current || ''} ${suggestion.problem || ''} ${suggestion.suggestion || ''}`
  if (/实习|公司|岗位|职位|经历/.test(text)) return 'internships'
  if (/项目|系统|平台|功能|模块/.test(text)) return 'projects'
  if (/总结|介绍|摘要|自我/.test(text)) return 'summary'
  if (suggestion.category === 'skill' || suggestion.category === 'keyword') return 'skills'
  return 'skills'
}

function normalizeSuggestions(value: unknown): SuggestionItem[] {
  if (!Array.isArray(value)) return []

  return value
    .filter(isRecord)
    .map((item) => {
      const suggestion = typeof item.suggestion === 'string' ? item.suggestion.trim() : ''
      const current = typeof item.current === 'string' ? item.current.trim() : ''
      const targetText = typeof item.targetText === 'string' ? item.targetText.trim() : current
      const originalContent = typeof item.originalContent === 'string' ? item.originalContent.trim() : targetText
      const problemText = typeof item.problemText === 'string' ? item.problemText.trim() : targetText
      const problem = typeof item.problem === 'string' ? item.problem.trim() : ''

      return {
        type: normalizeType(item.type),
        category: normalizeCategory(item.category),
        current,
        itemTitle: typeof item.itemTitle === 'string' ? item.itemTitle.trim() : '',
        originalContent,
        targetText,
        problemText,
        problem,
        suggestion,
        rewriteExample: typeof item.rewriteExample === 'string' ? item.rewriteExample.trim() : '',
        reason: typeof item.reason === 'string' ? item.reason.trim() : '',
      }
    })
    .filter((item) => item.suggestion || item.problem || item.targetText)
}

function dedupeSuggestions(suggestions: SuggestionItem[]): SuggestionItem[] {
  const seen = new Set<string>()

  return suggestions.filter((suggestion) => {
    const key = [
      suggestion.targetText || suggestion.current || '',
      suggestion.originalContent || '',
      suggestion.problemText || '',
      suggestion.problem || '',
      suggestion.suggestion || '',
    ]
      .join('|')
      .replace(/\s+/g, '')
      .slice(0, 160)

    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function normalizeType(value: unknown): SuggestionItem['type'] {
  return value === 'add' || value === 'modify' || value === 'highlight' || value === 'remove'
    ? value
    : 'modify'
}

function normalizeCategory(value: unknown): SuggestionItem['category'] {
  return value === 'skill' || value === 'experience' || value === 'keyword' || value === 'format'
    ? value
    : 'format'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

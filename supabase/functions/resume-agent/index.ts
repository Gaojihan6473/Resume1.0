import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  assertResumeAgentBudget,
  markResumeAgentPatchReviewOnly,
  RESUME_AGENT_LIMITS,
  summarizeResumeAgentProposal,
  validateResumeAgentProposalEnvelope,
} from './core.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const MODEL = 'deepseek-v4-flash'
const PROMPT_VERSION = 'resume-agent-p0-v1'
const MAX_JD_LENGTH = 12_000
const MAX_RESUME_TEXT_LENGTH = 40_000
const MAX_TOTAL_INPUT_LENGTH = 80_000
const MAX_PATCHES = 7

type JsonRecord = Record<string, unknown>

function logResumeAgentDiagnostic(runId: string, event: string, details: JsonRecord = {}) {
  console.info('[resume-agent]', {
    event,
    runId,
    model: MODEL,
    promptVersion: PROMPT_VERSION,
    ...details,
  })
}

interface RequestContext {
  request: JsonRecord
  userId: string
  admin: ReturnType<typeof createClient>
  resume: JsonRecord
  resumeData: JsonRecord
  resumeText: string
  jdText: string
  company: string
  position: string
  applicationId: string | null
  resumeHash: string
  jdHash: string
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as JsonRecord
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizeText(value)))
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function skillHash(values: string[]): string {
  let hash = 2166136261
  const source = values.map((value) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()).join('\u001f')
  for (const character of source) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `${values.length}:${(hash >>> 0).toString(36)}`
}

function resumeToText(data: JsonRecord): string {
  const basic = isRecord(data.basic) ? data.basic : {}
  const summary = isRecord(data.summary) ? data.summary : {}
  const skills = isRecord(data.skills) ? data.skills : {}
  const internships = Array.isArray(data.internships) ? data.internships.filter(isRecord) : []
  const projects = Array.isArray(data.projects) ? data.projects.filter(isRecord) : []
  const education = Array.isArray(data.education) ? data.education.filter(isRecord) : []
  const array = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  return normalizeText([
    `姓名：${asString(basic.name)}`,
    `目标职位：${asString(basic.targetTitle)}`,
    `教育：${education.map((item) => [item.school, item.major, item.degree, item.startDate, item.endDate].map(asString).filter(Boolean).join(' / ')).join('\n')}`,
    `实习：${internships.map((item) => `[${asString(item.id)}] ${asString(item.company)} / ${asString(item.position)} / ${asString(item.startDate)}-${asString(item.endDate)}\n${stripHtml(asString(item.content))}`).join('\n')}`,
    `项目：${projects.map((item) => `[${asString(item.id)}] ${asString(item.name)} / ${asString(item.role)} / ${asString(item.startDate)}-${asString(item.endDate)}\n${stripHtml(asString(item.content))}`).join('\n')}`,
    `总结：[summary] ${stripHtml(asString(summary.content))}`,
    `技能：[skills] technical=${array(skills.technical).join('、')}；languages=${array(skills.languages).join('、')}；certificates=${array(skills.certificates).join('、')}；interests=${array(skills.interests).join('、')}`,
  ].join('\n\n'))
}

async function authenticate(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authHeader = req.headers.get('Authorization')
  if (!supabaseUrl || !anonKey || !serviceKey) throw new HttpError(500, 'SERVER_CONFIGURATION', '服务端配置不完整')
  if (!authHeader) throw new HttpError(401, 'UNAUTHORIZED', '登录状态已失效')
  const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) throw new HttpError(401, 'UNAUTHORIZED', '登录状态已失效')
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: validKey } = await admin.from('valid_keys').select('id').eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle()
  if (!validKey) throw new HttpError(401, 'KEY_INACTIVE', '当前登录凭证已失效')
  return { userId: user.id, admin }
}

async function preflight(req: Request): Promise<RequestContext> {
  if (Deno.env.get('RESUME_AGENT_ENABLED') !== 'true') throw new HttpError(404, 'FEATURE_DISABLED', 'Resume Agent 尚未启用')
  const { userId, admin } = await authenticate(req)
  const request = await req.json()
  if (!isRecord(request) || request.schemaVersion !== 1) throw new HttpError(400, 'INVALID_REQUEST', '请求格式无效')
  const runId = asString(request.runId)
  const resumeId = asString(request.resumeId)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId) || !resumeId) {
    throw new HttpError(400, 'INVALID_REQUEST', '任务标识或简历标识无效')
  }
  const { data: resume, error: resumeError } = await admin.from('resumes').select('id,title,content').eq('id', resumeId).eq('user_id', userId).maybeSingle()
  if (resumeError || !resume || !isRecord(resume.content)) throw new HttpError(404, 'RESUME_NOT_FOUND', '基础简历不存在或无权访问')
  const resumeData = resume.content as JsonRecord
  const resumeText = resumeToText(resumeData)
  const resumeHash = await sha256(stableStringify(resumeData))
  if (resumeHash !== request.expectedResumeHash) throw new HttpError(409, 'STALE_RESUME', '基础简历已变化，请刷新后重试')

  const job = isRecord(request.job) ? request.job : null
  if (!job || (job.source !== 'application' && job.source !== 'manual')) throw new HttpError(400, 'INVALID_JOB', '目标岗位格式无效')
  let jdText = ''
  let company = ''
  let position = ''
  let applicationId: string | null = null
  if (job.source === 'application') {
    applicationId = asString(job.applicationId)
    const { data: application } = await admin.from('applications').select('id,company,position,job_description').eq('id', applicationId).eq('user_id', userId).maybeSingle()
    if (!application) throw new HttpError(404, 'APPLICATION_NOT_FOUND', '目标岗位不存在或无权访问')
    jdText = asString(application.job_description)
    company = asString(application.company)
    position = asString(application.position)
  } else {
    jdText = asString(job.jdText)
    company = asString(job.company).slice(0, 80)
    position = asString(job.position).slice(0, 80)
  }
  jdText = normalizeText(jdText)
  if (!jdText || jdText.length > MAX_JD_LENGTH) throw new HttpError(413, 'JD_LENGTH_INVALID', `职位描述必须在 1 到 ${MAX_JD_LENGTH} 个字符之间`)
  if (resumeText.length > MAX_RESUME_TEXT_LENGTH || resumeText.length + jdText.length > MAX_TOTAL_INPUT_LENGTH) {
    throw new HttpError(413, 'INPUT_TOO_LARGE', '简历或任务上下文过长，未进行截断')
  }
  const jdHash = await sha256(jdText)
  if (jdHash !== job.expectedJdHash) throw new HttpError(409, 'STALE_JOB', '目标岗位已变化，请刷新后重试')
  return { request, userId, admin, resume, resumeData, resumeText, jdText, company, position, applicationId, resumeHash, jdHash }
}

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}

async function callModel(messages: JsonRecord[], tools: JsonRecord[], toolName: string, signal: AbortSignal) {
  const apiKey = Deno.env.get('DEEPSEEK_API_KEY')
  if (!apiKey) throw new Error('DeepSeek API key is not configured')
  const response = await fetch(Deno.env.get('DEEPSEEK_API_URL') || 'https://api.deepseek.com/chat/completions', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools,
      tool_choice: { type: 'function', function: { name: toolName } },
      thinking: { type: 'disabled' },
      temperature: 0,
      max_tokens: 6500,
    }),
  })
  const body = await response.json()
  if (!response.ok) throw new Error(`上游模型请求失败（${response.status}）`)
  const responseToolCalls = Array.isArray(body?.choices?.[0]?.message?.tool_calls) ? body.choices[0].message.tool_calls : []
  const toolCall = responseToolCalls.find((call: JsonRecord) => call?.function?.name === toolName)
  if (!toolCall?.function?.arguments) throw new Error(`模型未调用 ${toolName}`)
  let args: unknown
  try { args = JSON.parse(toolCall.function.arguments) } catch { throw new Error(`${toolName} 参数不是有效 JSON`) }
  return {
    args,
    completionTokens: Number(body?.usage?.completion_tokens || 0),
    finishReason: asString(body?.choices?.[0]?.finish_reason),
    responseToolCallCount: responseToolCalls.length,
    toolArgumentLength: asString(toolCall.function.arguments).length,
  }
}

const proposalSchema: JsonRecord = {
  type: 'object',
  required: ['schemaVersion', 'goalSummary', 'targetRequirements', 'evidence', 'sectionAnalyses', 'patches', 'missingEvidence', 'validation'],
  properties: {
    schemaVersion: { type: 'integer', enum: [1] },
    goalSummary: { type: 'string', description: '本次优化目标摘要' },
    targetRequirements: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'requirement', 'priority', 'coverage', 'evidenceKeys'],
        properties: {
          id: { type: 'string' },
          requirement: { type: 'string' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          coverage: { type: 'string', enum: ['covered', 'partial', 'missing'] },
          evidenceKeys: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        required: ['key', 'section', 'itemId', 'itemTitle', 'field', 'quote', 'strength', 'explanation'],
        properties: {
          key: { type: 'string' },
          section: { type: 'string', enum: ['internships', 'projects', 'summary', 'skills'] },
          itemId: { type: ['string', 'null'] },
          itemTitle: { type: 'string' },
          field: { type: 'string', enum: ['content', 'technical', 'languages', 'certificates', 'interests'] },
          quote: { type: 'string' },
          strength: { type: 'string', enum: ['strong', 'medium', 'weak'] },
          explanation: { type: 'string' },
        },
      },
    },
    sectionAnalyses: { type: 'array', items: { type: 'object' } },
    patches: {
      type: 'array',
      maxItems: MAX_PATCHES,
      description: '所有实际修改必须放在此数组，禁止改用 modifications 等自定义字段',
      items: {
        type: 'object',
        required: ['key', 'kind', 'section', 'itemTitle', 'target', 'requirementIds', 'evidenceKeys', 'reason', 'risk', 'riskReasons', 'anchorStatus'],
        properties: {
          key: { type: 'string' },
          kind: { type: 'string', enum: ['rich_text_replace', 'skill_item'] },
          section: { type: 'string', enum: ['internships', 'projects', 'summary', 'skills'] },
          itemTitle: { type: 'string' },
          target: { type: 'object' },
          requirementIds: { type: 'array', items: { type: 'string' } },
          evidenceKeys: { type: 'array', items: { type: 'string' } },
          reason: { type: 'string' },
          risk: { type: 'string', enum: ['low', 'medium', 'high'] },
          riskReasons: { type: 'array', items: { type: 'string' } },
          anchorStatus: { type: 'string', enum: ['valid', 'invalid'] },
          operation: { type: 'string', enum: ['add', 'remove', 'replace'] },
          originalText: { type: 'string' },
          revisedText: { type: 'string' },
          originalValue: { type: 'string' },
          revisedValue: { type: 'string' },
          expectedArrayHash: { type: 'string' },
        },
      },
    },
    missingEvidence: {
      type: 'array',
      description: '无法安全修改的要求；patches 为空时至少填写一项',
      items: {
        type: 'object',
        required: ['requirementId', 'message'],
        properties: { requirementId: { type: 'string' }, message: { type: 'string' } },
      },
    },
    validation: {
      type: 'object',
      required: ['passed', 'warnings'],
      properties: { passed: { type: 'boolean' }, warnings: { type: 'array', items: { type: 'string' } } },
    },
  },
}

const tools: JsonRecord[] = [
  { type: 'function', function: { name: 'search_resume_evidence', description: '提交结构化计划和证据检索条件', parameters: { type: 'object', required: ['plan', 'queries'], properties: { plan: { type: 'object' }, queries: { type: 'array', maxItems: 20, items: { type: 'object' } } } } } },
  { type: 'function', function: { name: 'validate_patch_anchor', description: '请求编排器校验所有修改目标', parameters: { type: 'object', required: ['patches'], properties: { patches: { type: 'array', maxItems: MAX_PATCHES, items: { type: 'object' } } } } } },
  { type: 'function', function: { name: 'validate_resume_proposal', description: '严格按指定字段提交完整 Proposal 进行确定性校验', parameters: { type: 'object', required: ['proposal'], properties: { proposal: proposalSchema } } } },
]

function findEvidence(data: JsonRecord, queries: unknown): JsonRecord[] {
  const candidates: JsonRecord[] = []
  for (const section of ['internships', 'projects'] as const) {
    const items = Array.isArray(data[section]) ? (data[section] as unknown[]).filter(isRecord) : []
    for (const item of items) candidates.push({ section, itemId: asString(item.id), itemTitle: asString(item.company || item.name), field: 'content', text: stripHtml(asString(item.content)) })
  }
  const summary = isRecord(data.summary) ? data.summary : {}
  candidates.push({ section: 'summary', itemId: null, itemTitle: '个人总结', field: 'content', text: stripHtml(asString(summary.content)) })
  const skills = isRecord(data.skills) ? data.skills : {}
  for (const field of ['technical', 'languages', 'certificates', 'interests']) {
    const values = Array.isArray(skills[field]) ? (skills[field] as unknown[]).filter((item): item is string => typeof item === 'string') : []
    candidates.push({ section: 'skills', itemId: null, itemTitle: '技能与其他', field, text: values.join('、') || '当前为空', expectedArrayHash: skillHash(values) })
  }
  const terms = Array.isArray(queries) ? queries.flatMap((query) => isRecord(query) && Array.isArray(query.terms) ? query.terms : []).filter((term): term is string => typeof term === 'string').slice(0, 30) : []
  return candidates.map((candidate, index) => {
    const text = asString(candidate.text)
    const matched = terms.filter((term) => text.toLocaleLowerCase().includes(term.toLocaleLowerCase()))
    return { key: `evidence-${index + 1}`, ...candidate, quote: text.slice(0, 800), strength: matched.length ? 'strong' : 'medium', explanation: matched.length ? `命中：${matched.slice(0, 5).join('、')}` : '提供可修改范围内的原始证据' }
  }).filter((candidate) => asString(candidate.quote)).slice(0, 30)
}

function getEvidenceSourceText(data: JsonRecord, evidence: JsonRecord): string | null {
  const section = asString(evidence.section)
  const field = asString(evidence.field)
  if (section === 'summary' && field === 'content') {
    return stripHtml(asString(isRecord(data.summary) ? data.summary.content : ''))
  }
  if ((section === 'internships' || section === 'projects') && field === 'content') {
    const items = Array.isArray(data[section]) ? (data[section] as unknown[]).filter(isRecord) : []
    const item = items.find((entry) => asString(entry.id) === asString(evidence.itemId))
    return item ? stripHtml(asString(item.content)) : null
  }
  if (section === 'skills' && ['technical', 'languages', 'certificates', 'interests'].includes(field)) {
    const skills = isRecord(data.skills) ? data.skills : {}
    const values = Array.isArray(skills[field]) ? (skills[field] as unknown[]).filter((item): item is string => typeof item === 'string') : []
    return values.join('、') || '当前为空'
  }
  return null
}

function validateProposal(proposal: unknown, data: JsonRecord): { proposal: JsonRecord | null; errors: string[] } {
  if (!isRecord(proposal)) return { proposal: null, errors: validateResumeAgentProposalEnvelope(proposal) }
  const patches = Array.isArray(proposal.patches) ? proposal.patches : []
  const evidence = Array.isArray(proposal.evidence) ? proposal.evidence.filter(isRecord) : []
  const errors = validateResumeAgentProposalEnvelope(proposal)
  if (patches.length > MAX_PATCHES) errors.push(`修改数量超过 ${MAX_PATCHES} 条`)
  const keys = new Set<string>()
  const targets = new Set<string>()
  const evidenceByKey = new Map<string, JsonRecord>()
  for (const item of evidence) {
    const key = asString(item.key)
    const quote = asString(item.quote).trim()
    const source = getEvidenceSourceText(data, item)
    if (!key || evidenceByKey.has(key)) {
      errors.push('证据标识缺失或重复')
    } else if (source === null || !quote || !source.includes(quote)) {
      errors.push(`${key || '证据'} 无法在基础简历中核实`)
    } else {
      evidenceByKey.set(key, item)
    }
  }
  for (const rawPatch of patches) {
    if (!isRecord(rawPatch)) { errors.push('修改项格式无效'); continue }
    const key = asString(rawPatch.key)
    if (!key || keys.has(key)) errors.push('修改项标识缺失或重复')
    keys.add(key)
    const target = isRecord(rawPatch.target) ? rawPatch.target : {}
    const section = asString(rawPatch.section)
    const kind = asString(rawPatch.kind)
    let targetKey = ''
    if (kind === 'rich_text_replace' && ['internships', 'projects', 'summary'].includes(section) && target.field === 'content') {
      let content = ''
      if (section === 'summary') content = stripHtml(asString(isRecord(data.summary) ? data.summary.content : ''))
      else {
        const items = Array.isArray(data[section]) ? (data[section] as unknown[]).filter(isRecord) : []
        const item = items.find((entry) => asString(entry.id) === asString(target.itemId))
        content = stripHtml(asString(item?.content))
      }
      const original = asString(rawPatch.originalText)
      const occurrences = original ? content.split(original).length - 1 : 0
      if (occurrences !== 1) errors.push(`${key || '修改项'} 的正文锚点不是唯一匹配`)
      targetKey = `${section}:${asString(target.itemId)}:${original}`
    } else if (kind === 'skill_item' && section === 'skills' && ['technical', 'languages', 'certificates', 'interests'].includes(asString(target.field))) {
      const skills = isRecord(data.skills) ? data.skills : {}
      const values = Array.isArray(skills[asString(target.field)]) ? (skills[asString(target.field)] as unknown[]).filter((item): item is string => typeof item === 'string') : []
      if (skillHash(values) !== rawPatch.expectedArrayHash) errors.push(`${key || '修改项'} 的技能列表已变化`)
      const operation = asString(rawPatch.operation)
      const originalValue = asString(rawPatch.originalValue).trim()
      const revisedValue = asString(rawPatch.revisedValue).trim()
      const normalizedValues = values.map((value) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase())
      const normalizedOriginal = originalValue.replace(/\s+/g, ' ').toLocaleLowerCase()
      const normalizedRevised = revisedValue.replace(/\s+/g, ' ').toLocaleLowerCase()
      const originalMatches = normalizedOriginal ? normalizedValues.filter((value) => value === normalizedOriginal).length : 0
      if (operation === 'add' && (!normalizedRevised || normalizedValues.includes(normalizedRevised))) errors.push(`${key || '修改项'} 的新增技能为空或已存在`)
      else if ((operation === 'remove' || operation === 'replace') && originalMatches !== 1) errors.push(`${key || '修改项'} 的原技能不是唯一匹配`)
      else if (operation === 'replace' && (!normalizedRevised || normalizedValues.includes(normalizedRevised))) errors.push(`${key || '修改项'} 的替换技能为空或已存在`)
      else if (!['add', 'remove', 'replace'].includes(operation)) errors.push(`${key || '修改项'} 的技能操作无效`)
      targetKey = `skills:${asString(target.field)}:${asString(rawPatch.originalValue || rawPatch.revisedValue).toLocaleLowerCase()}`
    } else errors.push(`${key || '修改项'} 尝试修改不支持的字段`)
    if (targetKey && targets.has(targetKey)) errors.push(`${key || '修改项'} 与另一修改项冲突`)
    targets.add(targetKey)

    const requestedEvidenceKeys = Array.isArray(rawPatch.evidenceKeys) ? rawPatch.evidenceKeys.map(asString) : []
    const evidenceItems = requestedEvidenceKeys.map((item) => evidenceByKey.get(item)).filter(Boolean) as JsonRecord[]
    if (requestedEvidenceKeys.length !== evidenceItems.length) errors.push(`${key || '修改项'} 引用了无法核实的证据`)
    const before = asString(rawPatch.originalText || rawPatch.originalValue)
    const after = asString(rawPatch.revisedText || rawPatch.revisedValue)
    const introducedFacts = (after.match(/\d+(?:\.\d+)?%?|(?:19|20)\d{2}|[$¥￥]\s?\d+(?:\.\d+)?/g) || []).filter((fact) => !before.includes(fact))
    const hasStrongEvidence = evidenceItems.some((item) => item.strength === 'strong' && introducedFacts.every((fact) => asString(item.quote).includes(fact)))
    if (!evidenceItems.length || evidenceItems.some((item) => item.strength === 'weak')) {
      rawPatch.risk = 'high'
      rawPatch.riskReasons = [...(Array.isArray(rawPatch.riskReasons) ? rawPatch.riskReasons : []), '缺少可核实的明确证据']
    }
    if (introducedFacts.length && !hasStrongEvidence) {
      rawPatch.risk = 'high'
      rawPatch.riskReasons = [...(Array.isArray(rawPatch.riskReasons) ? rawPatch.riskReasons : []), '新增数字、日期或金额缺少同条目明确证据']
    }
    if (kind === 'skill_item' && (rawPatch.operation === 'add' || rawPatch.operation === 'replace')) {
      const revisedSkill = asString(rawPatch.revisedValue).toLocaleLowerCase()
      const supported = evidenceItems.some((item) => item.strength === 'strong' && asString(item.quote).toLocaleLowerCase().includes(revisedSkill))
      if (!revisedSkill || !supported) {
        rawPatch.risk = 'high'
        rawPatch.riskReasons = [...(Array.isArray(rawPatch.riskReasons) ? rawPatch.riskReasons : []), '新增或替换的技能缺少明确原文证据']
      }
    }
    if (rawPatch.risk === 'low' && evidenceItems.some((item) => item.itemId && item.itemId !== target.itemId)) {
      rawPatch.risk = 'medium'
      rawPatch.riskReasons = [...(Array.isArray(rawPatch.riskReasons) ? rawPatch.riskReasons : []), '使用了跨条目证据']
    }
    rawPatch.anchorStatus = errors.length ? rawPatch.anchorStatus || 'invalid' : 'valid'
  }
  proposal.schemaVersion = 1
  proposal.patches = patches
  proposal.missingEvidence = Array.isArray(proposal.missingEvidence) ? proposal.missingEvidence : []
  proposal.validation = { passed: errors.length === 0, warnings: Array.isArray(isRecord(proposal.validation) ? proposal.validation.warnings : null) ? (proposal.validation as JsonRecord).warnings : [] }
  return { proposal, errors }
}

function salvageValidProposal(proposal: JsonRecord, data: JsonRecord): {
  proposal: JsonRecord | null
  errors: string[]
  flaggedPatchCount: number
  flaggedPatchKeys: string[]
} {
  const sourcePatches = Array.isArray(proposal.patches) ? proposal.patches.filter(isRecord) : []
  const sourceEvidence = Array.isArray(proposal.evidence) ? proposal.evidence.filter(isRecord) : []
  let acceptedPatches: JsonRecord[] = []
  const flaggedByKey = new Map<string, JsonRecord>()
  const flagged: Array<{ key: string; errors: string[] }> = []

  for (const patch of sourcePatches) {
    const candidatePatches = [...acceptedPatches, structuredClone(patch)]
    const evidenceKeys = new Set(candidatePatches.flatMap((item) => (
      Array.isArray(item.evidenceKeys) ? item.evidenceKeys.map(asString) : []
    )))
    const candidate = structuredClone(proposal)
    candidate.patches = candidatePatches
    candidate.evidence = sourceEvidence.filter((item) => evidenceKeys.has(asString(item.key)))
    candidate.missingEvidence = Array.isArray(candidate.missingEvidence) ? candidate.missingEvidence : []
    const validated = validateProposal(candidate, data)
    if (validated.proposal && validated.errors.length === 0) {
      acceptedPatches = Array.isArray(validated.proposal.patches)
        ? validated.proposal.patches.filter(isRecord)
        : acceptedPatches
    } else {
      const key = asString(patch.key) || `patch-${flagged.length + 1}`
      const reasons = validated.errors.length ? validated.errors : [`${key} 未通过自动应用校验`]
      flagged.push({ key, errors: reasons })
      flaggedByKey.set(key, markResumeAgentPatchReviewOnly(structuredClone(patch), reasons))
    }
  }

  const acceptedByKey = new Map(acceptedPatches.map((patch) => [asString(patch.key), patch]))
  const retainedPatches = sourcePatches.map((patch, index) => {
    const key = asString(patch.key) || `patch-${index + 1}`
    return acceptedByKey.get(key) || flaggedByKey.get(key) || markResumeAgentPatchReviewOnly(structuredClone(patch), [`${key} 未通过自动应用校验`])
  })
  const verifiedEvidence = sourceEvidence.filter((item) => {
    const key = asString(item.key)
    const quote = asString(item.quote).trim()
    const source = getEvidenceSourceText(data, item)
    return Boolean(key && quote && source !== null && source.includes(quote))
  })
  const salvaged = structuredClone(proposal)
  salvaged.patches = retainedPatches
  salvaged.evidence = verifiedEvidence
  salvaged.missingEvidence = [
    ...(Array.isArray(salvaged.missingEvidence) ? salvaged.missingEvidence : []),
    ...flagged.map((item) => ({
      requirementId: item.key,
      message: `${item.key} 未通过自动应用校验，已标记为高风险，仅供参考：${item.errors.slice(0, 2).join('；')}`,
    })),
  ]
  const warnings = Array.isArray(isRecord(salvaged.validation) ? salvaged.validation.warnings : null)
    ? (salvaged.validation as JsonRecord).warnings as unknown[]
    : []
  salvaged.validation = {
    passed: false,
    warnings: [...warnings.map(asString), ...(flagged.length ? [`已将 ${flagged.length} 个未通过自动应用校验的修改项标记为高风险，仅供参考`] : [])],
  }
  const envelopeErrors = validateResumeAgentProposalEnvelope(salvaged)
  return {
    proposal: envelopeErrors.length ? null : salvaged,
    errors: envelopeErrors,
    flaggedPatchCount: flagged.length,
    flaggedPatchKeys: flagged.map((item) => item.key),
  }
}

async function persistHistory(context: RequestContext, result: JsonRecord, status: 'success' | 'failed', errorMessage: string | null) {
  const { data, error } = await context.admin.from('jd_analysis_records').insert({
    user_id: context.userId,
    resume_id: context.resume.id,
    application_id: context.applicationId,
    title: `${context.company || '手工 JD'} · ${context.position || '岗位专属方案'}`,
    jd_text_snapshot: context.jdText,
    jd_hash: context.jdHash,
    resume_text_snapshot: context.resumeText,
    resume_hash: context.resumeHash,
    resume_title_snapshot: asString(context.resume.title),
    company_snapshot: context.company,
    position_snapshot: context.position,
    analysis_result: result,
    status,
    error_message: errorMessage,
    model: MODEL,
    prompt_version: PROMPT_VERSION,
    analyzed_at: new Date().toISOString(),
  }).select('id').single()
  return { id: data?.id || null, persisted: !error }
}

function createStream(context: RequestContext, req: Request): Response {
  const encoder = new TextEncoder()
  const startedAt = Date.now()
  const deadline = new AbortController()
  const abort = () => deadline.abort()
  req.signal.addEventListener('abort', abort, { once: true })
  const deadlineTimer = setTimeout(abort, RESUME_AGENT_LIMITS.deadlineMs)
  let heartbeat: number | undefined
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: JsonRecord) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      heartbeat = setInterval(() => send({ type: 'heartbeat', elapsedMs: Date.now() - startedAt }), 10_000) as unknown as number
      ;(async () => {
        let modelCalls = 0
        let toolCalls = 0
        let completionTokens = 0
        let revisionCount = 0
        const runId = asString(context.request.runId)
        try {
          logResumeAgentDiagnostic(runId, 'run_started', {
            resumeTextLength: context.resumeText.length,
            jdTextLength: context.jdText.length,
            goalLength: asString(context.request.goal).length,
          })
          send({ type: 'run_started', runId, at: new Date().toISOString() })
          send({ type: 'stage', stage: 'understand_job', status: 'running', summary: '正在整理目标岗位要求与任务约束' })
          const system = `你是简历优化编排器。只基于给定事实生成可审核方案；不得修改基本信息、教育、公司、职位、日期，不得增删整段经历。无证据要求必须放入 missingEvidence。高风险修改不得建议应用。输出必须通过指定工具，不输出推理过程。`
          const goal = asString(context.request.goal).slice(0, 500)
          const constraints = isRecord(context.request.constraints) ? context.request.constraints : {}
          modelCalls += 1
          const planCall = await callModel([
            { role: 'system', content: system },
            { role: 'user', content: `任务目标：${goal}\n约束：${JSON.stringify(constraints)}\n职位描述：\n${context.jdText}\n\n基础简历（含稳定条目标识）：\n${context.resumeText}\n\n请制定计划并提交检索条件。` },
          ], tools, 'search_resume_evidence', deadline.signal)
          completionTokens += planCall.completionTokens
          toolCalls += 1
          assertResumeAgentBudget({ elapsedMs: Date.now() - startedAt, modelCalls, toolCalls, revisionCount, completionTokens })
          if (!isRecord(planCall.args) || !isRecord(planCall.args.plan) || !Array.isArray(planCall.args.queries)) throw new Error('计划工具参数格式无效')
          const queryTermCount = planCall.args.queries.reduce((count, query) => (
            count + (isRecord(query) && Array.isArray(query.terms) ? query.terms.length : 0)
          ), 0)
          logResumeAgentDiagnostic(runId, 'plan_received', {
            planKeys: Object.keys(planCall.args.plan).sort(),
            queryCount: planCall.args.queries.length,
            queryTermCount,
            completionTokens: planCall.completionTokens,
            finishReason: planCall.finishReason,
            responseToolCallCount: planCall.responseToolCallCount,
            toolArgumentLength: planCall.toolArgumentLength,
          })
          send({ type: 'stage', stage: 'understand_job', status: 'completed', summary: '已整理岗位要求和任务边界' })
          send({ type: 'plan', plan: planCall.args.plan })
          send({ type: 'stage', stage: 'read_evidence', status: 'running', summary: '正在从可修改范围内检索明确证据' })
          send({ type: 'tool_started', id: 'tool-evidence', name: 'search_resume_evidence', summary: '检索简历证据' })
          const evidence = findEvidence(context.resumeData, planCall.args.queries)
          logResumeAgentDiagnostic(runId, 'evidence_collected', {
            evidenceCount: evidence.length,
            strongEvidenceCount: evidence.filter((item) => item.strength === 'strong').length,
            mediumEvidenceCount: evidence.filter((item) => item.strength === 'medium').length,
            sectionCounts: evidence.reduce((counts: Record<string, number>, item) => {
              const section = asString(item.section) || 'unknown'
              counts[section] = (counts[section] || 0) + 1
              return counts
            }, {}),
          })
          send({ type: 'tool_completed', id: 'tool-evidence', name: 'search_resume_evidence', summary: `找到 ${evidence.length} 条候选证据`, durationMs: 0 })
          send({ type: 'stage', stage: 'read_evidence', status: 'completed', summary: `已整理 ${evidence.length} 条候选证据` })
          send({ type: 'stage', stage: 'plan_changes', status: 'running', summary: '正在限定修改范围与风险等级' })

          let proposal: JsonRecord | null = null
          let validationErrors: string[] = []
          for (let attempt = 0; attempt < 2; attempt += 1) {
            assertResumeAgentBudget({ elapsedMs: Date.now() - startedAt, modelCalls, toolCalls, revisionCount, completionTokens })
            modelCalls += 1
            const prompt = attempt === 0
              ? `计划：${JSON.stringify(planCall.args.plan)}\n证据：${JSON.stringify(evidence)}\n基础简历：${context.resumeText}\n职位描述：${context.jdText}\n提交完整 Proposal。顶层字段必须使用 schemaVersion、goalSummary、targetRequirements、evidence、sectionAnalyses、patches、missingEvidence、validation；禁止使用 objective、keyFocus、modifications、constraints 等自定义替代字段。所有实际修改必须放入 patches，最多 ${MAX_PATCHES} 条。正文修改 originalText 必须在对应条目纯文本中唯一存在；技能修改必须携带基础数组 hash。若确无安全修改，patches 必须为空数组且 missingEvidence 至少说明一项原因。`
              : `上一版 Proposal 校验失败：${validationErrors.join('；')}\n请在不引入新事实的前提下进行唯一一次修订。必须返回完整 canonical Proposal。rich_text_replace 的 originalText 必须从对应条目正文逐字复制一个仅出现一次的 8-60 字短片段，不得改写、概括或包含公司/职位/日期；revisedText 只做局部改写。skill_item 的 originalValue 必须等于技能数组中的单个完整元素；新增不存在的技能必须使用 add，且 expectedArrayHash 必须复制对应证据中的值。无法安全修复的 patch 应删除，并在 missingEvidence 中说明。\n候选证据：${JSON.stringify(evidence)}\n基础简历：${context.resumeText}\n上一版 Proposal：${JSON.stringify(proposal)}`
            const proposalCall = await callModel([{ role: 'system', content: system }, { role: 'user', content: prompt }], tools, 'validate_resume_proposal', deadline.signal)
            completionTokens += proposalCall.completionTokens
            toolCalls += 1
            assertResumeAgentBudget({ elapsedMs: Date.now() - startedAt, modelCalls, toolCalls, revisionCount, completionTokens })
            if (!isRecord(proposalCall.args) || !isRecord(proposalCall.args.proposal)) throw new Error('Proposal 工具参数格式无效')
            const rawProposalDiagnostics = summarizeResumeAgentProposal(proposalCall.args.proposal)
            logResumeAgentDiagnostic(runId, 'proposal_received', {
              attempt: attempt + 1,
              ...rawProposalDiagnostics,
              completionTokens: proposalCall.completionTokens,
              finishReason: proposalCall.finishReason,
              responseToolCallCount: proposalCall.responseToolCallCount,
              toolArgumentLength: proposalCall.toolArgumentLength,
            })
            send({ type: 'stage', stage: 'generate_patches', status: 'completed', summary: '已生成候选修改建议' })
            send({ type: 'stage', stage: 'validate_proposal', status: 'running', summary: '正在检查锚点、冲突、事实与风险' })
            send({ type: 'tool_started', id: `tool-anchor-${attempt}`, name: 'validate_patch_anchor', summary: '校验所有修改目标' })
            toolCalls += 1
            assertResumeAgentBudget({ elapsedMs: Date.now() - startedAt, modelCalls, toolCalls, revisionCount, completionTokens })
            const validated = validateProposal(proposalCall.args.proposal, context.resumeData)
            proposal = validated.proposal
            validationErrors = validated.errors
            logResumeAgentDiagnostic(runId, 'proposal_validated', {
              attempt: attempt + 1,
              ...summarizeResumeAgentProposal(proposal, validationErrors),
              validationErrors: validationErrors.slice(0, 10),
            })
            send({ type: 'tool_completed', id: `tool-anchor-${attempt}`, name: 'validate_patch_anchor', summary: validationErrors.length ? `发现 ${validationErrors.length} 个可修复问题` : '所有修改目标有效', durationMs: 0 })
            if (!validationErrors.length) break
            if (attempt === 0) revisionCount = 1
          }
          if (!proposal) throw new Error(`最终方案校验失败：${validationErrors.join('；')}`)
          if (validationErrors.length) {
            const salvaged = salvageValidProposal(proposal, context.resumeData)
            logResumeAgentDiagnostic(runId, 'proposal_salvaged', {
              flaggedPatchCount: salvaged.flaggedPatchCount,
              flaggedPatchKeys: salvaged.flaggedPatchKeys,
              retainedPatchCount: Array.isArray(salvaged.proposal?.patches) ? salvaged.proposal.patches.length : 0,
              remainingErrorCount: salvaged.errors.length,
            })
            proposal = salvaged.proposal
            validationErrors = salvaged.errors
          }
          if (!proposal || validationErrors.length) throw new Error(`最终方案校验失败：${validationErrors.join('；')}`)
          const patches = Array.isArray(proposal.patches) ? proposal.patches : []
          const missingEvidence = Array.isArray(proposal.missingEvidence) ? proposal.missingEvidence : []
          const completionStatus = patches.length === 0 ? 'no_changes' : missingEvidence.length ? 'partial' : 'success'
          proposal.runSummary = { toolCallCount: toolCalls, modelCallCount: modelCalls, revisionCount, durationMs: Date.now() - startedAt, completionTokens }
          logResumeAgentDiagnostic(runId, 'run_completed', {
            completionStatus,
            ...summarizeResumeAgentProposal(proposal),
            durationMs: Date.now() - startedAt,
            modelCalls,
            toolCalls,
            revisionCount,
            completionTokens,
          })
          const historyResult = { kind: 'resume-agent', schemaVersion: 1, runId, completionStatus, plan: planCall.args.plan, proposal, source: { resumeHash: context.resumeHash, jdHash: context.jdHash, company: context.company, position: context.position }, runSummary: proposal.runSummary }
          const history = await persistHistory(context, historyResult, 'success', null)
          if (!history.persisted) send({ type: 'warning', code: 'HISTORY_NOT_PERSISTED', message: '当前结果可继续审核，但刷新后可能无法恢复', retryable: true })
          send({ type: 'stage', stage: 'validate_proposal', status: 'completed', summary: '方案已通过确定性校验' })
          send({ type: 'proposal', completionStatus, proposal, recordId: history.id, historyPersisted: history.persisted })
          send({ type: 'done', runId })
        } catch (error) {
          const timedOut = deadline.signal.aborted && !req.signal.aborted
          const budgetCode = error instanceof Error && ['DEADLINE_EXCEEDED', 'MODEL_CALL_LIMIT', 'TOOL_CALL_LIMIT', 'REVISION_LIMIT', 'COMPLETION_TOKEN_LIMIT'].includes(error.message)
            ? error.message
            : null
          const code = req.signal.aborted ? 'CLIENT_DISCONNECTED' : timedOut ? 'DEADLINE_EXCEEDED' : budgetCode || 'AGENT_FAILED'
          const message = code === 'DEADLINE_EXCEEDED' ? '任务达到 120 秒截止时间' : budgetCode ? '任务达到安全执行上限' : error instanceof Error ? error.message : 'Agent 任务失败'
          logResumeAgentDiagnostic(runId, 'run_failed', {
            code,
            message,
            durationMs: Date.now() - startedAt,
            modelCalls,
            toolCalls,
            revisionCount,
            completionTokens,
          })
          if (!req.signal.aborted) {
            send({ type: 'error', code, message, retryable: code !== 'CLIENT_DISCONNECTED' })
            const historyResult = { kind: 'resume-agent', schemaVersion: 1, runId: asString(context.request.runId), completionStatus: 'failed', plan: null, proposal: null, source: { resumeHash: context.resumeHash, jdHash: context.jdHash, company: context.company, position: context.position }, error: { code, message }, runSummary: { toolCallCount: toolCalls, modelCallCount: modelCalls, revisionCount, durationMs: Date.now() - startedAt, completionTokens } }
            await persistHistory(context, historyResult, 'failed', message).catch(() => undefined)
            send({ type: 'done', runId: asString(context.request.runId) })
          }
        } finally {
          if (heartbeat) clearInterval(heartbeat)
          clearTimeout(deadlineTimer)
          req.signal.removeEventListener('abort', abort)
          controller.close()
        }
      })()
    },
    cancel() { abort() },
  })
  return new Response(stream, { headers: { ...corsHeaders, 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}

async function persistExistingProposal(context: RequestContext): Promise<Response> {
  const validated = validateProposal(context.request.proposal, context.resumeData)
  if (!validated.proposal || validated.errors.length) {
    throw new HttpError(400, 'PROPOSAL_INVALID', `Proposal 重新校验失败：${validated.errors.join('；')}`)
  }
  const proposal = validated.proposal
  const patches = Array.isArray(proposal.patches) ? proposal.patches : []
  const missingEvidence = Array.isArray(proposal.missingEvidence) ? proposal.missingEvidence : []
  const completionStatus = patches.length === 0 ? 'no_changes' : missingEvidence.length ? 'partial' : 'success'
  const runId = asString(context.request.runId)
  const historyResult = { kind: 'resume-agent', schemaVersion: 1, runId, completionStatus, plan: null, proposal, source: { resumeHash: context.resumeHash, jdHash: context.jdHash, company: context.company, position: context.position }, runSummary: isRecord(proposal.runSummary) ? proposal.runSummary : null }
  const history = await persistHistory(context, historyResult, 'success', null)
  if (!history.persisted) throw new HttpError(503, 'HISTORY_WRITE_FAILED', '历史记录仍未保存，请稍后重试')
  const body = [
    { type: 'proposal', completionStatus, proposal, recordId: history.id, historyPersisted: true },
    { type: 'done', runId },
  ].map((event) => JSON.stringify(event)).join('\n') + '\n'
  return new Response(body, { headers: { ...corsHeaders, 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
  try {
    const context = await preflight(req)
    if (context.request.action === 'persist_result') return await persistExistingProposal(context)
    return createStream(context, req)
  } catch (error) {
    if (error instanceof HttpError) return jsonResponse({ code: error.code, error: error.message }, error.status)
    return jsonResponse({ code: 'INVALID_REQUEST', error: error instanceof Error ? error.message : '请求处理失败' }, 400)
  }
})

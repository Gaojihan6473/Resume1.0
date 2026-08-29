import { supabase } from './supabase'
import type { ResumeAgentRequest, ResumeAgentStreamEvent } from '../types/resumeAgent'

const EDGE_FUNCTIONS_URL = import.meta.env.VITE_EDGE_FUNCTIONS_URL as string

export const RESUME_AGENT_ENABLED = import.meta.env.VITE_RESUME_AGENT_ENABLED === 'true'

function getErrorMessage(value: unknown): string {
  if (value && typeof value === 'object' && 'error' in value && typeof value.error === 'string') {
    return value.error
  }
  return 'Agent 服务暂时不可用'
}

async function parseErrorResponse(response: Response): Promise<string> {
  const text = await response.text().catch(() => '')
  if (!text.trim()) return `Agent 服务返回 ${response.status}`
  try {
    return getErrorMessage(JSON.parse(text))
  } catch {
    return text.replace(/\s+/g, ' ').slice(0, 300)
  }
}

export async function streamResumeAgent(
  request: ResumeAgentRequest,
  onEvent: (event: ResumeAgentStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  if (!RESUME_AGENT_ENABLED) throw new Error('Agent 定岗功能尚未开放')
  if (!EDGE_FUNCTIONS_URL) throw new Error('Agent 服务地址未配置')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('请先登录后使用 Agent 定岗')

  const send = (token: string) => fetch(`${EDGE_FUNCTIONS_URL}/resume-agent`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/x-ndjson',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  })

  let response = await send(session.access_token)
  if (response.status === 401 && !signal?.aborted) {
    const { data: { session: refreshed }, error } = await supabase.auth.refreshSession()
    if (!error && refreshed?.access_token) response = await send(refreshed.access_token)
  }
  if (!response.ok) throw new Error(await parseErrorResponse(response))
  if (!response.body) throw new Error('Agent 服务未返回可读取的数据流')

  await readResumeAgentStream(response.body, onEvent)
}

export async function readResumeAgentStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: ResumeAgentStreamEvent) => void
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let sawDone = false

  const consumeLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return
    let parsed: ResumeAgentStreamEvent
    try {
      parsed = JSON.parse(trimmed) as ResumeAgentStreamEvent
    } catch {
      throw new Error('Agent 返回了无法解析的流事件')
    }
    onEvent(parsed)
    if (parsed.type === 'error') throw new Error(parsed.message)
    if (parsed.type === 'done') sawDone = true
  }

  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    lines.forEach(consumeLine)
    if (done) break
  }
  if (buffer.trim()) consumeLine(buffer)
  if (!sawDone) throw new Error('Agent 连接提前结束，可安全重试')
}

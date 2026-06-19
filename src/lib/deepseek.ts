import { supabase } from './supabase'

const EDGE_FUNCTIONS_URL = import.meta.env.VITE_EDGE_FUNCTIONS_URL as string

export interface DeepSeekChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface DeepSeekChatRequest {
  model: 'deepseek-v4-flash'
  max_tokens?: number
  temperature?: number
  messages: DeepSeekChatMessage[]
  response_format?: Record<string, unknown>
}

function extractErrorMessage(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''

  try {
    const parsed = JSON.parse(trimmed)
    if (typeof parsed?.error === 'string') return parsed.error
    if (typeof parsed?.error?.message === 'string') return parsed.error.message
    if (typeof parsed?.message === 'string') return parsed.message
  } catch {
    // Fall through to plain text.
  }

  return trimmed.replace(/\s+/g, ' ').slice(0, 300)
}

export async function requestDeepSeekChat(
  payload: DeepSeekChatRequest,
  signal?: AbortSignal
): Promise<unknown> {
  if (!EDGE_FUNCTIONS_URL) {
    throw new Error('AI service endpoint is not configured.')
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Please sign in before using AI features.')
  }

  const response = await fetch(`${EDGE_FUNCTIONS_URL}/deepseek-chat`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const detail = extractErrorMessage(await response.text().catch(() => ''))
    throw new Error(`DeepSeek proxy error ${response.status}${detail ? `: ${detail}` : ''}`)
  }

  return response.json()
}

export function getDeepSeekContent(result: unknown): string {
  if (
    typeof result === 'object' &&
    result !== null &&
    'choices' in result &&
    Array.isArray((result as { choices?: unknown }).choices)
  ) {
    const choice = (result as { choices: Array<{ message?: { content?: unknown } }> }).choices[0]
    const content = choice?.message?.content
    if (typeof content === 'string') return content
  }

  throw new Error('DeepSeek returned empty or invalid content.')
}

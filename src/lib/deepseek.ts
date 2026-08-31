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
  thinking?: { type: 'enabled' | 'disabled' }
  messages: DeepSeekChatMessage[]
  response_format?: Record<string, unknown>
}

export interface DeepSeekCompletion {
  content: string
  finishReason: string | null
  completionTokens: number | null
  reasoningTokens: number | null
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

  const requestBody = JSON.stringify(payload)
  const sendRequest = (accessToken: string) => fetch(`${EDGE_FUNCTIONS_URL}/deepseek-chat`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: requestBody,
  })

  let response = await sendRequest(session.access_token)

  if (response.status === 401 && !signal?.aborted) {
    console.warn('[DeepSeek] Session was rejected; refreshing and retrying once.')
    const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
    if (!refreshError && refreshedSession?.access_token) {
      response = await sendRequest(refreshedSession.access_token)
    }
  }

  if (!response.ok) {
    const detail = extractErrorMessage(await response.text().catch(() => ''))
    throw new Error(`DeepSeek proxy error ${response.status}${detail ? `: ${detail}` : ''}`)
  }

  return response.json()
}

export function getDeepSeekCompletion(result: unknown): DeepSeekCompletion {
  if (
    typeof result === 'object' &&
    result !== null &&
    'choices' in result &&
    Array.isArray((result as { choices?: unknown }).choices)
  ) {
    const choice = (result as {
      choices: Array<{
        finish_reason?: unknown
        message?: { content?: unknown }
      }>
    }).choices[0]
    const content = choice?.message?.content
    const finishReason = typeof choice?.finish_reason === 'string' ? choice.finish_reason : null
    const usage = 'usage' in result && typeof result.usage === 'object' && result.usage !== null
      ? result.usage as {
          completion_tokens?: unknown
          completion_tokens_details?: { reasoning_tokens?: unknown }
        }
      : null
    const completionTokens = typeof usage?.completion_tokens === 'number'
      ? usage.completion_tokens
      : null
    const reasoningTokens = typeof usage?.completion_tokens_details?.reasoning_tokens === 'number'
      ? usage.completion_tokens_details.reasoning_tokens
      : null

    if (typeof content === 'string') {
      return {
        content,
        finishReason,
        completionTokens,
        reasoningTokens,
      }
    }
  }

  throw new Error('DeepSeek returned empty or invalid content.')
}

export function getDeepSeekContent(result: unknown): string {
  return getDeepSeekCompletion(result).content
}

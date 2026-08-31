import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_MINIMAX_URL = 'https://api.minimaxi.com/v1/chat/completions'
const ALLOWED_MODELS = new Set(['MiniMax-M2.5', 'MiniMax-M2.7', 'MiniMax-M3'])
const MAX_MESSAGES = 8
const MAX_TOTAL_CONTENT_LENGTH = 80_000
const MAX_TOKENS_LIMIT = 8_000

type ChatRole = 'system' | 'user' | 'assistant'

interface ChatMessage {
  role: ChatRole
  content: string
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(value, max))
}

function normalizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) {
    throw new Error('Invalid messages payload.')
  }

  const messages = value.map((item) => {
    if (!isRecord(item)) throw new Error('Invalid message item.')
    const role = item.role
    const content = item.content
    if (role !== 'system' && role !== 'user' && role !== 'assistant') {
      throw new Error('Invalid message role.')
    }
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('Invalid message content.')
    }
    return { role, content }
  })

  const totalLength = messages.reduce((sum, message) => sum + message.content.length, 0)
  if (totalLength > MAX_TOTAL_CONTENT_LENGTH) {
    throw new Error('Messages are too long.')
  }

  return messages
}

function normalizePayload(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) {
    throw new Error('Invalid request body.')
  }

  const model = raw.model
  if (typeof model !== 'string' || !ALLOWED_MODELS.has(model)) {
    throw new Error('Unsupported model.')
  }

  const payload: Record<string, unknown> = {
    model,
    messages: normalizeMessages(raw.messages),
    max_tokens: clampNumber(raw.max_tokens, 4_000, 1, MAX_TOKENS_LIMIT),
    temperature: clampNumber(raw.temperature, 0, 0, 1),
  }

  if (isRecord(raw.thinking)) payload.thinking = raw.thinking
  if (isRecord(raw.response_format)) payload.response_format = raw.response_format

  return payload
}

async function getAuthenticatedUser(req: Request): Promise<Response | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authHeader = req.headers.get('Authorization')

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return jsonResponse({ error: 'Supabase environment variables are missing.' }, 500)
  }
  if (!authHeader) {
    return jsonResponse({ error: 'Missing authorization header.' }, 401)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return jsonResponse({ error: 'Invalid or expired session.' }, 401)
  }

  const admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: validKey, error: keyError } = await admin
    .from('valid_keys')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (keyError || !validKey) {
    return jsonResponse({ error: 'Session is no longer active.' }, 401)
  }

  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  try {
    const authError = await getAuthenticatedUser(req)
    if (authError) return authError

    const minimaxApiKey = Deno.env.get('MINIMAX_API_KEY')
    if (!minimaxApiKey) {
      return jsonResponse({ error: 'MiniMax API key is not configured.' }, 500)
    }

    const payload = normalizePayload(await req.json())
    const minimaxUrl = Deno.env.get('MINIMAX_API_URL') || DEFAULT_MINIMAX_URL
    const upstream = await fetch(minimaxUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${minimaxApiKey}`,
      },
      body: JSON.stringify(payload),
    })

    const contentType = upstream.headers.get('Content-Type') || 'application/json'
    const body = await upstream.text()

    return new Response(body, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
      },
    })
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'MiniMax proxy request failed.' },
      400
    )
  }
})

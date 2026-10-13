import { normalizePayload, readPayload } from './payload.ts'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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

    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY')
    if (!deepseekApiKey) {
      return jsonResponse({ error: 'DeepSeek API key is not configured.' }, 500)
    }

    const payload = normalizePayload(await readPayload(req))
    const deepseekUrl = Deno.env.get('DEEPSEEK_API_URL') || DEFAULT_DEEPSEEK_URL
    const upstreamStartedAt = Date.now()
    console.info('[deepseek-chat] upstream request', {
      model: payload.model,
      maxTokens: payload.max_tokens,
      thinking: isRecord(payload.thinking) ? payload.thinking.type : null,
      responseFormat: isRecord(payload.response_format) ? payload.response_format.type : null,
    })
    const upstream = await fetch(deepseekUrl, {
      method: 'POST',
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(90_000)]),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deepseekApiKey}`,
      },
      body: JSON.stringify(payload),
    })

    const contentType = upstream.headers.get('Content-Type') || 'application/json'
    const body = await upstream.text()

    try {
      const completion = JSON.parse(body)
      const choice = Array.isArray(completion?.choices) ? completion.choices[0] : null
      const content = typeof choice?.message?.content === 'string' ? choice.message.content : ''
      console.info('[deepseek-chat] upstream completion', {
        status: upstream.status,
        durationMs: Date.now() - upstreamStartedAt,
        finishReason: choice?.finish_reason || null,
        contentLength: content.length,
        completionTokens: completion?.usage?.completion_tokens ?? null,
        reasoningTokens: completion?.usage?.completion_tokens_details?.reasoning_tokens ?? null,
      })
    } catch {
      console.warn('[deepseek-chat] upstream returned a non-JSON response', {
        status: upstream.status,
        durationMs: Date.now() - upstreamStartedAt,
        contentType,
        bodyLength: body.length,
      })
    }

    return new Response(body, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
      },
    })
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'DeepSeek proxy request failed.' },
      400
    )
  }
})

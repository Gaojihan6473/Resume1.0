import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || ''
  const configuredOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const allowOrigin = configuredOrigins.length === 0
    ? '*'
    : configuredOrigins.includes(origin)
      ? origin
      : configuredOrigins[0]

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin',
  }
}

function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  return token || null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) })
  }

  if (req.method !== 'GET') {
    return jsonResponse(req, { authenticated: false, error: '不支持的请求方法' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const token = getBearerToken(req)

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse(req, { authenticated: false, error: '环境变量缺失' }, 500)
    }

    if (!token) {
      return jsonResponse(req, { authenticated: false }, 401)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return jsonResponse(req, { authenticated: false }, 401)
    }

    const { data: validKey, error: keyError } = await supabase
      .from('valid_keys')
      .select('key_name')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('last_used_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (keyError || !validKey) {
      return jsonResponse(req, { authenticated: false, error: '登录密钥已失效' }, 401)
    }

    return jsonResponse(req, {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        keyName: validKey.key_name,
      },
    })
  } catch {
    return jsonResponse(req, { authenticated: false, error: '服务暂时不可用' }, 503)
  }
})

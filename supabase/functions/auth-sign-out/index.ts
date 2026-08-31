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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  if (req.method !== 'POST') {
    return jsonResponse(req, { success: false, error: '不支持的请求方法' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const token = getBearerToken(req)

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse(req, { success: false, error: '环境变量缺失' }, 500)
    }

    if (!token) {
      return jsonResponse(req, { success: false, error: '未提供授权信息' }, 401)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error } = await supabase.auth.admin.signOut(token, 'global')

    if (error) {
      return jsonResponse(req, { success: false, error: '登出失败' }, 500)
    }

    return jsonResponse(req, { success: true })
  } catch {
    return jsonResponse(req, { success: false, error: '服务暂时不可用，请稍后重试' }, 503)
  }
})

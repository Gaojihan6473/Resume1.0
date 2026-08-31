import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface SignInRequest {
  key: string
}

interface FailedLogin {
  count: number
  resetAt: number
  blockedUntil: number
}

const MAX_FAILED_ATTEMPTS = 5
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const BLOCK_MS = 10 * 60 * 1000
const failedLogins = new Map<string, FailedLogin>()

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

function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || req.headers.get('cf-connecting-ip') || 'unknown'
}

function getRateLimitKey(req: Request): string {
  return `ip:${getClientIp(req)}`
}

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const entry = failedLogins.get(key)
  if (!entry) return false

  if (entry.blockedUntil > now) return true
  if (entry.resetAt <= now) {
    failedLogins.delete(key)
    return false
  }

  return false
}

function registerFailedLogin(key: string) {
  const now = Date.now()
  const entry = failedLogins.get(key)
  const nextEntry: FailedLogin = entry && entry.resetAt > now
    ? entry
    : { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS, blockedUntil: 0 }

  nextEntry.count += 1
  if (nextEntry.count >= MAX_FAILED_ATTEMPTS) {
    nextEntry.blockedUntil = now + BLOCK_MS
  }

  failedLogins.set(key, nextEntry)
}

function clearFailedLogin(key: string) {
  failedLogins.delete(key)
}

async function sha256Hex(value: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) })
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, { success: false, error: '不支持的请求方法' }, 405)
  }

  const rateLimitKey = getRateLimitKey(req)
  if (isRateLimited(rateLimitKey)) {
    return jsonResponse(req, { success: false, error: '尝试次数过多，请稍后再试' }, 429)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return jsonResponse(req, { success: false, error: '环境变量缺失' }, 500)
    }

    const { key }: SignInRequest = await req.json()

    if (!key || typeof key !== 'string' || !key.startsWith('sk-')) {
      registerFailedLogin(rateLimitKey)
      return jsonResponse(req, { success: false, error: '密钥格式不正确' }, 400)
    }

    const keyHash = await sha256Hex(key)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: validKey, error: keyError } = await adminClient
      .from('valid_keys')
      .select('id, user_id, key_name')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single()

    if (keyError || !validKey) {
      registerFailedLogin(rateLimitKey)
      return jsonResponse(req, { success: false, error: '密钥无效，请检查后重试' }, 401)
    }

    const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(validKey.user_id)
    const email = userData.user?.email

    if (userError || !userData.user || !email) {
      registerFailedLogin(rateLimitKey)
      return jsonResponse(req, { success: false, error: '用户不存在' }, 401)
    }

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    const tokenHash = linkData?.properties?.hashed_token

    if (linkError || !tokenHash) {
      console.error('Generate magic link error:', linkError)
      return jsonResponse(req, { success: false, error: '登录失败，请稍后重试' }, 503)
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: sessionData, error: verifyError } = await authClient.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    })

    if (verifyError || !sessionData.session) {
      console.error('Verify magic link error:', verifyError)
      return jsonResponse(req, { success: false, error: '登录失败，请稍后重试' }, 503)
    }

    await adminClient
      .from('valid_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', validKey.id)

    clearFailedLogin(rateLimitKey)

    return jsonResponse(req, {
      success: true,
      user: {
        id: userData.user.id,
        email,
        keyName: validKey.key_name,
      },
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
      },
    })
  } catch (error) {
    console.error('Unexpected auth-sign-in error:', error)
    registerFailedLogin(rateLimitKey)
    return jsonResponse(req, { success: false, error: '服务暂时不可用，请稍后重试' }, 503)
  }
})

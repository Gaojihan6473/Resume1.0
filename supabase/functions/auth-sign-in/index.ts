import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SignInRequest {
  key: string
}

// Hardcoded test credentials - in production, you would look this up from the key record
const TEST_USER_PASSWORD = 'testpassword123'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: '环境变量缺失' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { key }: SignInRequest = await req.json()

    if (!key || typeof key !== 'string' || !key.startsWith('sk-')) {
      return new Response(
        JSON.stringify({ success: false, error: '密钥格式不正确' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Hash the key
    const keyBytes = new TextEncoder().encode(key)
    const hashBuffer = await crypto.subtle.digest('SHA-256', keyBytes)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find the valid key
    const { data: validKey, error: keyError } = await supabase
      .from('valid_keys')
      .select('user_id, key_name')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single()

    if (keyError || !validKey) {
      return new Response(
        JSON.stringify({ success: false, error: '密钥无效，请检查后重试' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user info
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(validKey.user_id)

    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ success: false, error: '用户不存在' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use the password grant flow to sign in
    const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
      email: userData.user.email!,
      password: TEST_USER_PASSWORD,
    })

    if (signInError || !sessionData.session) {
      console.error('Sign in error:', signInError)
      return new Response(
        JSON.stringify({ success: false, error: '登录失败: ' + (signInError?.message || 'unknown') }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userData.user.id,
          email: userData.user.email,
          keyName: validKey.key_name,
        },
        session: {
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ success: false, error: '服务暂时不可用，请稍后重试' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

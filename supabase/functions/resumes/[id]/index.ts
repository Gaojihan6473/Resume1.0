import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Create client with anon key to use RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization')!,
        },
      },
    })

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: '未登录或会话已过期' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract resume ID from the URL path
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const resumeIdIndex = pathParts.indexOf('resumes') + 1
    const resumeId = pathParts[resumeIdIndex]

    if (!resumeId) {
      return new Response(
        JSON.stringify({ success: false, error: '缺少简历ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'GET') {
      // Get a single resume
      const { data: resume, error: getError } = await supabase
        .from('resumes')
        .select('*')
        .eq('id', resumeId)
        .eq('user_id', user.id)
        .single()

      if (getError || !resume) {
        return new Response(
          JSON.stringify({ success: false, error: '简历不存在' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, resume }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (req.method === 'PUT') {
      // Update a resume
      const body = await req.json()
      const { title, content } = body

      const { data: resume, error: updateError } = await supabase
        .from('resumes')
        .update({
          title,
          content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resumeId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (updateError || !resume) {
        return new Response(
          JSON.stringify({ success: false, error: '更新简历失败' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, resume }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (req.method === 'DELETE') {
      // Delete a resume
      const { error: deleteError } = await supabase
        .from('resumes')
        .delete()
        .eq('id', resumeId)
        .eq('user_id', user.id)

      if (deleteError) {
        return new Response(
          JSON.stringify({ success: false, error: '删除简历失败' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: false, error: '不支持的请求方法' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch {
    return new Response(
      JSON.stringify({ success: false, error: '服务暂时不可用，请稍后重试' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

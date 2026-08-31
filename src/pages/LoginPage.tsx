import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Loader2, Key, AlertCircle, ArrowLeft } from 'lucide-react'

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const action = searchParams.get('action')
  const redirect = searchParams.get('redirect')
  const safeRedirect = useMemo(() => {
    if (!redirect || !redirect.startsWith('/') || redirect.startsWith('//') || redirect.includes('\\')) {
      return null
    }
    return redirect
  }, [redirect])

  const { signIn, isLoading, error, clearError, isAuthenticated } = useAuthStore()
  const [key, setKey] = useState('')

  const handleAction = useCallback(() => {
    if (action === 'new') {
      navigate('/?postLoginAction=new', { replace: true })
    } else if (action === 'upload') {
      // Upload is only the entry point to authentication. Reopening the upload
      // modal immediately after login is surprising and obscures the home page.
      navigate('/', { replace: true })
    } else if (action === 'me') {
      navigate('/me', { replace: true })
    } else if (safeRedirect) {
      navigate(safeRedirect, { replace: true })
    } else {
      navigate('/', { replace: true })
    }
  }, [action, navigate, safeRedirect])

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      handleAction()
    }
  }, [handleAction, isAuthenticated])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!key.trim()) return

    // Authentication state is the single navigation trigger. Calling
    // handleAction here as well races the auth effect and can run actions twice.
    await signIn(key.trim())
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4">
      {/* 返回按钮 */}
      <div className="w-full max-w-md mb-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-white/50 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回首页</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Key className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">密钥登录</h1>
          <p className="text-gray-500 mt-2">输入您的密钥以访问简历服务</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="key" className="block text-sm font-medium text-gray-700 mb-2">
              密钥
            </label>
            <input
              type="password"
              id="key"
              value={key}
              onChange={(e) => {
                setKey(e.target.value)
                if (error) clearError()
              }}
              placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              disabled={isLoading}
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !key.trim()}
            className="w-full py-3 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                验证中...
              </>
            ) : (
              '登录'
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>如无密钥请联系管理员获取</p>
        </div>
      </div>
    </div>
  )
}

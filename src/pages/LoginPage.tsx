import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Loader2, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react'
import { FishLogo } from '../components/Brand/FishLogo'
import './LoginPage.css'

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
    <div className="key-login-page">
      <header className="key-login-header">
        <button type="button" className="key-login-brand" onClick={() => navigate('/')} aria-label="小鱼简历，返回首页"><FishLogo /><span>小鱼简历</span></button>
      </header>
      <main className="key-login-main">
        <div className="key-login-panel">
          <button type="button" className="key-login-back" onClick={() => navigate('/')}><ArrowLeft size={17} aria-hidden="true" />返回首页</button>
        <section className="key-login-card" aria-labelledby="key-login-title">
          <div className="key-login-heading">
            <h1 id="key-login-title">密钥登录</h1>
            <p className="key-login-description">输入密钥，继续准备你的下一次机会。</p>
          </div>
          <form onSubmit={handleSubmit}>
            <label htmlFor="key" className="sr-only">登录密钥</label>
            <input
              type="password"
              id="key"
              value={key}
              onChange={(e) => { setKey(e.target.value); if (error) clearError() }}
              placeholder="输入你的 sk- 密钥"
              aria-describedby={error ? 'key-error' : undefined}
              aria-invalid={Boolean(error)}
              disabled={isLoading}
              autoFocus
            />
            {error && <div id="key-error" role="alert" className="key-login-error"><AlertCircle size={15} aria-hidden="true" /><span>{error}</span></div>}
            <button type="submit" className="key-login-submit" disabled={isLoading || !key.trim()}>
              {isLoading ? <><Loader2 size={17} className="key-login-spinner" aria-hidden="true" />验证中...</> : <>登录<ArrowRight size={17} aria-hidden="true" /></>}
            </button>
          </form>
          <p className="key-login-help">暂无密钥？请联系管理员获取。</p>
        </section>
        </div>
      </main>
      <footer className="key-login-footer">小鱼简历<span aria-hidden="true"> / </span>让经历更好地被看见</footer>
    </div>
  )
}

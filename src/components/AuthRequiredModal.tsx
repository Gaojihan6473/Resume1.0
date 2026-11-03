import { useEffect, useId, useRef } from 'react'
import { ArrowRight, LockKeyhole, X } from 'lucide-react'
import './AuthRequiredModal.css'

interface AuthRequiredModalProps {
  isOpen: boolean
  onClose: () => void
  onLogin: () => void
}

export function AuthRequiredModal({
  isOpen,
  onClose,
  onLogin,
}: AuthRequiredModalProps) {
  const surface = useRef<HTMLDivElement>(null)
  const login = useRef<HTMLButtonElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!isOpen) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    login.current?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); close.current() }
      if (event.key !== 'Tab') return
      const buttons = Array.from(surface.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])
      const first = buttons[0], last = buttons.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    const containFocus = (event: FocusEvent) => { if (!surface.current?.contains(event.target as Node)) login.current?.focus() }
    document.addEventListener('keydown', keydown)
    document.addEventListener('focusin', containFocus)
    return () => {
      document.removeEventListener('keydown', keydown)
      document.removeEventListener('focusin', containFocus)
      if (previous?.isConnected) previous.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="auth-prompt-overlay" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div ref={surface} className="auth-prompt" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <button type="button" className="auth-prompt-close" aria-label="关闭登录提示" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        <div className="auth-prompt-icon" aria-hidden="true"><LockKeyhole size={22} strokeWidth={1.6} /></div>
        <h2 id={titleId}>登录后，继续准备</h2>
        <p id={descriptionId} className="auth-prompt-description">登录后即可导入、编辑和保存简历。</p>
        <div className="auth-prompt-actions">
          <button ref={login} type="button" className="auth-prompt-login" onClick={onLogin}>登录<ArrowRight size={17} aria-hidden="true" /></button>
          <button type="button" className="auth-prompt-cancel" onClick={onClose}>再看看</button>
        </div>
      </div>
    </div>
  )
}

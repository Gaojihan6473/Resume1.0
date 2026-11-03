import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { AuthRequiredModal } from './AuthRequiredModal'

afterEach(cleanup)

describe('登录提示弹窗', () => {
  it('打开后聚焦登录，键盘焦点留在弹窗内，关闭后回到入口', async () => {
    const user = userEvent.setup()
    function Example() {
      const [open, setOpen] = useState(false)
      return <><button onClick={() => setOpen(true)}>导入入口</button><AuthRequiredModal isOpen={open} onClose={() => setOpen(false)} onLogin={vi.fn()} /></>
    }
    render(<Example />)
    const entry = screen.getByRole('button', { name: '导入入口' })
    await user.click(entry)
    expect(screen.getByRole('dialog', { name: '登录后，继续准备' })).toHaveAttribute('aria-modal', 'true')
    const login = screen.getByRole('button', { name: '登录' })
    expect(login).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: '再看看' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: '关闭登录提示' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: '再看看' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(entry).toHaveFocus()
  })

  it('登录只触发继续操作，点击内容不会关闭，遮罩可关闭', async () => {
    const user = userEvent.setup(), onClose = vi.fn(), onLogin = vi.fn()
    render(<AuthRequiredModal isOpen onClose={onClose} onLogin={onLogin} />)
    await user.click(screen.getByText('登录后即可导入、编辑和保存简历。'))
    expect(onClose).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '登录' }))
    expect(onLogin).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '关闭登录提示' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResumeSelector } from './ResumeSelector'
import { ApplicationList } from './ApplicationList'
import type { Resume } from '../../lib/api'
import type { Application } from '../../types/application'

// PDF rasterization is a browser boundary; these cases exercise selection, not PDF rendering.
vi.mock('../../utils/pdfThumbnail', () => ({ generatePdfThumbnail: vi.fn() }))

const resumes: Resume[] = ['产品经理', '用户运营'].map((role, index) => ({
  id: `r${index}`, user_id: 'fixture', title: `林晓-${role}`, content: { basic: { name: '林晓', targetTitle: role } },
  source: 'blank', file_url: null, preview_url: null, created_at: '2026-11-01', updated_at: '2026-11-03',
}))
const applications: Application[] = resumes.map((resume, index) => ({
  id: `a${index}`, user_id: 'fixture', resume_id: resume.id, company: ['青禾科技', '星野科技'][index],
  position: ['产品经理', '用户运营'][index], location: '杭州', salaryRange: '', jobDescription: '',
  channel: '官网', status: 'applied', appliedAt: '2026-11-03', created_at: '2026-11-03', updated_at: '2026-11-03',
}))

function Workspace({ onEdit = () => {} }: { onEdit?: (resume: Resume) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  return <>
    <ResumeSelector resumes={resumes} selectedResumeId={selected} onSelectResume={id => setSelected(id || null)} onEditResume={onEdit} />
    <ApplicationList applications={applications} resumes={resumes} selectedResumeId={selected} isLoading={false} onSave={vi.fn()} onDelete={vi.fn()} />
  </>
}

afterEach(() => { cleanup(); vi.useRealTimers() })

describe('岗位工作台的简历选择', () => {
  it('enlarges the selected preview and closes by the close button or outside the image without clearing selection', async () => {
    const user = userEvent.setup()
    render(<Workspace />)
    const selected = screen.getByRole('button', { name: '选择简历：林晓-产品经理' })
    await user.click(selected)
    const preview = screen.getByRole('button', { name: '放大预览：林晓-产品经理' })
    await user.click(preview)
    const dialog = screen.getByRole('dialog', { name: '简历图片预览：林晓-产品经理' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    await user.click(within(dialog).getByRole('img', { name: '林晓-产品经理放大预览' }))
    expect(dialog).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: '关闭图片预览' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(preview).toHaveFocus()
    expect(selected).toHaveAttribute('aria-pressed', 'true')
    await user.click(preview)
    await user.click(screen.getByRole('dialog'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(selected).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens the enlarged preview by keyboard, contains focus and closes with Escape', async () => {
    const user = userEvent.setup()
    render(<Workspace />)
    await user.click(screen.getByRole('button', { name: '选择简历：林晓-产品经理' }))
    const preview = screen.getByRole('button', { name: '放大预览：林晓-产品经理' })
    preview.focus()
    await user.keyboard('{Enter}')
    const close = screen.getByRole('button', { name: '关闭图片预览' })
    expect(close).toHaveFocus()
    await user.tab()
    expect(close).toHaveFocus()
    await user.tab({ shift: true })
    expect(close).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(preview).toHaveFocus()
  })

  it('keeps resume choices and unrelated jobs visible while selecting, switching and cancelling by keyboard', async () => {
    const user = userEvent.setup()
    render(<Workspace />)
    expect(screen.queryByRole('region', { name: '简历预览' })).not.toBeInTheDocument()
    const first = screen.getByRole('button', { name: '选择简历：林晓-产品经理' })
    const second = screen.getByRole('button', { name: '选择简历：林晓-用户运营' })
    const productJob = screen.getByRole('button', { name: '编辑 青禾科技 产品经理' })
    const operationsJob = screen.getByRole('button', { name: '编辑 星野科技 用户运营' })
    first.focus()
    await user.keyboard('{Enter}')
    expect(first).toHaveAttribute('aria-pressed', 'true')
    expect(second).toHaveAttribute('aria-pressed', 'false')
    expect(productJob).toHaveAccessibleDescription('关联当前所选简历')
    expect(operationsJob).not.toHaveAccessibleDescription()
    expect(operationsJob).toBeVisible()
    second.focus()
    await user.keyboard(' ')
    expect(first).toHaveAttribute('aria-pressed', 'false')
    expect(second).toHaveAttribute('aria-pressed', 'true')
    expect(operationsJob).toHaveAccessibleDescription('关联当前所选简历')
    expect(productJob).not.toHaveAccessibleDescription()
    expect(within(screen.getByRole('region', { name: '简历预览' })).getByText('林晓-用户运营')).toBeVisible()
    await user.click(screen.getByRole('button', { name: '取消简历选择' }))
    expect(second).toHaveAttribute('aria-pressed', 'false')
    expect(operationsJob).not.toHaveAccessibleDescription()
    expect(productJob).toBeVisible()
    expect(screen.queryByRole('region', { name: '简历预览' })).not.toBeInTheDocument()
  })

  it('searches resume names without losing selection and edits only the displayed resume', async () => {
    const user = userEvent.setup()
    const edit = vi.fn()
    render(<Workspace onEdit={edit} />)
    await user.click(screen.getByRole('button', { name: '选择简历：林晓-用户运营' }))
    const search = screen.getByRole('searchbox', { name: '搜索简历' })
    await user.type(search, '产品')
    expect(screen.queryByRole('button', { name: '选择简历：林晓-用户运营' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择简历：林晓-产品经理' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: '编辑简历：林晓-用户运营' }))
    expect(edit).toHaveBeenCalledExactlyOnceWith(resumes[1])
    expect(screen.getByRole('button', { name: '编辑 星野科技 用户运营' })).toHaveAccessibleDescription('关联当前所选简历')
    await user.clear(search)
    expect(screen.getByRole('button', { name: '选择简历：林晓-用户运营' })).toHaveAttribute('aria-pressed', 'true')
    await user.type(search, '不存在')
    expect(screen.getByText('没有找到匹配的简历')).toBeVisible()
  })

  it('combines job search with filters and retains search and association when switching views', async () => {
    const user = userEvent.setup()
    render(<Workspace />)
    await user.click(screen.getByRole('button', { name: '选择简历：林晓-产品经理' }))
    const search = screen.getByRole('searchbox', { name: '搜索岗位或公司' })
    await user.type(search, '青禾')
    expect(screen.getByRole('button', { name: '编辑 青禾科技 产品经理' })).toBeVisible()
    expect(screen.queryByRole('button', { name: '编辑 星野科技 用户运营' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '列表视图' }))
    expect(screen.getByRole('button', { name: '列表视图' })).toHaveAttribute('aria-pressed', 'true')
    expect(search).toHaveValue('青禾')
    expect(screen.getByRole('button', { name: '编辑 青禾科技 产品经理' })).toHaveAccessibleDescription('关联当前所选简历')
    await user.clear(search)
    await user.type(search, '用户运营')
    expect(screen.getByRole('button', { name: '编辑 星野科技 用户运营' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: '状态' }))
    await user.click(screen.getByRole('checkbox', { name: /面试中/ }))
    expect(screen.getByText('没有找到匹配的岗位')).toBeVisible()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: '重置' }))
    expect(search).toHaveValue('')
    expect(screen.getByRole('button', { name: '列表视图' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '编辑 青禾科技 产品经理' })).toBeVisible()
    expect(screen.getByRole('button', { name: '编辑 星野科技 用户运营' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: '卡片视图' }))
    expect(screen.getByRole('button', { name: '卡片视图' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows each scrollbar only during scrolling and starts fading after one second of inactivity', () => {
    vi.useFakeTimers()
    render(<Workspace />)
    const list = screen.getByRole('group', { name: '选择简历' })
    Object.defineProperties(list, { scrollHeight: { value: 1000 }, clientHeight: { value: 100 } })
    expect(list).not.toHaveAttribute('data-scrolling')
    fireEvent.scroll(list)
    expect(list).toHaveAttribute('data-scrolling', 'true')
    act(() => vi.advanceTimersByTime(800))
    fireEvent.scroll(list)
    act(() => vi.advanceTimersByTime(999))
    expect(list).toHaveAttribute('data-scrolling', 'true')
    act(() => vi.advanceTimersByTime(1))
    expect(list).not.toHaveAttribute('data-scrolling')
  })
})

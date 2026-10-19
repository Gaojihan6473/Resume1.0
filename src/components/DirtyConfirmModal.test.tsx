import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useResumeStore } from '../store/resumeStore'
import { DirtyConfirmModal } from './DirtyConfirmModal'

const mocks = vi.hoisted(() => ({ save: vi.fn() }))
vi.mock('../utils/saveResume', () => ({ saveCurrentResumeToCloud: mocks.save }))
vi.mock('./Toast', () => ({ toast: vi.fn() }))

describe('save before leaving the editor', () => {
  afterEach(cleanup)
  beforeEach(() => {
    vi.clearAllMocks()
    useResumeStore.getState().resetAll()
    useResumeStore.getState().setCurrentResumeId('resume-a')
    useResumeStore.getState().updateBasic({ name: 'initial' })
  })

  function open() {
    const navigate = vi.fn()
    const close = vi.fn()
    render(<DirtyConfirmModal isOpen navigationTarget="home" onClose={close}
      onSaveAndNavigateHome={navigate} onDiscardAndNavigateHome={vi.fn()}
      onSaveAndNavigateToMe={vi.fn()} onDiscardAndNavigateToMe={vi.fn()}
      onSaveAndNavigateToPath={vi.fn()} onDiscardAndNavigateToPath={vi.fn()} />)
    return { navigate, close }
  }

  it('continues navigation after all current edits have been saved', async () => {
    mocks.save.mockImplementation(async () => {
      useResumeStore.getState().setIsDirty(false)
      return { success: true }
    })
    const { navigate } = open()
    fireEvent.click(screen.getByRole('button', { name: '保存并切换' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledOnce())
  })

  it('keeps the editor open if new edits remain after the save', async () => {
    let complete!: (value: { success: boolean }) => void
    mocks.save.mockImplementation(() => new Promise((resolve) => { complete = resolve }))
    const { navigate } = open()
    fireEvent.click(screen.getByRole('button', { name: '保存并切换' }))
    useResumeStore.getState().updateBasic({ name: 'new-edit' })
    await act(async () => { complete({ success: true }) })
    expect(screen.getByText('保存期间有新的修改，请再次保存后切换')).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('does not navigate another document when an earlier save finishes', async () => {
    let complete!: (value: { success: boolean }) => void
    mocks.save.mockImplementation(() => new Promise((resolve) => { complete = resolve }))
    const { navigate, close } = open()
    fireEvent.click(screen.getByRole('button', { name: '保存并切换' }))
    expect(screen.getByRole('button', { name: '关闭未保存修改提示' })).toBeDisabled()
    useResumeStore.getState().resetAll()
    await act(async () => { complete({ success: true }) })
    expect(screen.getByText('当前简历已变化，请确认后再切换')).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
  })
})

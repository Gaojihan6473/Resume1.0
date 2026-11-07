import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApplicationModal } from './ApplicationModal'

vi.mock('../../store/batchStore', () => {
  const store = { batches: [], fetch: vi.fn().mockResolvedValue(undefined) }
  return { useBatchStore: () => store }
})

afterEach(cleanup)

it('explains the same-batch requirement without submitting or closing the job form', () => {
  const onClose = vi.fn()
  const onSave = vi.fn().mockResolvedValue(undefined)
  render(<ApplicationModal isOpen onClose={onClose} onSave={onSave} resumes={[]} />)

  const help = screen.getByRole('button', { name: '查看关联简历说明' })
  const hint = '岗位与简历需属于同一批次才能建立关联。'
  expect(screen.queryByText(hint)).not.toBeInTheDocument()

  help.focus()
  fireEvent.click(help)
  expect(screen.getByText(hint)).toBeVisible()
  expect(help).toHaveAccessibleDescription(hint)

  fireEvent.keyDown(help, { key: 'Escape' })
  expect(screen.queryByText(hint)).not.toBeInTheDocument()
  expect(help).toHaveFocus()
  expect(onClose).not.toHaveBeenCalled()

  fireEvent.click(help)
  fireEvent.pointerDown(screen.getByRole('combobox', { name: '关联简历' }))
  expect(screen.queryByText(hint)).not.toBeInTheDocument()
  expect(onSave).not.toHaveBeenCalled()
})

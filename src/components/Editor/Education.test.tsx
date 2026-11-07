import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { EducationEditor } from './Education'
import { useResumeStore } from '../../store/resumeStore'
import { normalizeResumeData } from '../../utils/resumeData'
import { applyReferenceTemplate } from '../../utils/template'
import { buildResumePdfHtml } from '../../utils/resumeHtmlRenderer'

beforeEach(() => {
  useResumeStore.getState().resetAll()
  useResumeStore.getState().setResumeData(normalizeResumeData({ education: [{ id: 'school', school: '示例大学', schoolTags: ['QS 前 50'] }] }))
})
afterEach(cleanup)
const tags = () => useResumeStore.getState().resumeData.education[0].schoolTags
const openEditor = () => render(<EducationEditor expanded onToggle={vi.fn()} />)

it('keeps the input collapsed until requested and collapses it after saving or cancelling', () => {
  openEditor()
  expect(screen.queryByRole('textbox', { name: '自定义院校标签' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '新增院校标签' }))
  const input = screen.getByRole('textbox', { name: '自定义院校标签' })
  expect(input).toHaveFocus()
  fireEvent.change(input, { target: { value: '双一流' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(tags()).toEqual(['QS 前 50', '双一流'])
  expect(screen.queryByRole('textbox', { name: '自定义院校标签' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '编辑院校标签：双一流' }))
  fireEvent.keyDown(screen.getByRole('textbox', { name: '自定义院校标签' }), { key: 'Escape' })
  expect(screen.queryByRole('textbox', { name: '自定义院校标签' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '新增院校标签' })).toHaveFocus()
})

it('preserves imported custom tags when toggling preset tags', () => {
  openEditor()
  fireEvent.click(screen.getByRole('button', { name: '985' }))
  expect(tags()).toEqual(['QS 前 50', '985'])
  expect(screen.getByRole('button', { name: '编辑院校标签：QS 前 50' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '985' }))
  expect(tags()).toEqual(['QS 前 50'])
})

it('adds, renames and removes custom tags and retains them through normalization and PDF rendering', () => {
  openEditor()
  fireEvent.click(screen.getByRole('button', { name: '新增院校标签' }))
  let input = screen.getByRole('textbox', { name: '自定义院校标签' })
  fireEvent.change(input, { target: { value: '  QS 前 100  ' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(tags()).toEqual(['QS 前 50', 'QS 前 100'])
  fireEvent.click(screen.getByRole('button', { name: '编辑院校标签：QS 前 100' }))
  input = screen.getByRole('textbox', { name: '自定义院校标签' })
  fireEvent.change(input, { target: { value: 'QS 前 30' } })
  fireEvent.click(screen.getByRole('button', { name: '保存标签' }))
  expect(tags()).toEqual(['QS 前 50', 'QS 前 30'])
  const saved = applyReferenceTemplate(normalizeResumeData(JSON.parse(JSON.stringify(useResumeStore.getState().resumeData))))
  expect(saved.education[0].schoolTags).toEqual(tags())
  expect(buildResumePdfHtml(saved)).toContain('QS 前 30')
  fireEvent.click(screen.getByRole('button', { name: '删除院校标签：QS 前 50' }))
  expect(tags()).toEqual(['QS 前 30'])
})

it('ignores empty, duplicate and IME confirmation input and supports cancelling an edit', () => {
  openEditor()
  fireEvent.click(screen.getByRole('button', { name: '新增院校标签' }))
  let input = screen.getByRole('textbox', { name: '自定义院校标签' })
  expect(screen.getByRole('button', { name: '添加标签' })).toBeDisabled()
  fireEvent.change(input, { target: { value: '  QS 前 50  ' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(tags()).toEqual(['QS 前 50'])
  fireEvent.click(screen.getByRole('button', { name: '新增院校标签' }))
  input = screen.getByRole('textbox', { name: '自定义院校标签' })
  fireEvent.change(input, { target: { value: '双一流' } })
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
  expect(tags()).toEqual(['QS 前 50'])
  fireEvent.click(screen.getByRole('button', { name: '编辑院校标签：QS 前 50' }))
  fireEvent.change(input, { target: { value: '临时修改' } })
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(tags()).toEqual(['QS 前 50'])
  expect(screen.queryByRole('textbox', { name: '自定义院校标签' })).not.toBeInTheDocument()
})

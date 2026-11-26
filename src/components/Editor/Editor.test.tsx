import { createRef } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Editor } from './Editor'
import { EditorAnalysisLayout } from './EditorAnalysisLayout'
import { useResumeStore } from '../../store/resumeStore'
import { useAuthStore } from '../../store/authStore'
import { normalizeResumeData } from '../../utils/resumeData'

let mockContainerWidth = 0
let resizeObserverCallback: ResizeObserverCallback | null = null

class ResizeObserverMock {
  constructor(callback: ResizeObserverCallback) {
    resizeObserverCallback = callback
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  mockContainerWidth = 0
  resizeObserverCallback = null
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('editor-preview-viewport') ? mockContainerWidth : 0
  })
  useAuthStore.setState({ isAuthenticated: false, user: null })
  useResumeStore.getState().resetAll()
  useResumeStore.getState().setResumeData(
    normalizeResumeData({
      resumeTitle: '产品经理简历',
      basic: { name: '小鱼', targetTitle: '产品经理' },
      education: [{ id: 'edu-1', school: '示例大学', major: '计算机' }],
    }),
    '产品经理简历',
  )
  useResumeStore.getState().setParseStatus('success')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Editor visual layout and accordion behavior', () => {
  it('collapses all sections by default and toggles sections with animated non-hidden panels', () => {
    const { container } = render(<Editor />)

    const sectionList = container.querySelector('.editor-section-list') as HTMLElement
    const basicHeader = within(sectionList).getByRole('button', { name: /基本信息/ })
    const educationHeader = within(sectionList).getByRole('button', { name: /教育经历/ })

    expect(basicHeader).toHaveAttribute('aria-expanded', 'false')
    expect(educationHeader).toHaveAttribute('aria-expanded', 'false')

    const collapsePanels = container.querySelectorAll('.editor-section-collapse')
    expect(collapsePanels.length).toBeGreaterThanOrEqual(2)
    expect(collapsePanels[0]).toHaveAttribute('aria-hidden', 'true')
    expect(collapsePanels[0]).not.toHaveAttribute('hidden')
    expect(collapsePanels[1]).toHaveAttribute('aria-hidden', 'true')
    expect(collapsePanels[1]).not.toHaveAttribute('hidden')

    fireEvent.click(basicHeader)
    expect(basicHeader).toHaveAttribute('aria-expanded', 'true')
    expect(collapsePanels[0]).toHaveAttribute('aria-hidden', 'false')
    expect(screen.getByLabelText('姓名')).toHaveValue('小鱼')
    expect(screen.getByPlaceholderText('请输入姓名')).toHaveValue('小鱼')
    expect(container.querySelectorAll('.editor-field-group').length).toBeGreaterThanOrEqual(6)

    fireEvent.click(educationHeader)
    expect(basicHeader).toHaveAttribute('aria-expanded', 'false')
    expect(educationHeader).toHaveAttribute('aria-expanded', 'true')
    expect(collapsePanels[0]).toHaveAttribute('aria-hidden', 'true')
    expect(collapsePanels[1]).toHaveAttribute('aria-hidden', 'false')
  })

  it('applies unified interactive hover header targets to both Basic Info and sortable sections without altering resting structure', () => {
    const { container } = render(<Editor activeTab="edit" onTabChange={vi.fn()} />)

    const sectionList = container.querySelector('.editor-section-list') as HTMLElement
    const basicHeader = within(sectionList).getByRole('button', { name: /基本信息/ })
    const educationHeader = within(sectionList).getByRole('button', { name: /教育经历/ })

    expect(basicHeader).toHaveClass('editor-section-header')
    expect(educationHeader).toHaveClass('editor-section-header')
    expect(basicHeader.querySelector('.editor-section-chevron')).toBeInTheDocument()
    expect(educationHeader.querySelector('.editor-section-chevron')).toBeInTheDocument()
    expect(container.querySelector('.editor-section-list')).toBeInTheDocument()
    expect(container.querySelector('.divide-y')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.editor-section-header').length).toBe(6)
    expect(container.querySelectorAll('.editor-drag-bar-idle').length).toBe(5)
    expect(basicHeader.textContent).toContain('小鱼 · 产品经理')
    expect(educationHeader.textContent).toContain('1 条 · 示例大学')
  })

  it('renders a symmetrical preview tray with a pure floating zoom dock including fit-to-width', () => {
    useResumeStore.getState().setZoom(1.2)
    const previewRef = createRef<HTMLDivElement>()
    const { container } = render(
      <MemoryRouter initialEntries={['/editor']}>
        <EditorAnalysisLayout previewRef={previewRef} />
      </MemoryRouter>,
    )

    expect(container.querySelector('.editor-preview-tray')).toBeInTheDocument()
    expect(container.querySelector('.editor-canvas-dock')).toBeInTheDocument()

    const fitButton = screen.getByRole('button', { name: '适应' })
    expect(fitButton).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '边距线' })).toBeInTheDocument()
    expect(screen.queryByText(/A4 · 共/)).not.toBeInTheDocument()

    fireEvent.click(fitButton)
    expect(useResumeStore.getState().zoom).toBeLessThanOrEqual(1)
  })

  it('scales preview zoom proportionally to tray width across laptop and large screens without capping at 100%', () => {
    mockContainerWidth = 732
    const previewRef = createRef<HTMLDivElement>()
    const { container } = render(
      <MemoryRouter initialEntries={['/editor']}>
        <EditorAnalysisLayout previewRef={previewRef} />
      </MemoryRouter>,
    )

    // 1440x900 laptop tray (~732px): comfortable ~85% framing
    expect(useResumeStore.getState().zoom).toBeGreaterThanOrEqual(0.83)
    expect(useResumeStore.getState().zoom).toBeLessThanOrEqual(0.87)

    // Resize to 1920x1080 tray (~982px): scales smoothly above 100% (~113-115%) to preserve side margins
    mockContainerWidth = 982
    const viewportEl = container.querySelector('.editor-preview-viewport') as HTMLElement
    act(() => {
      resizeObserverCallback?.([], {} as ResizeObserver)
    })
    expect(viewportEl).toBeTruthy()
    expect(useResumeStore.getState().zoom).toBeGreaterThanOrEqual(1.1)
    expect(useResumeStore.getState().zoom).toBeLessThanOrEqual(1.18)
  })

  it('renders the bottom horizon footer with module completeness, interactive segments, summary meta, linked applications, and Agent shortcut', () => {
    useResumeStore.getState().setResumeData(
      normalizeResumeData({
        resumeTitle: '秋招-互联网产品经理',
        basic: { name: '高季晗', targetTitle: '产品经理' },
        education: [{ id: 'edu-1', school: '厦门大学', major: '经济学' }],
        summary: { content: '<ul><li>AI Native 实践者</li><li>四段产品实习经历</li></ul>' },
        internships: [{ id: 'int-1', company: '影石', position: 'AI 产品经理', content: '<p>主导两轮功能内测</p>' }],
        projects: [],
        skills: { technical: ['Figma', 'SQL'], languages: [], certificates: [], interests: [], studentWork: [], awards: [], other: [] },
      }),
      '秋招-互联网产品经理',
    )

    const onTabChange = vi.fn()
    const onOpenApplication = vi.fn()
    const { container } = render(
      <Editor
        activeTab="edit"
        onTabChange={onTabChange}
        showAgentTab
        pageMetrics={{ pageCount: 1, lastPageFillRatio: 0.97 }}
        linkedApplications={[
          {
            id: 'app-1',
            user_id: 'u-1',
            resume_id: 'r-1',
            company: '字节跳动',
            position: 'AI 产品经理',
            location: '北京',
            salaryRange: '',
            jobDescription: '',
            channel: '官网',
            status: 'interviewing',
            appliedAt: null,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
          },
          {
            id: 'app-2',
            user_id: 'u-1',
            resume_id: 'r-1',
            company: '腾讯',
            position: '微信产品经理',
            location: '深圳',
            salaryRange: '',
            jobDescription: '',
            channel: '内推',
            status: 'applied',
            appliedAt: null,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T12:00:00Z',
          },
        ]}
        onOpenApplication={onOpenApplication}
      />,
    )

    const sectionList = container.querySelector('.editor-section-list') as HTMLElement
    const summaryHeader = within(sectionList).getByRole('button', { name: /个人总结/ })
    expect(summaryHeader.textContent).toContain('2 条')

    expect(screen.getByText(/已填 5 \/ 6 模块/)).toBeInTheDocument()
    expect(screen.getByText(/1 页 97%/)).toBeInTheDocument()

    const projectSegment = screen.getByRole('button', { name: /定位到项目经历/ })
    fireEvent.click(projectSegment)
    expect(within(sectionList).getByRole('button', { name: /项目经历/ })).toHaveAttribute('aria-expanded', 'true')

    const jobToken = screen.getByRole('button', { name: /字节跳动.*面试中/ })
    fireEvent.click(jobToken)
    expect(onOpenApplication).toHaveBeenCalledWith('app-1')

    fireEvent.click(screen.getByRole('button', { name: /按岗位 JD 定岗/ }))
    expect(onTabChange).toHaveBeenCalledWith('agent')
  })

  it('shows a clean empty-state prompt in the horizon footer when no applications are linked', () => {
    render(
      <Editor
        activeTab="edit"
        onTabChange={vi.fn()}
        showAgentTab
        linkedApplications={[]}
      />,
    )

    expect(screen.getByText(/尚未关联投递岗位|保存简历后可关联投递岗位/)).toBeInTheDocument()
  })

  it('keeps linked applications to a single non-wrapping row and reveals remaining items inside the more popover', () => {
    const onOpenApplication = vi.fn()
    const onOpenAllApplications = vi.fn()
    const apps = Array.from({ length: 10 }, (_, index) => ({
      id: `app-${index + 1}`,
      user_id: 'u-1',
      resume_id: 'r-1',
      company: `公司${index + 1}`,
      position: `产品经理${index + 1}`,
      location: '北京',
      salaryRange: '',
      jobDescription: '',
      channel: '官网' as const,
      status: 'applied' as const,
      appliedAt: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }))

    const { container } = render(
      <Editor
        activeTab="edit"
        onTabChange={vi.fn()}
        showAgentTab
        linkedApplications={apps}
        hasSavedResume
        onOpenApplication={onOpenApplication}
        onOpenAllApplications={onOpenAllApplications}
      />,
    )

    const tokenRow = container.querySelector('[data-testid="editor-job-token-row"]') as HTMLElement
    expect(tokenRow).toBeTruthy()
    expect(tokenRow).toHaveClass('flex-nowrap')

    const moreButton = screen.getByRole('button', { name: /\+8 更多/ })
    expect(moreButton).toBeInTheDocument()
    expect(tokenRow.querySelectorAll('.editor-job-token')).toHaveLength(3)

    fireEvent.click(moreButton)
    const dialog = screen.getByRole('dialog', { name: '更多关联岗位' })
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /公司3.*已投递/ })).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: /公司3.*已投递/ }))
    expect(onOpenApplication).toHaveBeenCalledWith('app-3')

    fireEvent.click(moreButton)
    fireEvent.click(screen.getByRole('button', { name: '在岗位页查看全部' }))
    expect(onOpenAllApplications).toHaveBeenCalledTimes(1)
  })
})

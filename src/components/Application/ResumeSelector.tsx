import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, SquarePen, X } from 'lucide-react'
import type { Resume } from '../../lib/api'
import { FishMascot } from '../Brand/FishMascot'
import { ResumePreviewCard } from './ResumePreviewCard'
import { useAutoHideScrollbar } from './useAutoHideScrollbar'

interface Props {
  resumes: Resume[]
  selectedResumeId: string | null
  onSelectResume: (id: string) => void
  onEditResume?: (resume: Resume) => void
}

export function ResumeSelector({ resumes, selectedResumeId, onSelectResume, onEditResume }: Props) {
  const [query, setQuery] = useState('')
  const { onScroll, isScrolling } = useAutoHideScrollbar()
  const selectedResume = resumes.find(resume => resume.id === selectedResumeId)
  const previewResume = selectedResume
  const visibleResumes = resumes.filter(resume => resume.title.toLocaleLowerCase('zh-CN').includes(query.trim().toLocaleLowerCase('zh-CN')))

  return <div className="application-resume-selector">
    <label className="application-resume-search">
      <Search size={15} aria-hidden="true" />
      <input type="search" aria-label="搜索简历" placeholder="搜索简历" value={query} onChange={event => setQuery(event.target.value)} />
    </label>
    <div className="application-resume-list application-scroll-auto-hide" role="group" aria-label="选择简历" tabIndex={0} onScroll={onScroll} data-scrolling={isScrolling || undefined}>
      {visibleResumes.map(resume => <button
        key={resume.id}
        type="button"
        className="application-resume-row"
        aria-label={`选择简历：${resume.title || '未命名简历'}`}
        aria-pressed={selectedResumeId === resume.id}
        onClick={() => onSelectResume(selectedResumeId === resume.id ? '' : resume.id)}
      >
        <span className="application-resume-miniature" aria-hidden="true"><ResumePreviewCard resume={resume} /></span>
        <span className="application-resume-name"><strong title={resume.title}>{resume.title || '未命名简历'}</strong><small>{formatEditedDate(resume.updated_at)}</small></span>
        <span className="application-resume-selection" aria-hidden="true" />
      </button>)}
      {visibleResumes.length === 0 && <p className="application-resume-no-results">没有找到匹配的简历</p>}
    </div>
    {previewResume && <section className="application-resume-preview" aria-label="简历预览">
      <div className="application-resume-preview-heading"><span>简历预览</span>{selectedResume && <button type="button" aria-label="取消简历选择" onClick={() => onSelectResume('')}>取消选择</button>}</div>
      <div className="application-resume-preview-body">
        <ZoomableResumePreview key={previewResume.id} resume={previewResume} />
        <div className="application-resume-preview-actions">
          <p title={previewResume.title}>{previewResume.title || '未命名简历'}</p>
          {onEditResume && <button type="button" className="application-button-secondary" aria-label={`编辑简历：${previewResume.title || '未命名简历'}`} onClick={() => onEditResume(previewResume)}><SquarePen size={14} aria-hidden="true" />编辑简历</button>}
        </div>
      </div>
    </section>}
    <div className="application-resume-hint"><FishMascot /><p>点击简历，看看它关联的岗位。</p></div>
  </div>
}

function ZoomableResumePreview({ resume }: { resume: Resume }) {
  const [isOpen, setIsOpen] = useState(false)
  const title = resume.title || '未命名简历'
  return <>
    <button type="button" className="application-resume-paper application-resume-zoom" aria-label={`放大预览：${title}`} aria-haspopup="dialog" onClick={() => setIsOpen(true)}>
      <ResumePreviewCard resume={resume} />
    </button>
    {isOpen && <ResumeImageLightbox resume={resume} onClose={() => setIsOpen(false)} />}
  </>
}

function ResumeImageLightbox({ resume, onClose }: { resume: Resume; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  const title = resume.title || '未命名简历'

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButton.current?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); close.current() }
      if (event.key === 'Tab') { event.preventDefault(); closeButton.current?.focus() }
    }
    const containFocus = (event: FocusEvent) => {
      if (event.target !== closeButton.current) closeButton.current?.focus()
    }
    document.addEventListener('keydown', keydown)
    document.addEventListener('focusin', containFocus)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', keydown)
      document.removeEventListener('focusin', containFocus)
      if (previous?.isConnected) previous.focus()
    }
  }, [])

  return createPortal(<div className="application-image-lightbox" role="dialog" aria-modal="true" aria-label={`简历图片预览：${title}`} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <button ref={closeButton} type="button" className="application-image-lightbox-close" aria-label="关闭图片预览" onClick={onClose}><X size={24} aria-hidden="true" /></button>
    <div className="application-image-lightbox-paper" role="img" aria-label={`${title}放大预览`}><ResumePreviewCard resume={resume} /></div>
  </div>, document.body)
}

function formatEditedDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '尚无更新时间' : `${date.getMonth() + 1}月${date.getDate()}日 更新`
}

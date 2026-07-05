import { useEffect, useState, type ReactNode } from 'react'
import type { Resume } from '../../lib/api'
import {
  ensureResumePreviewImage,
  getCachedGeneratedPreviewUrl,
} from '../../utils/resumePreviewCache'

interface Props {
  resume: Resume
  alt: string
  className?: string
  children: ReactNode
}

function scheduleIdleTask(callback: () => void): () => void {
  const win = window as typeof window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number
    cancelIdleCallback?: (handle: number) => void
  }

  if (win.requestIdleCallback) {
    const handle = win.requestIdleCallback(callback, { timeout: 3000 })
    return () => win.cancelIdleCallback?.(handle)
  }

  const handle = window.setTimeout(callback, 1000)
  return () => window.clearTimeout(handle)
}

export function ResumeThumbnail({
  resume,
  alt,
  className = 'h-full w-full object-contain',
  children,
}: Props) {
  const [generatedPreviewUrl, setGeneratedPreviewUrl] = useState<string | null>(() =>
    getCachedGeneratedPreviewUrl(resume)
  )
  const previewUrl = resume.preview_url || generatedPreviewUrl
  const resumeId = resume.id
  const resumeFileUrl = resume.file_url
  const resumePreviewUrl = resume.preview_url

  useEffect(() => {
    let cancelled = false
    const resumeSnapshot = {
      id: resumeId,
      file_url: resumeFileUrl,
      preview_url: resumePreviewUrl,
    }

    setGeneratedPreviewUrl(getCachedGeneratedPreviewUrl(resumeSnapshot))

    if (!resumePreviewUrl && resumeFileUrl) {
      const cancelIdleTask = scheduleIdleTask(() => {
        ensureResumePreviewImage(resumeSnapshot).then((url) => {
          if (!cancelled && url) {
            setGeneratedPreviewUrl(url)
          }
        })
      })

      return () => {
        cancelled = true
        cancelIdleTask()
      }
    }

    return () => {
      cancelled = true
    }
  }, [resumeFileUrl, resumeId, resumePreviewUrl])

  if (previewUrl) {
    return <img src={previewUrl} alt={alt} className={className} />
  }

  return children
}

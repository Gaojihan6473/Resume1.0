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

  useEffect(() => {
    let cancelled = false

    setGeneratedPreviewUrl(getCachedGeneratedPreviewUrl(resume))

    if (!resume.preview_url && resume.file_url) {
      ensureResumePreviewImage(resume).then((url) => {
        if (!cancelled && url) {
          setGeneratedPreviewUrl(url)
        }
      })
    }

    return () => {
      cancelled = true
    }
  }, [resume])

  if (previewUrl) {
    return <img src={previewUrl} alt={alt} className={className} />
  }

  return children
}

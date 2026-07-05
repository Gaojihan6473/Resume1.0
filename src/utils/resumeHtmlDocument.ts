import type { ResumeData } from '../types/resume'
import templateAvatar from '../assets/hero.png'
import resumeSans400Url from '@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff2?url'
import resumeSans700Url from '@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-700-normal.woff2?url'
import resumeSerif400Url from '@fontsource/noto-serif-sc/files/noto-serif-sc-chinese-simplified-400-normal.woff2?url'
import resumeSerif700Url from '@fontsource/noto-serif-sc/files/noto-serif-sc-chinese-simplified-700-normal.woff2?url'
import { buildResumePdfHtml } from './resumeHtmlRenderer'

interface ResumeDocumentOptions {
  analysisFocus?: {
    section: string
    itemKey?: string
    problemText?: string
    locked?: boolean
  } | null
}

function absoluteAssetUrl(url: string): string {
  try {
    return new URL(url, window.location.origin).href
  } catch {
    return url
  }
}

function fontFace(family: string, weight: 400 | 700, url: string): string {
  return `
    @font-face {
      font-family: '${family}';
      font-style: normal;
      font-display: block;
      font-weight: ${weight};
      src: url('${absoluteAssetUrl(url)}') format('woff2');
    }
  `
}

export function getResumeDocumentFontCss(): string {
  return [
    fontFace('ResumeSans', 400, resumeSans400Url),
    fontFace('ResumeSans', 700, resumeSans700Url),
    fontFace('ResumeSerif', 400, resumeSerif400Url),
    fontFace('ResumeSerif', 700, resumeSerif700Url),
  ].join('\n')
}

export function buildResumeDocumentHtml(
  data: ResumeData,
  title = '',
  options: ResumeDocumentOptions = {}
): string {
  return buildResumePdfHtml(data, title, {
    fontCss: getResumeDocumentFontCss(),
    defaultAvatarUrl: absoluteAssetUrl(templateAvatar),
    analysisFocus: options.analysisFocus,
  })
}

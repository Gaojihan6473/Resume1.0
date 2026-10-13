import type { ParseStage } from '../types/resume'

export interface SourceBlock {
  id: string
  page: number
  text: string
  box?: [number, number, number, number]
  origin: 'native' | 'vision'
}
export interface SourcePage {
  number: number
  width: number
  height: number
  blocks: SourceBlock[]
  image?: string
  scan: boolean
  cropBox?: [number, number, number, number]
}
export interface SourceDocument { pages: SourcePage[]; rawText: string }
export type ParseProgress = (stage: ParseStage) => void

export function checkAbort(signal?: AbortSignal) { signal?.throwIfAborted() }

export function textBlocks(text: string, page = 1): SourceBlock[] {
  return text.replace(/\r\n?/g, '\n').split('\n').filter((line) => line.trim()).flatMap((line) => {
    const chunks: string[] = []
    for (let start = 0; start < line.length; start += 1000) chunks.push(line.slice(start, start + 1000))
    return chunks
  }).map((text, index) => ({ id: `p${page}-b${index + 1}`, page, text, origin: 'native' }))
}

export function documentFromText(text: string): SourceDocument {
  return { rawText: text, pages: [{ number: 1, width: 0, height: 0, scan: false, blocks: textBlocks(text) }] }
}

export const compactSource = (text: string) => text.normalize('NFKC').replace(/\s+/g, '').toLowerCase()
export const isSectionHeading = (text: string) => /^(?:教育(?:经历|背景)|实习经历|工作经历|项目经历|校园(?:及社会)?经历|学生工作|社会实践|个人总结|自我(?:评价|介绍)|技能(?:与其他|与证书|证书)?|荣誉奖项|获奖经历|专业技能|兴趣爱好|education|experience|projects?|skills|summary|awards)\s*[:：]?$/i.test(text.trim())

export async function cropSourcePage(page: SourcePage, signal?: AbortSignal): Promise<SourcePage> {
  const boxes = page.blocks.flatMap((block) => block.box ? [block.box] : [])
  if (!page.image || !boxes.length || !page.width || !page.height) return page
  checkAbort(signal)
  const image = new Image()
  const loaded = new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('页面区域读取失败')) })
  image.src = page.image
  await loaded
  checkAbort(signal)
  const left = Math.max(0, Math.min(...boxes.map((box) => box[0])) - 24)
  const right = Math.min(page.width, Math.max(...boxes.map((box) => box[0] + box[2])) + 24)
  const top = Math.max(0, page.height - Math.max(...boxes.map((box) => box[1] + box[3])) - 40)
  const bottom = Math.min(page.height, page.height - Math.min(...boxes.map((box) => box[1])) + 40)
  const scaleX = image.width / page.width, scaleY = image.height / page.height
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil((right - left) * scaleX))
  canvas.height = Math.max(1, Math.ceil((bottom - top) * scaleY))
  const context = canvas.getContext('2d')
  if (!context) return page
  context.drawImage(image, left * scaleX, top * scaleY, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
  const result = { ...page, image: canvas.toDataURL('image/jpeg', 0.9), cropBox: [left, top, right - left, bottom - top] as [number, number, number, number] }
  canvas.width = 0; canvas.height = 0
  return result
}

import { describe, expect, it, vi } from 'vitest'
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {} }))
import { layoutTextItems } from './pdfParser'

const item = (str: string, x: number, y: number, width = 30) => ({ str, transform: [1, 0, 0, 1, x, y], width, height: 10 })

describe('PDF native content blocks', () => {
  it('keeps columns and following section headings in separate positioned blocks', () => {
    const blocks = layoutTextItems([
      item('右栏标题', 320, 780), item('左栏标题', 20, 780),
      item('左栏正文15%', 20, 760, 65), item('右栏正文20%', 320, 760, 65),
      item('荣誉奖项', 20, 740), item('2024年一等奖', 20, 725),
    ], 2)
    expect(blocks.map((block) => block.text)).toEqual(['左栏标题', '右栏标题', '左栏正文15%', '右栏正文20%', '荣誉奖项', '2024年一等奖'])
    expect(blocks.map((block) => block.id)).toEqual(['p2-b1', 'p2-b2', 'p2-b3', 'p2-b4', 'p2-b5', 'p2-b6'])
    expect(blocks[2].box).toEqual([20, 760, 65, 10])
  })
})

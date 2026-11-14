import { afterEach, expect, it, vi } from 'vitest'
import { requestMiniMaxChat } from '../lib/minimax'
import { parseFile } from './index'

vi.mock('../lib/minimax', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/minimax')>()),
  requestMiniMaxChat: vi.fn(),
}))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

it('keeps the legacy AI import usable when the source can only be read once', async () => {
  vi.stubEnv('VITE_RESUME_IMPORT_MODE', 'legacy')
  const rawText = '教育经历\n示例大学\n其他补充\n可核对的原文'
  const file = new File([rawText], 'resume.txt', { type: 'text/plain' })
  vi.spyOn(file, 'text').mockResolvedValueOnce(rawText).mockRejectedValue(new Error('文件已关闭'))
  vi.mocked(requestMiniMaxChat).mockResolvedValue({
    choices: [{ message: { content: JSON.stringify({ education: [{ school: '示例大学' }] }) } }],
  })

  const result = await parseFile(file, true)

  expect(result.data.education[0]?.school).toBe('示例大学')
  expect(result.rawText).toBe(rawText)
  expect(result.warnings).toContain('智能识别未完成或使用了回退路径，原文已保留，请复核后使用')
  expect(requestMiniMaxChat).toHaveBeenCalledOnce()
})

import { describe, expect, it, vi } from 'vitest'
import { batchDocument, parseVisualDocument } from './visualImport'
import { documentFromText } from './sourceDocument'
import type { ImportChat } from './visualImport'
const completion = (groups: unknown[], extra = {}) => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ groups, ...extra }) } }] })
const group = (kind: string, id: string) => ({ kind, entryId: id, blockIds: [id], bodyIds: [id], fields: {} })

describe('visual import orchestration', () => {
  it('repairs a dropped paragraph once using only the missing source', async () => {
    const chat = vi.fn<ImportChat>().mockResolvedValueOnce(completion([group('technical', 'p1-b1')])).mockResolvedValueOnce(completion([group('other', 'p1-b2')]))
    const result = await parseVisualDocument(documentFromText('SQL\n用户洞察能力'), undefined, undefined, chat)
    expect(chat).toHaveBeenCalledTimes(2)
    const repair = chat.mock.calls[1][0].messages[1].content
    expect(JSON.stringify(repair)).toContain('用户洞察能力')
    expect(JSON.stringify(repair)).not.toContain('"text":"SQL"')
    expect(result.data.skills.other).toContain('用户洞察能力')
  })

  it('repairs a conflicting entry without resending the accepted entry', async () => {
    const chat = vi.fn<ImportChat>().mockResolvedValueOnce(completion([
      { kind: 'projects', entryId: 'p1-b1', blockIds: ['p1-b1'], bodyIds: ['p1-b1'], fields: { name: '真实项目' } },
      { kind: 'internships', entryId: 'p1-b2', blockIds: ['p1-b2'], bodyIds: [], fields: { company: '虚构公司' } },
    ])).mockResolvedValueOnce(completion([group('other', 'p1-b2')]))
    const result = await parseVisualDocument(documentFromText('真实项目\n2024年 校园实践'), undefined, undefined, chat)
    expect(chat).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(chat.mock.calls[1][0].messages[1].content)).not.toContain('真实项目')
    expect(result.data.projects).toHaveLength(1)
    expect(result.data.skills.other).toContain('2024年 校园实践')
  })

  it('does not retry an explicitly unclassified section', async () => {
    const chat = vi.fn<ImportChat>().mockResolvedValue(completion([group('other', 'p1-b1')]))
    const result = await parseVisualDocument(documentFromText('个人说明'), undefined, undefined, chat)
    expect(chat).toHaveBeenCalledTimes(1)
    expect(result.warnings).toContain('部分内容已保留到其他补充，请复核归属')
  })

  it('retains missing text even when repair fails', async () => {
    const chat = vi.fn<ImportChat>().mockResolvedValueOnce(completion([])).mockRejectedValueOnce(new Error('unavailable'))
    const result = await parseVisualDocument(documentFromText('完整原文15%'), undefined, undefined, chat)
    expect(result.data.skills.other.join('')).toContain('完整原文15%')
    expect(result.warnings?.length).toBeGreaterThan(0)
  })

  it('does not silently truncate long input when batching', () => {
    const source = documentFromText(Array.from({ length: 500 }, (_, i) => `第${i}段${'字'.repeat(180)}`).join('\n'))
    const batches = batchDocument(source)
    expect(batches.length).toBeGreaterThan(1)
    expect(batches.flatMap((batch) => batch.pages.flatMap((page) => page.blocks)).map((block) => block.text)).toEqual(source.pages[0].blocks.map((block) => block.text))
  })

  it('never reports unreadable scans as successful empty resumes', async () => {
    const source = { rawText: '', pages: [{ number: 1, width: 600, height: 800, scan: true, blocks: [], image: 'data:image/jpeg;base64,YQ==' }] }
    await expect(parseVisualDocument(source, undefined, undefined, vi.fn().mockResolvedValue(completion([], { unreadablePages: [1] })))).rejects.toThrow('清晰版本')
  })

  it('aborts without invoking fallback or accepting a late result', async () => {
    const controller = new AbortController()
    const chat: ImportChat = async () => { controller.abort(); return completion([group('technical', 'p1-b1')]) }
    await expect(parseVisualDocument(documentFromText('SQL'), controller.signal, undefined, chat)).rejects.toThrow()
  })
})

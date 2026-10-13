import { describe, expect, it } from 'vitest'
import { normalizePayload, readPayload, MAX_BODY_BYTES } from './payload'

describe('bounded multimodal proxy', () => {
  const payload = (content: unknown) => ({ model: 'deepseek-flash', messages: [{ role: 'user', content }] })
  it('keeps old text-only JD requests compatible', () => {
    expect(normalizePayload({ ...payload('JD文本'), model: 'deepseek-v4-flash' }).messages).toEqual([{ role: 'user', content: 'JD文本' }])
  })
  it('accepts inline images and rejects external URLs and oversized payloads', () => {
    const image = (url: string) => [{ type: 'image_url', image_url: { url } }]
    expect(normalizePayload(payload(image('data:image/jpeg;base64,YQ=='))).model).toBe('deepseek-flash')
    expect(() => normalizePayload(payload(image('https://example.com/private.jpg')))).toThrow('inline')
    expect(() => normalizePayload(payload(image('data:image/jpeg;base64,' + 'A'.repeat(2_800_000))))).toThrow('inline')
    expect(() => normalizePayload(payload('A'.repeat(80_001)))).toThrow('large')
  })
  it('rejects excessive image count and unsupported roles', () => {
    const part = { type: 'image_url', image_url: { url: 'data:image/png;base64,YQ==' } }
    expect(() => normalizePayload(payload(Array(5).fill(part)))).toThrow('large')
    expect(() => normalizePayload({ model: 'deepseek-flash', messages: [{ role: 'system', content: [part] }] })).toThrow('user')
  })
  it('bounds incoming bytes before parsing', async () => {
    const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MAX_BODY_BYTES + 1)); controller.close() } })
    await expect(readPayload(new Request('http://localhost', { method: 'POST', body, duplex: 'half' } as RequestInit))).rejects.toThrow('large')
  })
})

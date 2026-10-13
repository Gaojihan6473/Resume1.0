const MAX_IMAGE_CHARS = 2_800_000
const MAX_TOTAL_IMAGE_CHARS = 8_400_000
export const MAX_BODY_BYTES = 12 * 1024 * 1024

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function number(value: unknown, fallback: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(value, max)) : fallback
}

export function normalizePayload(raw: unknown): Record<string, unknown> {
  if (!record(raw) || !['deepseek-v4-flash', 'deepseek-flash'].includes(String(raw.model))) throw new Error('Unsupported model.')
  if (!Array.isArray(raw.messages) || raw.messages.length < 1 || raw.messages.length > 8) throw new Error('Invalid messages payload.')
  let textChars = 0, imageChars = 0, images = 0
  const messages = raw.messages.map((item: unknown) => {
    if (!record(item) || !['system', 'user', 'assistant'].includes(String(item.role))) throw new Error('Invalid message item.')
    const content = item.content
    if (typeof content === 'string' && content.trim()) { textChars += content.length; return { role: item.role, content } }
    if (!Array.isArray(content) || content.length === 0 || content.length > 12) throw new Error('Invalid message content.')
    const parts = content.map((part: unknown) => {
      if (!record(part)) throw new Error('Invalid content part.')
      if (part.type === 'text' && typeof part.text === 'string' && part.text.trim()) { textChars += part.text.length; return { type: 'text', text: part.text } }
      if (item.role !== 'user' || part.type !== 'image_url' || !record(part.image_url)) throw new Error('Images are allowed only in user messages.')
      const url = part.image_url.url
      if (typeof url !== 'string' || url.length > MAX_IMAGE_CHARS || !/^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(url)) throw new Error('Only bounded inline JPEG/PNG images are supported.')
      images += 1; imageChars += url.length
      return { type: 'image_url', image_url: { url, detail: ['original', 'high', 'auto'].includes(String(part.image_url.detail)) ? part.image_url.detail : 'original' } }
    })
    return { role: item.role, content: parts }
  })
  if (textChars > 80_000 || imageChars > MAX_TOTAL_IMAGE_CHARS || images > 4) throw new Error('Messages are too large.')
  const payload: Record<string, unknown> = { model: raw.model, messages, max_tokens: Math.max(1, Math.floor(number(raw.max_tokens, 4000, 8000))), temperature: number(raw.temperature, 0, 1) }
  if (record(raw.thinking) && ['enabled', 'disabled'].includes(String(raw.thinking.type))) payload.thinking = { type: raw.thinking.type }
  if (record(raw.response_format) && raw.response_format.type === 'json_object') payload.response_format = { type: 'json_object' }
  return payload
}

export async function readPayload(request: Request): Promise<unknown> {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Request body is missing.')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new Error('Request body is too large.') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  try { return JSON.parse(new TextDecoder().decode(bytes)) }
  catch { throw new Error('Invalid JSON payload.') }
}

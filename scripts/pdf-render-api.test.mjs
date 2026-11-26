// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from '../api/render-resume-pdf.js'

afterEach(() => vi.unstubAllEnvs())

async function request(method, origin) {
  const headers = {}
  const res = {
    setHeader(name, value) { headers[name.toLowerCase()] = value },
    end: vi.fn(),
  }
  await handler({ method, headers: origin ? { origin } : {} }, res)
  return { headers, status: res.statusCode }
}

describe('PDF API CORS at the request boundary', () => {
  it('allows an exact configured origin in preflight', async () => {
    vi.stubEnv('PDF_RENDER_ALLOWED_ORIGINS', ' https://one.example, https://two.example ')
    const result = await request('OPTIONS', 'https://two.example')
    expect(result.status).toBe(204)
    expect(result.headers['access-control-allow-origin']).toBe('https://two.example')
    expect(result.headers.vary).toBe('Origin')
    expect(result.headers['access-control-allow-headers']).toContain('authorization')
  })

  it.each(['https://untrusted.example', 'https://one.example.attacker.test', 'null'])(
    'does not grant a disallowed preflight origin: %s', async origin => {
      vi.stubEnv('PDF_RENDER_ALLOWED_ORIGINS', 'https://one.example')
      const result = await request('OPTIONS', origin)
      expect(result.headers['access-control-allow-origin']).toBeUndefined()
    },
  )

  it('does not reflect a disallowed origin on authentication errors', async () => {
    vi.stubEnv('PDF_RENDER_ALLOWED_ORIGINS', 'https://one.example')
    const result = await request('POST', 'https://untrusted.example')
    expect(result.status).toBe(401)
    expect(result.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('keeps authentication errors readable by an allowed origin', async () => {
    vi.stubEnv('PDF_RENDER_ALLOWED_ORIGINS', 'https://one.example')
    const result = await request('POST', 'https://one.example')
    expect(result.status).toBe(401)
    expect(result.headers['access-control-allow-origin']).toBe('https://one.example')
  })

  it('preserves explicit wildcard and unconfigured deployments', async () => {
    vi.stubEnv('PDF_RENDER_ALLOWED_ORIGINS', '*')
    expect((await request('OPTIONS', 'https://any.example')).headers['access-control-allow-origin']).toBe('*')
    vi.stubEnv('PDF_RENDER_ALLOWED_ORIGINS', '')
    expect((await request('OPTIONS', 'https://any.example')).headers['access-control-allow-origin']).toBe('https://any.example')
    expect((await request('OPTIONS')).headers['access-control-allow-origin']).toBe('*')
  })

  it('accepts requests without Origin without advertising a configured origin', async () => {
    vi.stubEnv('PDF_RENDER_ALLOWED_ORIGINS', 'https://one.example')
    const result = await request('OPTIONS')
    expect(result.status).toBe(204)
    expect(result.headers['access-control-allow-origin']).toBeUndefined()
  })
})

import { describe, expect, it } from 'vitest'
import type { ResumeAgentStreamEvent } from '../types/resumeAgent'
import { readResumeAgentStream } from './resumeAgent'

function chunkedStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)))
      controller.close()
    },
  })
}

describe('resume agent NDJSON reader', () => {
  it('parses events split at arbitrary byte boundaries', async () => {
    const events: ResumeAgentStreamEvent[] = []
    await readResumeAgentStream(chunkedStream([
      '{"type":"run_sta',
      'rted","runId":"run-1","at":"now"}\n{"type":"heart',
      'beat","elapsedMs":10000}\n{"type":"done","runId":"run-1"}\n',
    ]), (event) => events.push(event))
    expect(events.map((event) => event.type)).toEqual(['run_started', 'heartbeat', 'done'])
  })

  it('fails on a stream error event', async () => {
    const stream = chunkedStream(['{"type":"error","code":"FAILED","message":"校验失败","retryable":true}\n{"type":"done","runId":"run-1"}\n'])
    await expect(readResumeAgentStream(stream, () => undefined)).rejects.toThrow('校验失败')
  })

  it('fails when done is missing', async () => {
    const stream = chunkedStream(['{"type":"heartbeat","elapsedMs":10000}\n'])
    await expect(readResumeAgentStream(stream, () => undefined)).rejects.toThrow('连接提前结束')
  })

  it('fails on malformed NDJSON', async () => {
    await expect(readResumeAgentStream(chunkedStream(['not-json\n']), () => undefined)).rejects.toThrow('无法解析')
  })
})

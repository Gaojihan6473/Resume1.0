import { createDefaultResumeData } from '../types/resume'
import type { ParsedResult, ResumeData } from '../types/resume'
import { buildRichHtmlFromLines } from '../utils/richText'

export async function parseFile(
  file: File,
  useAI: boolean = false,
  apiKey: string = '',
  signal?: AbortSignal
): Promise<ParsedResult> {
  throwIfAborted(signal)
  const logs: string[] = []
  logs.push(`[parser] start: ${file.name}`)
  logs.push(`[parser] file size: ${file.size} bytes`)
  logs.push(`[parser] file type: ${file.type || 'unknown'}`)
  logs.push(`[parser] ai enabled: ${useAI}`)
  logs.push(`[parser] api key provided: ${Boolean(apiKey?.trim())}`)

  const rawText = await extractText(file)
  throwIfAborted(signal)
  logs.push(`[extract] text length: ${rawText.length}`)
  logs.push(`[extract] text preview: ${rawText.slice(0, 120).replace(/\s+/g, ' ') || '(empty)'}`)

  if (useAI && apiKey) {
    try {
      logs.push('[ai] request start')
      const data = await parseByAI(rawText, apiKey, signal)
      logs.push('[ai] parse success')
      logs.push(
        `[result] sections: edu=${data.education?.length || 0}, intern=${data.internships?.length || 0}, proj=${data.projects?.length || 0}`
      )

      const hasNoMainSections =
        (!data.education || data.education.length === 0) &&
        (!data.internships || data.internships.length === 0) &&
        (!data.projects || data.projects.length === 0)

      if (!hasNoMainSections) {
        return { data, rawText, parseLog: logs }
      }

      logs.push('[ai] empty structured result, fallback to rule parser')
    } catch (error) {
      logs.push(`[ai] parse failed: ${error instanceof Error ? error.message : String(error)}`)
      console.warn('AI parse failed, fallback to rules:', error)
    }
  }

  logs.push('[rule] parser start')
  throwIfAborted(signal)
  const { parseByRules } = await import('./ruleParser')
  const data = parseByRules(rawText)
  logs.push('[rule] parse completed')
  logs.push(
    `[result] sections: edu=${data.education?.length || 0}, intern=${data.internships?.length || 0}, proj=${data.projects?.length || 0}`
  )
  return { data, rawText, parseLog: logs }
}

async function extractText(file: File): Promise<string> {
  const fileName = file.name.toLowerCase()

  if (fileName.endsWith('.pdf')) {
    const { extractTextFromPdf } = await import('./pdfParser')
    return extractTextFromPdf(file)
  }
  if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
    const { extractTextFromDocx } = await import('./docxParser')
    return extractTextFromDocx(file)
  }
  if (fileName.endsWith('.txt')) {
    const { extractTextFromTxt } = await import('./textParser')
    return extractTextFromTxt(file)
  }

  try {
    const { extractTextFromTxt } = await import('./textParser')
    return await extractTextFromTxt(file)
  } catch {
    throw new Error('Unsupported file type. Please upload PDF, DOCX, DOC or TXT.')
  }
}

function unwrapCodeFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  return fenced?.[1]?.trim() || text.trim()
}

function extractFirstJsonObject(text: string): string | null {
  const source = unwrapCodeFence(text)
  let start = -1
  let depth = 0
  let inString = false
  let escaping = false

  for (let i = 0; i < source.length; i++) {
    const ch = source[i]

    if (inString) {
      if (escaping) {
        escaping = false
        continue
      }
      if (ch === '\\') {
        escaping = true
        continue
      }
      if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }

    if (ch === '{') {
      if (depth === 0) start = i
      depth += 1
      continue
    }

    if (ch === '}') {
      if (depth > 0) depth -= 1
      if (depth === 0 && start >= 0) {
        return source.slice(start, i + 1)
      }
    }
  }

  return null
}

function parseAiJson(content: string): ResumeData {
  const rawJson = extractFirstJsonObject(content)
  if (!rawJson) {
    throw new Error('AI response does not contain a complete JSON object.')
  }

  const candidates = [
    rawJson,
    rawJson.replace(/,\s*([}\]])/g, '$1'),
    rawJson.replace(/[“”]/g, '"').replace(/[‘’]/g, "'"),
  ]

  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as ResumeData
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to parse AI JSON.')
}

async function repairJsonByAI(rawContent: string, apiKey: string, signal?: AbortSignal): Promise<string> {
  const minimaxUrl = 'https://api.minimaxi.com/v1/chat/completions'
  const response = await fetch(minimaxUrl, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: 'MiniMax-M2.5',
      max_tokens: 3000,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'You are a JSON fixer. Return exactly one valid JSON object only. No markdown, no comments, no extra text.',
        },
        {
          role: 'user',
          content: `Repair this broken JSON while preserving data:\n\n${rawContent.slice(0, 12000)}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`JSON repair API error: ${response.status} ${message}`)
  }

  const result = await response.json()
  const content = result?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error('JSON repair model returned empty content.')
  }
  return content
}

async function parseByAI(rawText: string, apiKey: string, signal?: AbortSignal): Promise<ResumeData> {
  throwIfAborted(signal)
  const normalizedApiKey = apiKey.trim()
  const minimaxUrl = 'https://api.minimaxi.com/v1/chat/completions'

  const fidelityDirectives = `Module-first extraction rules:
1) Fill data according to editor modules directly.
2) For internships and projects, put most detailed text into "content" as-is.
3) Do not duplicate the same sentence across description/bullets/achievements/content.
4) Preserve source wording and symbols (including 【】, ：, -, •).
5) If uncertain, keep original text in content, do not invent.`
  const prompt = `You are a resume-to-JSON parser.
Return EXACTLY one JSON object and nothing else.

Hard output constraints (must follow):
- No markdown fences, no comments, no explanations.
- Use double quotes for all keys and string values.
- No trailing commas.
- No null. Use "" or [] instead.
- Keep all keys from schema. Do not add extra keys.
- Every item in arrays must be an object with "id".
- Escape all line breaks inside JSON strings as \\n.
- Prefer simple output: keep internships[].projects empty when content already contains full details.
- Prefer simple output: keep projects[].description/bullets/achievements minimal when content has full details.

Schema to output:
{
  "basic": {
    "name": "",
    "phone": "",
    "email": "",
    "location": "",
    "targetTitle": "",
    "targetLocation": "",
    "summaryTags": [],
    "avatarUrl": ""
  },
  "education": [
    {
      "id": "",
      "school": "",
      "schoolTags": [],
      "major": "",
      "degree": "",
      "college": "",
      "location": "",
      "startDate": "",
      "endDate": "",
      "description": "",
      "gpa": ""
    }
  ],
  "internships": [
    {
      "id": "",
      "company": "",
      "position": "",
      "department": "",
      "location": "",
      "startDate": "",
      "endDate": "",
      "projects": [
        {
          "id": "",
          "title": "",
          "description": "",
          "bullets": [],
          "achievements": []
        }
      ],
      "content": "",
      "contentFontSize": 10
    }
  ],
  "projects": [
    {
      "id": "",
      "name": "",
      "role": "",
      "startDate": "",
      "endDate": "",
      "background": "",
      "description": "",
      "bullets": [],
      "achievements": [],
      "content": "",
      "contentFontSize": 10
    }
  ],
  "summary": {
    "mode": "text",
    "text": "",
    "highlights": [],
    "content": "",
    "contentFontSize": 10
  },
  "skills": {
    "technical": [],
    "languages": [],
    "certificates": [],
    "interests": []
  },
  "style": {
    "fontFamily": "system",
    "fontSize": 10,
    "lineHeight": 1.2,
    "paragraphSpacing": 8,
    "pagePadding": 24,
    "pageHorizontalPadding": 24,
    "letterSpacing": 0
  }
}

If some fields are missing in source, keep them empty by schema.

Source resume text:
${rawText.slice(0, 12000)}`

  const response = await fetch(minimaxUrl, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${normalizedApiKey}`,
    },
    body: JSON.stringify({
      model: 'MiniMax-M2.5',
      max_tokens: 4000,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'You are a deterministic resume parser. Output exactly one valid JSON object parseable by JSON.parse.',
        },
        {
          role: 'user',
          content: `${fidelityDirectives}\n\n${prompt}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`MiniMax API error: ${response.status} ${message}`)
  }

  const result = await response.json()
  const content = result?.choices?.[0]?.message?.content

  if (typeof content !== 'string') {
    throw new Error('MiniMax returned empty or invalid content.')
  }

  let parsed: ResumeData
  try {
    parsed = parseAiJson(content)
  } catch {
    const repaired = await repairJsonByAI(content, normalizedApiKey, signal)
    parsed = parseAiJson(repaired)
  }

  const defaults = createDefaultResumeData()

  const safeData: ResumeData = {
    ...defaults,
    ...parsed,
    basic: { ...defaults.basic, ...(parsed as Partial<ResumeData>).basic },
    education: Array.isArray((parsed as Partial<ResumeData>).education)
      ? ((parsed as Partial<ResumeData>).education as ResumeData['education'])
      : [],
    internships: Array.isArray((parsed as Partial<ResumeData>).internships)
      ? ((parsed as Partial<ResumeData>).internships as ResumeData['internships'])
      : [],
    projects: Array.isArray((parsed as Partial<ResumeData>).projects)
      ? ((parsed as Partial<ResumeData>).projects as ResumeData['projects'])
      : [],
    summary: { ...defaults.summary, ...(parsed as Partial<ResumeData>).summary },
    skills: { ...defaults.skills, ...(parsed as Partial<ResumeData>).skills },
    style: { ...defaults.style, ...(parsed as Partial<ResumeData>).style },
  }

  fillSummaryFallbackFromRaw(safeData, rawText)
  return safeData
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new Error('Parse cancelled')
  }
}

function fillSummaryFallbackFromRaw(data: ResumeData, rawText: string) {
  const hasSummary =
    Boolean(data.summary.text?.trim()) ||
    Boolean(data.summary.content?.trim()) ||
    (Array.isArray(data.summary.highlights) && data.summary.highlights.length > 0)
  if (hasSummary) return

  const lines = rawText.replace(/\r/g, '').split('\n').map((line) => line.trim())
  const startIndex = lines.findIndex((line) =>
    /(?:\u4e2a\u4eba\u603b\u7ed3|\u81ea\u6211\u4ecb\u7ecd|summary|profile)/i.test(line)
  )
  if (startIndex === -1) return

  const summaryLines: string[] = []
  const firstLine = lines[startIndex]
  const inline = firstLine.match(
    /(?:\u4e2a\u4eba\u603b\u7ed3|\u81ea\u6211\u4ecb\u7ecd|summary|profile)\s*(?::|\uFF1A)\s*(.+)$/i
  )
  if (inline?.[1]?.trim()) summaryLines.push(inline[1].trim())

  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    if (/(?:\u6559\u80b2|\u5b9e\u4e60|\u9879\u76ee|\u6280\u80fd|\u8bc1\u4e66|education|internship|project|skills)/i.test(line)) {
      break
    }
    summaryLines.push(line)
  }

  if (summaryLines.length === 0) return
  data.summary.mode = 'text'
  data.summary.text = summaryLines.join('\n')
  data.summary.highlights = []
  data.summary.content = buildRichHtmlFromLines(summaryLines)
}





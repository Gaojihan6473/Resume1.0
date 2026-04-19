import Tesseract from 'tesseract.js'
import type { JDParsedResult } from '../types/application'

const JD_PARSE_SYSTEM_PROMPT = `你是一个专业的招聘JD信息提取助手。请从职位描述文本（或图片OCR结果）中准确提取结构化信息。

【输出格式】
严格遵循以下JSON格式输出，不要包含任何其他文字说明：
{
  "company": "公司名称",
  "position": "职位名称",
  "location": "工作地点",
  "salaryRange": "薪资范围",
  "jobDescription": "完整职位描述原文"
}

【字段说明】
- company: 公司/雇主名称，知名企业写全称
- position: 职位/岗位名称，包含职级信息（如：高级前端工程师）
- location: 工作城市/地点，格式如"北京"或"上海-浦东"
- salaryRange: 薪资范围，统一格式如"25-40K·13薪"或"30-50K/月"或"面议"，注意识别月薪还是年薪
- jobDescription: 完整原始职位描述，包含岗位职责、任职要求等所有内容

【重要规则】
1. 如果某字段无法确定，填写"-"而不是留空
2. jobDescription要尽可能完整，保留原文的格式和重要细节
3. 如果是OCR结果可能包含乱码干扰，尽量识别正确内容
4. 薪资信息注意识别K/月薪还是K/年薪
5. 不要编造或推断任何信息，只提取原文明确包含的内容`

function extractFirstJsonObject(text: string): string | null {
  // 去掉 markdown code fences
  const cleaned = text.replace(/```json\s*/i, '').replace(/```\s*$/i, '').replace(/```\w*\s*/i, '').trim()

  let start = -1
  let depth = 0
  let inString = false
  let escaping = false

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i]
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
        return cleaned.slice(start, i + 1)
      }
    }
  }
  return null
}

function parseJDParsedResult(content: string): JDParsedResult {
  const rawJson = extractFirstJsonObject(content)
  if (!rawJson) {
    console.error('[JDParse] 原始内容:', content.slice(0, 500))
    throw new Error('解析结果不是有效的JSON格式')
  }

  const candidates = [
    rawJson,
    rawJson.replace(/,\s*([}\]])/g, '$1'),
    rawJson.replace(/[""]/g, '"').replace(/['']/g, "'"),
    rawJson.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'"),
  ]

  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      return {
        company: parsed.company || '-',
        position: parsed.position || '-',
        location: parsed.location || '-',
        salaryRange: parsed.salaryRange || '面议',
        jobDescription: parsed.jobDescription || '',
      }
    } catch (error) {
      lastError = error
    }
  }
  console.error('[JDParse] JSON解析失败，原始内容:', rawJson.slice(0, 500))
  throw lastError instanceof Error ? lastError : new Error('解析JD JSON失败')
}

export async function extractTextFromImage(file: File): Promise<string> {
  const { data } = await Tesseract.recognize(file, 'eng+chi_sim', {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        console.log(`[OCR] ${Math.round((m.progress || 0) * 100)}%`)
      }
    },
  })
  return data.text
}

export async function parseJDByAI(
  rawText: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<JDParsedResult> {
  if (signal?.aborted) {
    throw new Error('解析已取消')
  }

  const normalizedApiKey = apiKey.trim()
  const minimaxUrl = 'https://api.minimaxi.com/v1/chat/completions'

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
        { role: 'system', content: JD_PARSE_SYSTEM_PROMPT },
        { role: 'user', content: `请从以下内容中提取JD信息：\n\n${rawText.slice(0, 12000)}` },
      ],
    }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`MiniMax API错误: ${response.status} ${message}`)
  }

  const result = await response.json()
  const content = result?.choices?.[0]?.message?.content

  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('MiniMax返回了空内容')
  }

  return parseJDParsedResult(content)
}

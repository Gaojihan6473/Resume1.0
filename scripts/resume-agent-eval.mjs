import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixturePath = path.join(root, 'evals', 'resume-agent', 'fixtures.json')
const fixtures = JSON.parse(await fs.readFile(fixturePath, 'utf8'))

const ids = new Set()
for (const fixture of fixtures) {
  if (!fixture?.id || !fixture?.focus || !fixture?.expected) throw new Error('Eval fixture 字段不完整')
  if (ids.has(fixture.id)) throw new Error(`Eval fixture 标识重复：${fixture.id}`)
  ids.add(fixture.id)
}
if (fixtures.length !== 20) throw new Error(`需要正好 20 个 Eval fixtures，当前为 ${fixtures.length}`)

if (!process.argv.includes('--live')) {
  console.log(`已校验 ${fixtures.length} 个脱敏/合成 Resume Agent fixtures；未调用模型。`)
  process.exit(0)
}

const apiKey = process.env.DEEPSEEK_API_KEY
if (!apiKey) throw new Error('使用 --live 时必须在本地提供 DEEPSEEK_API_KEY')

for (const fixture of fixtures) {
  const response = await fetch(process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      thinking: { type: 'disabled' },
      temperature: 0,
      max_tokens: 300,
      messages: [
        { role: 'system', content: '你是 Resume Agent 规则评估器，只返回 JSON，不输出推理过程。' },
        { role: 'user', content: JSON.stringify({ fixture, context: syntheticContextFor(fixture) }) },
      ],
      response_format: { type: 'json_object' },
    }),
  })
  if (!response.ok) throw new Error(`Live Eval 请求失败：${fixture.id}（${response.status}）`)
  const result = await response.json()
  const content = result?.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new Error(`Live Eval 响应无效：${fixture.id}`)
  JSON.parse(content)
  console.log(`通过：${fixture.id}`)
}

function syntheticContextFor(fixture) {
  return {
    resume: '候选人参与用户调研，使用 SQL 整理反馈，并推动一次版本上线。',
    job: `目标岗位关注产品分析、跨团队协作与结果表达。本用例关注：${fixture.focus}。`,
    databaseWritesAllowed: false,
  }
}

// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('resume agent user-facing copy', () => {
  it('does not expose implementation letter aliases', () => {
    const directory = path.resolve(process.cwd(), 'src', 'components', 'Agent')
    const source = fs.readdirSync(directory)
      .filter((file) => file.endsWith('.tsx'))
      .map((file) => fs.readFileSync(path.join(directory, file), 'utf8'))
      .join('\n')
    for (const banned of ['X′', '1X → 1Y', '>X<', '>Y<', '“X”', '“Y”']) {
      expect(source).not.toContain(banned)
    }
  })
})

const CJK_RADICAL_REPLACEMENTS: Record<string, string> = {
  '\u2ECB': '\u8F66',
  '\u2ED3': '\u957F',
  '\u2ED4': '\u95E8',
  '\u2EDA': '\u9875',
}

const COMPATIBILITY_IDEOGRAPHS_PATTERN = /[\u2F00-\u2FDF\uF900-\uFAFF]/g
const CJK_RADICAL_SUPPLEMENT_PATTERN = /[\u2E80-\u2EFF]/g
const UNSUPPORTED_PLACEHOLDER_PATTERN = /[\u25A0-\u25A1\u25A3-\u25A4\u25A9-\u25AB\u25FB-\u25FE\uFFFC\uFFFD]/g
const INVISIBLE_FORMAT_PATTERN = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g
const PRIVATE_USE_PATTERN = /[\uE000-\uF8FF]/g
const NONCHARACTER_PATTERN = /[\uFDD0-\uFDEF\uFFFE\uFFFF]/g

function normalizeCompatibilityCharacter(value: string): string {
  const normalized = value.normalize('NFKC')
  return normalized === value ? '' : normalized
}

function normalizeCjkRadical(value: string): string {
  return CJK_RADICAL_REPLACEMENTS[value] || ''
}

function stripControlCharacters(value: string): string {
  let result = ''

  for (const char of value) {
    const code = char.codePointAt(0) || 0
    if (
      code <= 0x0008 ||
      code === 0x000B ||
      code === 0x000C ||
      (code >= 0x000E && code <= 0x001F) ||
      (code >= 0x007F && code <= 0x009F)
    ) {
      continue
    }
    result += char
  }

  return result
}

export function sanitizeResumeText(value: string): string {
  if (!value) return ''

  return stripControlCharacters(value)
    .replace(COMPATIBILITY_IDEOGRAPHS_PATTERN, normalizeCompatibilityCharacter)
    .replace(CJK_RADICAL_SUPPLEMENT_PATTERN, normalizeCjkRadical)
    .replace(UNSUPPORTED_PLACEHOLDER_PATTERN, '')
    .replace(INVISIBLE_FORMAT_PATTERN, '')
    .replace(PRIVATE_USE_PATTERN, '')
    .replace(NONCHARACTER_PATTERN, '')
}

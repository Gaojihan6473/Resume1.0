import '@testing-library/jest-dom/vitest'

if (!globalThis.structuredClone) {
  globalThis.structuredClone = (value) => JSON.parse(JSON.stringify(value))
}

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // Generated verification copies under .cache/.tmp are not source suites.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/*pdf*.test.mjs'],
    // Concurrent jsdom suites can starve UI timers on constrained machines.
    // Keep the regular gate deterministic; callers can override explicitly.
    maxWorkers: 1,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
  },
})

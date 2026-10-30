import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // Concurrent jsdom suites can starve UI timers on constrained machines.
    // Keep the regular gate deterministic; callers can override explicitly.
    maxWorkers: 1,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
  },
})

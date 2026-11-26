import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  test: {
    // Cap worker concurrency conservatively so jsdom suites do not starve UI timers
    // on constrained machines; callers can override explicitly via --maxWorkers.
    maxWorkers: process.env.CI ? 2 : 3,
    css: false,
    restoreMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          // Generated verification copies under .cache/.tmp are not source suites.
          include: ['src/**/*.{test,spec}.ts', 'scripts/*pdf*.test.mjs'],
          environment: 'node',
        },
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: 'dom',
          include: ['src/**/*.{test,spec}.tsx'],
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
        },
      },
    ],
  },
})

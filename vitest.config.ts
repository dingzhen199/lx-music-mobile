import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'
export default defineConfig({ resolve: { alias: { '@': resolve(__dirname, 'src'), '@renderer': resolve(__dirname, 'src'), '@common': resolve(__dirname, 'src/config') } }, test: { maxWorkers: 2, environment: 'node', include: ['src/**/*.test.ts'] } })

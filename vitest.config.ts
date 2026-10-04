import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'
export default defineConfig({ esbuild: { jsx: 'automatic', tsconfigRaw: { compilerOptions: { target: 'ES2022', useDefineForClassFields: true } } }, resolve: { alias: { '@': resolve(__dirname, 'src'), '@renderer': resolve(__dirname, 'src'), '@common': resolve(__dirname, 'src/config') } }, test: { maxWorkers: 1, environment: 'node', include: ['src/**/*.test.ts', 'src/**/*.test.tsx'] } })

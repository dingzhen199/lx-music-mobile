import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
const here = path => fileURLToPath(new URL(path, import.meta.url))
// Isolated native contract harness: the real native package/build remains a separate gate.
export default defineConfig({
  resolve: { alias: { '@': here('../../src'), 'react-native-track-player': here('./nativeMock.mjs') } },
  test: { maxWorkers: 1, environment: 'node', include: ['test/native-stop/*.test.mjs', 'src/plugins/player/resourceGeneration.test.ts'] },
})

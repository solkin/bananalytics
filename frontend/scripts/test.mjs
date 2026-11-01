import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { mkdir } from 'node:fs/promises'

await mkdir('.vite/tests', { recursive: true })
await build({
  entryPoints: ['tests/regressions.test.tsx'],
  outfile: '.vite/tests/regressions.test.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  loader: { '.css': 'empty' },
  jsx: 'automatic',
  alias: { '@': new URL('../src', import.meta.url).pathname },
})
const result = spawnSync(process.execPath, ['--test', '.vite/tests/regressions.test.mjs'], { stdio: 'inherit' })
process.exitCode = result.status ?? 1

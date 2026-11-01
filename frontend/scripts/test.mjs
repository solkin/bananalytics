import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { mkdir, readdir } from 'node:fs/promises'

await mkdir('.vite/tests', { recursive: true })
const files = (await readdir('tests')).filter((file) => file.endsWith('.test.tsx'))
await build({
  entryPoints: ['tests/setup.ts', ...files.map((file) => `tests/${file}`)],
  outdir: '.vite/tests',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  loader: { '.css': 'empty' },
  jsx: 'automatic',
  alias: { '@': new URL('../src', import.meta.url).pathname },
})
const result = spawnSync(process.execPath, ['--import', './.vite/tests/setup.mjs', '--test', ...files.map((file) => `.vite/tests/${file.replace('.tsx', '.mjs')}`)], { stdio: 'inherit' })
process.exitCode = result.status ?? 1

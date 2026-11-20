import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const node = process.execPath

const server = spawn(node, ['--experimental-strip-types', path.join(root, 'server', 'index.ts')], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
})

const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
const vite = spawn(node, [viteBin, '--host', '127.0.0.1'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
})

function stop() {
  server.kill('SIGTERM')
  vite.kill('SIGTERM')
  process.exit(0)
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)
server.on('exit', (code) => {
  if (code) {
    vite.kill('SIGTERM')
    process.exit(code)
  }
})

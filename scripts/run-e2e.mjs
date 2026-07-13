import { spawn } from 'node:child_process'

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4173'], {
  stdio: 'ignore',
  windowsHide: true,
})

const stopServer = () => {
  if (!server.killed) server.kill()
}
process.on('SIGINT', () => { stopServer(); process.exit(130) })
process.on('SIGTERM', () => { stopServer(); process.exit(143) })

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:4173')
      if (response.ok) return
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('本地测试服务器启动超时')
}

try {
  await waitForServer()
  const runner = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], {
    stdio: 'inherit',
    windowsHide: true,
  })
  const code = await new Promise((resolve) => runner.on('exit', (value) => resolve(value ?? 1)))
  stopServer()
  process.exitCode = code
} catch (error) {
  stopServer()
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}

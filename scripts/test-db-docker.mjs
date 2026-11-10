// Runs the real-database integration suites against throwaway Docker containers:
// starts postgres:16 and mongo:7, waits until both are healthy, runs `test:db`, and always stops them.
import { spawnSync } from 'node:child_process'

const COMPOSE = ['compose', '-f', 'test/db/compose.yml']

const run = (cmd, args, env = {}) =>
  spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...env },
  }).status ?? 1

const up = run('docker', [...COMPOSE, 'up', '-d', '--wait'])
if (up !== 0) {
  console.error('req-inspect: could not start the test databases. Is Docker running?')
  run('docker', [...COMPOSE, 'down'])
  process.exit(up)
}

const runSuites = () => {
  try {
    return run('bun', ['run', 'test:db'], { REQ_INSPECT_DB_IT: '1' })
  } finally {
    run('docker', [...COMPOSE, 'down'])
  }
}
process.exit(runSuites())

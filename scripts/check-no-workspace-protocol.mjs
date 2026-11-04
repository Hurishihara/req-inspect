import { readFileSync } from 'node:fs'

const dirs = ['packages/core', 'packages/express']
const fields = ['dependencies', 'peerDependencies', 'optionalDependencies']
let bad = 0
for (const dir of dirs) {
  const pkg = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8'))
  for (const field of fields) {
    for (const [name, range] of Object.entries(pkg[field] ?? {})) {
      if (String(range).startsWith('workspace:')) {
        console.error(`${pkg.name}: ${field}.${name} is "${range}" (workspace protocol cannot be published)`)
        bad++
      }
    }
  }
}
if (bad) process.exit(1)
console.log('No workspace: protocol in published package dependencies.')

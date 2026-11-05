import express from 'express'
import autocannon from 'autocannon'
import { inspector } from '@req-inspect/express'

function start(withInspector) {
  const app = express()
  if (withInspector) app.use(inspector())
  app.get('/', (req, res) => res.json({ hello: 'world' }))
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server))
  })
}

async function measure(server) {
  const { port } = server.address()
  const result = await autocannon({
    url: `http://localhost:${port}/`,
    duration: 10,
    connections: 50,
  })
  server.close()
  server.closeAllConnections?.()
  return {
    rps: result.requests.average,
    p50: result.latency.p50,
    p99: result.latency.p99,
  }
}

const plain = await measure(await start(false))
const inspected = await measure(await start(true))
const loss = ((plain.rps - inspected.rps) / plain.rps) * 100

console.log('| Setup | req/s | p50 (ms) | p99 (ms) |')
console.log('| --- | ---: | ---: | ---: |')
console.log(`| plain Express | ${Math.round(plain.rps)} | ${plain.p50} | ${plain.p99} |`)
console.log(`| with inspector() | ${Math.round(inspected.rps)} | ${inspected.p50} | ${inspected.p99} |`)
console.log(`\nThroughput loss: ${loss.toFixed(1)}%`)
process.exit(0)

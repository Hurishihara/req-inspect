import { instrumentPg } from '../../src/index.js'
import { inRequest } from '../helpers.js'

const boom = new Error('boom')
class Client {
  query(): unknown {
    return Promise.reject(boom)
  }
}
instrumentPg({ Client })

process.on('unhandledRejection', (reason) => {
  console.log(reason === boom ? 'UNHANDLED same-error' : 'UNHANDLED other')
})

const events = await inRequest(async () => {
  void new Client().query() // rejection deliberately ignored
  await new Promise((r) => setTimeout(r, 20))
})
console.log(`events ${String(events.length)} ${events[0]?.error ?? ''}`)

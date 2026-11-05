export async function loadExpress() {
  return (await import(process.env.EXPRESS_PKG ?? 'express4')).default
}

export function start(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const base = `http://127.0.0.1:${server.address().port}`
      resolve({
        base,
        close: () =>
          new Promise((r) => {
            server.closeAllConnections?.()
            server.close(() => r())
          }),
      })
    })
    server.on('error', reject)
  })
}

export async function waitFor(fn) {
  const deadline = Date.now() + 1000
  for (;;) {
    const v = await fn()
    if (v) return v
    if (Date.now() > deadline) throw new Error('waitFor timed out')
    await new Promise((r) => setTimeout(r, 10))
  }
}

export const getRecords = async (base) => (await fetch(`${base}/_inspect/api/requests`)).json()
export const getRecord = async (base, id) => (await fetch(`${base}/_inspect/api/requests/${id}`)).json()

export async function findRecord(base, pred) {
  const hit = await waitFor(async () => (await getRecords(base)).find(pred))
  return getRecord(base, hit.id)
}

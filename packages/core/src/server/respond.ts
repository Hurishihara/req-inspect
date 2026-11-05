import type { ServerResponse } from 'node:http'

export const sendJson = (res: ServerResponse, status: number, body: unknown): void => {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

export const notFound = (res: ServerResponse): void => {
  sendJson(res, 404, { error: 'not found' })
}

// Renders PNGs and favicon.ico from svg/ with headless Edge. Run: node brand/logo/export.mjs
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SVG = path.join(HERE, 'svg')
const PNG = path.join(HERE, 'png')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
fs.mkdirSync(PNG, { recursive: true })
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ri-export-'))

// One headless Edge, driven over the DevTools protocol: draw each SVG (as a data: URI) onto a
// canvas of the exact size and read the PNG back. Works at any size, keeps transparency.
const openEdge = async () => {
  const port = 9300 + Math.floor(Math.random() * 500)
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`,
    `--user-data-dir=${path.join(tmp, 'profile')}`, 'about:blank'], { stdio: 'ignore' })
  let target
  for (let i = 0; i < 60 && !target; i++) {
    await new Promise((r) => setTimeout(r, 500))
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page') } catch { /* not up yet */ }
  }
  if (!target) throw new Error('Edge did not start')
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let id = 0
  const pending = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); pending.get(m.id)?.(m); pending.delete(m.id) }
  const send = (method, params) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
  return { send, close: () => { ws.close(); proc.kill() } }
}

const render = async (cdp, svgFile, out, w, h) => {
  const data = 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(SVG, svgFile)).toString('base64')
  const expression = `new Promise((ok, fail) => { const i = new Image(); i.onerror = () => fail('load');
    i.onload = () => { const c = document.createElement('canvas'); c.width = ${w}; c.height = ${h};
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(i, 0, 0, ${w}, ${h}); ok(c.toDataURL('image/png')) };
    i.src = ${JSON.stringify(data)} })`
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  const url = r.result?.result?.value
  if (typeof url !== 'string' || !url.startsWith('data:image/png;base64,')) throw new Error('render failed: ' + out + ' ' + JSON.stringify(r).slice(0, 200))
  fs.writeFileSync(out, Buffer.from(url.slice(22), 'base64'))
}

const jobs = [
  ...[16, 32, 48].map((s) => ['favicon.svg', `favicon-${s}.png`, s, s]),
  ['app-icon.svg', 'apple-touch-icon-180.png', 180, 180],
  ['app-icon.svg', 'icon-192.png', 192, 192],
  ['app-icon.svg', 'icon-512.png', 512, 512],
  ['symbol-color.svg', 'symbol-color-512.png', 512, 512],
  ['symbol-color-on-dark.svg', 'symbol-color-on-dark-512.png', 512, 512],
  ['social-preview.svg', 'social-preview-1280x640.png', 1280, 640],
]
const lockW = (f) => { const [, , w, h] = fs.readFileSync(path.join(SVG, f), 'utf8').match(/viewBox="([\d.-]+) ([\d.-]+) ([\d.]+) ([\d.]+)"/).slice(1).map(Number); return [1200, Math.round((1200 * h) / w)] }
for (const f of ['lockup-horizontal-color.svg', 'lockup-horizontal-color-on-dark.svg', 'lockup-horizontal-black.svg', 'lockup-horizontal-white.svg', 'wordmark-color.svg', 'lockup-stacked-color.svg']) {
  const [w, h] = lockW(f)
  jobs.push([f, f.replace('.svg', '-1200.png'), w, h])
}
const cdp = await openEdge()
for (const [src, out, w, h] of jobs) await render(cdp, src, path.join(PNG, out), w, h)
cdp.close()

// favicon.ico with PNG-encoded 16/32/48 entries
const pngs = [16, 32, 48].map((s) => [s, fs.readFileSync(path.join(PNG, `favicon-${s}.png`))])
const head = Buffer.alloc(6 + 16 * pngs.length)
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4)
let offset = head.length
pngs.forEach(([s, buf], i) => {
  const o = 6 + 16 * i
  head.writeUInt8(s, o); head.writeUInt8(s, o + 1); head.writeUInt8(0, o + 2); head.writeUInt8(0, o + 3)
  head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6); head.writeUInt32LE(buf.length, o + 8); head.writeUInt32LE(offset, o + 12)
  offset += buf.length
})
fs.writeFileSync(path.join(PNG, 'favicon.ico'), Buffer.concat([head, ...pngs.map(([, b]) => b)]))
try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 }) } catch { /* Edge may still hold its profile; the OS temp cleaner will remove it */ }
console.log(jobs.length, 'PNGs + favicon.ico in', PNG)

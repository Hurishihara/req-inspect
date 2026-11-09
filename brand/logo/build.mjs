// Builds every req-inspect logo SVG from one set of geometry. Run: node brand/logo/build.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'svg')
fs.mkdirSync(OUT, { recursive: true })

export const COLORS = {
  ink: '#1b1f24', // tokens: ink (light)
  inkDark: '#e6e9ef', // tokens: ink (dark)
  indigo: '#4338ca', // tokens: accent (light)
  indigoDark: '#a5b4fc', // tokens: accent (dark)
  tile: '#1b1f24',
}

// ---- Symbol: "ri" with the live dot (256 grid, stems 36, terminal radius 18) ----
const symbolParts = (letters, dot) => `
  <rect fill="${letters}" x="56" y="84" width="36" height="112" rx="4"/>
  <path fill="${letters}" d="M56 134C56 92 86 66 124 66A18 18 0 0 1 124 102C104 102 92 114 92 134Z"/>
  <rect fill="${letters}" x="164" y="124" width="36" height="72" rx="4"/>
  <circle fill="${dot}" cx="182" cy="84" r="22"/>`

// ---- Small-size cut for 16-32 px: heavier stems (48), bigger dot, wider gaps, no spur ----
const smallParts = (letters, dot) => `
  <path fill="${letters}" d="M40 212V140C40 94 74 60 120 60A26 26 0 0 1 120 112C102 112 88 124 88 142V212Z"/>
  <rect fill="${letters}" x="164" y="132" width="52" height="80" rx="4"/>
  <circle fill="${dot}" cx="190" cy="80" r="30"/>`

// ---- Wordmark: monoline lowercase on a 100-unit x-height, stroke 20, baseline y=150 ----
// Built from the same parts as the symbol: flat stem ends, round terminals, circular bowls.
const W = 20
const stem = (x, y1, y2) => `<path d="M${x} ${y1}V${y2}" stroke-linecap="butt"/>`
const wordParts = (ink, dot) => `<g fill="none" stroke="${ink}" stroke-width="${W}" stroke-linecap="round">
  ${stem(10, 50, 150)}<path d="M10 100C10 68 30 50 60 50"/>
  <path d="M100 100H180A40 40 0 1 0 168.3 128.3" stroke-linecap="butt"/><path d="M168.3 128.3l0 0"/>
  <circle cx="260" cy="100" r="40"/>${stem(300, 50, 192)}
  <path d="M344 100H380"/>
  ${stem(424, 50, 150)}
  ${stem(468, 50, 150)}<path d="M468 100A40 40 0 0 1 548 100V150" stroke-linecap="butt"/>
  <path d="M650 64C636 50 596 50 596 76C596 100 652 96 652 122C652 152 606 152 592 136"/>
  ${stem(696, 50, 192)}<circle cx="746" cy="100" r="40"/>
  <path d="M830 100H910A40 40 0 1 0 898.3 128.3" stroke-linecap="butt"/><path d="M898.3 128.3l0 0"/>
  <path d="M1012.3 71.7A40 40 0 1 0 1012.3 128.3"/>
  <path d="M1066 18V122C1066 142 1076 150 1094 150"/><path d="M1044 56H1094"/>
</g><circle fill="${dot}" cx="424" cy="18" r="14"/>`
const WORD_VB = '-8 0 1120 204'

const svg = (vb, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="${title}"><title>${title}</title>${body}\n</svg>\n`

const tile = (body, bg, r = 56) => `<rect width="256" height="256" rx="${r}" fill="${bg}"/>${body}`

const files = {
  // symbol
  'symbol-color.svg': svg('0 0 256 256', symbolParts(COLORS.ink, COLORS.indigo), 'req-inspect'),
  'symbol-color-on-dark.svg': svg('0 0 256 256', symbolParts(COLORS.inkDark, COLORS.indigoDark), 'req-inspect'),
  'symbol-black.svg': svg('0 0 256 256', symbolParts('#000000', '#000000'), 'req-inspect'),
  'symbol-white.svg': svg('0 0 256 256', symbolParts('#ffffff', '#ffffff'), 'req-inspect'),
  'symbol-indigo.svg': svg('0 0 256 256', symbolParts(COLORS.indigo, COLORS.indigo), 'req-inspect'),
  'symbol-small.svg': svg('0 0 256 256', smallParts(COLORS.ink, COLORS.indigo), 'req-inspect'),
  // wordmark
  'wordmark-color.svg': svg(WORD_VB, wordParts(COLORS.ink, COLORS.indigo), 'req-inspect'),
  'wordmark-color-on-dark.svg': svg(WORD_VB, wordParts(COLORS.inkDark, COLORS.indigoDark), 'req-inspect'),
  'wordmark-black.svg': svg(WORD_VB, wordParts('#000000', '#000000'), 'req-inspect'),
  'wordmark-white.svg': svg(WORD_VB, wordParts('#ffffff', '#ffffff'), 'req-inspect'),
  // icons
  'favicon.svg': svg('0 0 256 256', tile(smallParts(COLORS.inkDark, COLORS.indigoDark), COLORS.tile), 'req-inspect'),
  'app-icon.svg': svg('0 0 256 256', tile(`<g transform="translate(32 28) scale(.75)">${symbolParts(COLORS.inkDark, COLORS.indigoDark)}</g>`, COLORS.tile), 'req-inspect'),
}

// Lockups. Horizontal: the symbol (dot top y=62 to baseline y=196 on its grid) is scaled to the wordmark's
// i (dot top y=4 to baseline y=150), so both share a baseline and a top. Gap = one wordmark x-height (100).
// Wordmark i-dot stays ink in lockups so there is one indigo dot: the symbol's.
const H = 204
const lockH = (letters, dot) => {
  const s = (150 - 4) / (196 - 62)
  const ty = 150 - 196 * s
  const left = 56 * s
  const wordX = Math.round(204 * s - left + 100)
  return svg(`0 0 ${wordX + 1112} ${H}`, `<g transform="translate(${(-left).toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})">${symbolParts(letters, dot)}</g><g transform="translate(${wordX} 0)">${wordParts(letters, letters)}</g>`, 'req-inspect')
}
// Stacked: symbol centred above wordmark at 40% width.
const lockS = (letters, dot) => {
  const w = 1120, sym = 448
  return svg(`0 0 ${w} ${sym + 36 + H}`, `<g transform="translate(${(w - sym) / 2} 0) scale(${sym / 256})">${symbolParts(letters, dot)}</g><g transform="translate(8 ${sym + 36})">${wordParts(letters, letters)}</g>`, 'req-inspect')
}
Object.assign(files, {
  'lockup-horizontal-color.svg': lockH(COLORS.ink, COLORS.indigo),
  'lockup-horizontal-color-on-dark.svg': lockH(COLORS.inkDark, COLORS.indigoDark),
  'lockup-horizontal-black.svg': lockH('#000000', '#000000'),
  'lockup-horizontal-white.svg': lockH('#ffffff', '#ffffff'),
  'lockup-stacked-color.svg': lockS(COLORS.ink, COLORS.indigo),
  'lockup-stacked-color-on-dark.svg': lockS(COLORS.inkDark, COLORS.indigoDark),
})

for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(OUT, name), body)
console.log(Object.keys(files).length, 'SVGs written to', OUT)

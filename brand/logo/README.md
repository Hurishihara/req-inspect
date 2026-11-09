# req-inspect logo

The **ri** symbol: the r passes over to the i, and the i's dot is the live signal. It is the one point of color, like the connection dot in the dashboard. The wordmark is drawn from the same parts: flat stem ends, round terminals and circular bowls on a 100-unit x-height.

Open [board.html](board.html) (or [board.png](board.png)) for the presentation with construction, color and mockups.

## Files

| Need | Use |
| --- | --- |
| Header, README, docs | `svg/lockup-horizontal-color.svg` (`-on-dark` for dark backgrounds) |
| Square spaces, social avatar | `svg/lockup-stacked-color.svg`, or the symbol alone |
| Symbol only | `svg/symbol-color.svg`, `-on-dark`, `-black`, `-white`, `-indigo` |
| Below 48 px | `svg/symbol-small.svg` (small cut: heavier stems, wider gaps) |
| Browser tab | `svg/favicon.svg`, `png/favicon.ico` (16/32/48) |
| Home screen, PWA | `png/apple-touch-icon-180.png`, `png/icon-192.png`, `png/icon-512.png`, `svg/app-icon.svg` |
| Slides, chat, anywhere raster | `png/*-1200.png`, `png/symbol-*-512.png` (transparent) |

Rebuild everything from the geometry in [build.mjs](build.mjs) with `node brand/logo/build.mjs`, then `node brand/logo/export.mjs` for the PNGs and ICO. Export needs Microsoft Edge.

## Color

| | Light background | Dark background |
| --- | --- | --- |
| Letters | Ink `#1b1f24` (token `ink`) | `#e6e9ef` (token `ink`, dark) |
| Dot | Indigo `#4338ca` (token `accent`) | `#a5b4fc` (token `accent`, dark) |

- One-color versions (black, white, indigo) are for single-ink printing, embossing, and placing on photos or on indigo.
- The dot is the only colored part. In lockups the wordmark's own i-dot stays ink, so there is one indigo dot.
- Indigo on white is 7.9:1 and the dark dot on the dark background is 9.5:1, so the mark passes WCAG AA at any size.

## Clear space and sizes

- **Clear space:** the dot's diameter on every side, measured at the size used.
- **Minimum size:** the horizontal lockup at 96 px wide (24 mm in print); the symbol at 16 px, using the small cut below 48 px.
- **Lockup proportions are fixed.** The symbol is scaled to the wordmark's i, sharing its top and baseline, with one x-height of space between them. Don't rebuild lockups by hand.

## Don't

- Recolor the letters, or use a color for the dot other than indigo (status green is for the live UI, not the logo).
- Set "req-inspect" in another typeface next to the symbol; use the wordmark files.
- Stretch, rotate, outline, add shadows or gradients, or put the color version on busy backgrounds (use white or black instead).
- Separate the dot from the i, or animate it pulsing.

## Web head snippet

```html
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
```

In the dashboard, this replaces the inline blue-circle data URI in `packages/dashboard/index.html`.

## Notes and open items

- The wordmark SVGs use strokes (monoline construction). Browsers render them exactly; for print vendors or sign-makers, convert strokes to outlines first (Inkscape: *Path → Stroke to Path*; Figma: *Outline stroke*).
- No trademark search has been done. Run one (trademark databases, reverse image search) before public launch.
- Made with hand-written SVG and checked in renders at 16–512 px, light and dark, one-color and reversed. The logo-design skill's Python audit scripts were not run because Python isn't installed on this machine.

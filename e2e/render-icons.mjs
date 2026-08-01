/**
 * Renders the Jamez brand mark (amber dice on deep neutral) into the PNG
 * sizes Expo needs, using headless Chromium. Re-run after tweaking the SVG:
 *   node e2e/render-icons.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const OUT = path.resolve(import.meta.dirname, '..', 'apps', 'mobile', 'assets', 'images')
mkdirSync(OUT, { recursive: true })

const BG = '#0e0e12'
const AMBER = '#fbbf24'

const dice = (scale, fill = AMBER, pip = BG) => `
  <g transform="translate(${(1 - scale) / 2 * 64} ${(1 - scale) / 2 * 64}) scale(${scale})">
    <rect x="10" y="10" width="44" height="44" rx="10" fill="${fill}"/>
    <circle cx="22" cy="22" r="4.5" fill="${pip}"/>
    <circle cx="42" cy="22" r="4.5" fill="${pip}"/>
    <circle cx="32" cy="32" r="4.5" fill="${pip}"/>
    <circle cx="22" cy="42" r="4.5" fill="${pip}"/>
    <circle cx="42" cy="42" r="4.5" fill="${pip}"/>
  </g>`

const svg = (size, { background = null, scale = 1, fill = AMBER, pip = BG } = {}) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
    ${background ? `<rect width="64" height="64" fill="${background}"/>` : ''}
    ${dice(scale, fill, pip)}
  </svg>`

const targets = [
  { file: 'icon.png', size: 1024, opts: { background: BG, scale: 0.86 } },
  { file: 'splash-icon.png', size: 512, opts: { scale: 0.9 } },
  { file: 'android-icon-background.png', size: 432, opts: { background: BG, scale: 0 } },
  { file: 'android-icon-foreground.png', size: 432, opts: { scale: 0.58 } },
  { file: 'android-icon-monochrome.png', size: 432, opts: { scale: 0.58, fill: '#ffffff', pip: 'transparent' } },
  { file: 'favicon.png', size: 48, opts: { background: BG, scale: 0.9 } },
]

const browser = await chromium.launch()
const page = await browser.newPage()
for (const { file, size, opts } of targets) {
  await page.setViewportSize({ width: size, height: size })
  const body = opts.scale === 0 ? svg(size, { ...opts, scale: 0.0001 }) : svg(size, opts)
  await page.setContent(
    `<body style="margin:0;background:transparent">${body}</body>`,
    { waitUntil: 'load' },
  )
  await page.screenshot({ path: path.join(OUT, file), omitBackground: !opts.background })
  console.log(`rendered ${file} (${size}px)`)
}
await browser.close()

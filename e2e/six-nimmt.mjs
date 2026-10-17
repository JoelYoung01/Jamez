/**
 * 6 nimmt! e2e: host + two guests over the local relay.
 *
 *   node e2e/six-nimmt.mjs
 *
 * Expects the web app at BASE_URL (default http://127.0.0.1:5173) and a relay
 * at RELAY_URL (default ws://127.0.0.1:7447).
 */
import { chromium } from 'playwright'
import { copyFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const ARTIFACTS = path.join(ROOT, 'e2e', 'artifacts')
const OUT = '/opt/cursor/artifacts'
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173'
const RELAY = process.env.RELAY_URL ?? 'ws://127.0.0.1:7447'

mkdirSync(ARTIFACTS, { recursive: true })
mkdirSync(OUT, { recursive: true })

function seedProfile(playerId, name, emoji) {
  return `
    window.localStorage.setItem('jamez.profile.v1', ${JSON.stringify(
      JSON.stringify({ state: { playerId, name, emoji }, version: 0 }),
    )})
  `
}

function saveShot(pagePath, name) {
  try {
    copyFileSync(pagePath, path.join(OUT, name))
  } catch {
    // optional
  }
}

const headed = process.env.HEADED === '1'
const browser = await chromium.launch({
  headless: !headed,
  slowMo: headed ? Number(process.env.SLOWMO ?? 60) : 0,
  args: headed ? ['--window-position=80,40', '--window-size=480,1040'] : [],
})
const relayParam = `?relay=${encodeURIComponent(RELAY)}`

try {
  const hostCtx = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })
  const guestBCtx = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })
  const guestCCtx = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })
  await hostCtx.addInitScript(seedProfile('nimmt-host', 'Ada', '🦊'))
  await guestBCtx.addInitScript(seedProfile('nimmt-bea', 'Bea', '🐻'))
  await guestCCtx.addInitScript(seedProfile('nimmt-cal', 'Cal', '🐯'))
  const host = await hostCtx.newPage()
  const bea = await guestBCtx.newPage()
  const cal = await guestCCtx.newPage()
  for (const [label, page] of [
    ['HOST', host],
    ['BEA', bea],
    ['CAL', cal],
  ]) {
    page.on('pageerror', (err) => console.error(`${label} pageerror:`, err))
  }

  const shot = async (page, name) => {
    const file = path.join(ARTIFACTS, `${name}.png`)
    await page.screenshot({ path: file, fullPage: false })
    saveShot(file, `${name}.png`)
    console.log(`  📸 ${name}`)
    if (headed) await page.waitForTimeout(1400)
  }

  console.log('scenario: 6 nimmt')
  await host.goto(`${BASE}/${relayParam}`)
  await host.getByRole('link', { name: /Choose a game/ }).click()
  await host.getByText('6 nimmt!').first().click()
  await host.getByText('Game options').waitFor()
  const target = host.locator('#six-nimmt-target')
  await target.fill('30')
  await shot(host, 'six-nimmt-01-setup')
  await host.getByRole('button', { name: 'Open the lobby' }).click()

  const codeEl = host.locator('.font-mono.text-4xl').first()
  await codeEl.waitFor()
  const code = (await codeEl.innerText()).trim()
  console.log(`  join code: ${code}`)

  await bea.goto(`${BASE}/join/${code}${relayParam}`)
  await cal.goto(`${BASE}/join/${code}${relayParam}`)
  await host.getByText('Bea', { exact: true }).waitFor({ timeout: 15000 })
  await host.getByText('Cal', { exact: true }).waitFor({ timeout: 15000 })
  await shot(host, 'six-nimmt-02-lobby')

  await host.getByRole('button', { name: 'Start', exact: true }).click()
  await host.getByText('Round 1').waitFor({ timeout: 15000 })
  await bea.getByText('Round 1').waitFor({ timeout: 15000 })
  await shot(host, 'six-nimmt-03-play')

  const fillRound = async (page, scores) => {
    for (let i = 0; i < scores.length; i++) {
      const input = page.locator('input.h-12').nth(i)
      await input.click()
      await input.fill(String(scores[i]))
      await page.keyboard.press('Tab')
      await page.waitForTimeout(150)
    }
  }

  // Round 1 typed totals: Ada 12, Bea 5, Cal 2. Nobody has reached 30.
  await fillRound(host, [12, 5, 2])
  await host.getByRole('button', { name: /Start round 2/ }).waitFor({ timeout: 10000 })
  await shot(host, 'six-nimmt-04-round1')

  await host.getByRole('button', { name: /Start round 2/ }).click()
  await host.getByText('Round 2', { exact: true }).waitFor()
  await bea.getByText('Round 2', { exact: true }).waitFor()

  // Ada's pile via the calculator: 55 (7) + 11 (5) + 10 (3) + five 1-point cards = 20.
  await host.getByRole('button', { name: "Count Ada's bullheads" }).click()
  await host.getByRole('button', { name: /^55/ }).click()
  await host.getByRole('button', { name: /^11/ }).click()
  await host.getByLabel('Card number').fill('10')
  await host.getByRole('button', { name: 'Add', exact: true }).click()
  for (let i = 0; i < 5; i++) {
    await host.getByRole('button', { name: 'Add a 1-point card' }).click()
  }
  await host.getByRole('button', { name: 'Use 20' }).waitFor()
  await shot(host, 'six-nimmt-05-calculator')
  await host.getByRole('button', { name: 'Use 20' }).click()

  // Bea scores herself; host scores Cal.
  await bea.locator('input.h-12:not([disabled])').first().fill('4')
  await bea.keyboard.press('Tab')
  await host.locator('input.h-12').nth(2).fill('3')
  await host.keyboard.press('Tab')

  // Ada 32, Bea 9, Cal 5. Ada crossed 30, so Cal (lowest) wins and the match ends.
  await host.getByText(/Cal wins with 5 pts/i).waitFor({ timeout: 15000 })
  await shot(host, 'six-nimmt-06-results')
  await bea.getByText(/Cal wins with 5 pts/i).waitFor({ timeout: 15000 })
  await shot(bea, 'six-nimmt-07-guest-results')
  console.log('  6 nimmt finished ✅')
} catch (err) {
  console.error(err)
  try {
    const pages = browser.contexts().flatMap((c) => c.pages())
    for (const [i, page] of pages.entries()) {
      const file = path.join(ARTIFACTS, `six-nimmt-fail-${i}.png`)
      await page.screenshot({ path: file, fullPage: true }).catch(() => {})
      saveShot(file, `six-nimmt-fail-${i}.png`)
    }
  } catch {
    // ignore
  }
  process.exitCode = 1
} finally {
  await browser.close()
}

/**
 * Flip 7 e2e: three browsers (host + 2 guests) over the local relay against
 * the already-running Vite dev server (or set BASE_URL).
 *
 *   node e2e/flip7.mjs
 *
 * Screenshots land in e2e/artifacts/flip7-*.png and are copied to
 * /opt/cursor/artifacts/ when that dir exists.
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
  const dest = path.join(OUT, name)
  try {
    copyFileSync(pagePath, dest)
  } catch {
    // optional
  }
}

const browser = await chromium.launch()
const relayParam = `?relay=${encodeURIComponent(RELAY)}`

try {
  const hostCtx = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })
  const guestBCtx = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })
  const guestCCtx = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })
  await hostCtx.addInitScript(seedProfile('flip7-host', 'Ada', '🦊'))
  await guestBCtx.addInitScript(seedProfile('flip7-bea', 'Bea', '🐻'))
  await guestCCtx.addInitScript(seedProfile('flip7-cal', 'Cal', '🐯'))
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
  }

  console.log('scenario: flip 7')
  await host.goto(`${BASE}/${relayParam}`)
  await host.getByRole('link', { name: /Choose a game/ }).click()
  await host.getByText('Flip 7').first().click()
  await host.getByText('Game options').waitFor()
  await shot(host, 'flip7-01-setup')
  await host.getByRole('button', { name: 'Open the lobby' }).click()

  const codeEl = host.locator('.font-mono.text-4xl').first()
  await codeEl.waitFor()
  const code = (await codeEl.innerText()).trim()
  console.log(`  join code: ${code}`)

  await bea.goto(`${BASE}/join/${code}${relayParam}`)
  await cal.goto(`${BASE}/join/${code}${relayParam}`)
  await host.getByText('Bea').waitFor({ timeout: 15000 })
  await host.getByText('Cal').waitFor({ timeout: 15000 })
  await shot(host, 'flip7-02-lobby')
  console.log('  guests joined')

  await host.getByRole('button', { name: 'Start', exact: true }).click()
  await host.getByText('Round 1').waitFor({ timeout: 15000 })
  await bea.getByText('Round 1').waitFor({ timeout: 15000 })
  await shot(host, 'flip7-03-play')

  const fillAllOn = async (page, scores) => {
    for (let i = 0; i < scores.length; i++) {
      const input = page.locator('input.h-12').nth(i)
      await input.waitFor({ state: 'visible', timeout: 10000 })
      await input.click({ timeout: 5000 })
      await input.fill(String(scores[i]))
      // Commit via blur without chaining off a possibly-detached handle.
      await page.keyboard.press('Tab')
      await page.waitForTimeout(150)
    }
    await page.waitForTimeout(300)
  }

  // Official pad flow: enter round totals. Host can score everyone.
  // playerIds order = Ada, Bea, Cal (join order).
  await fillAllOn(host, [56, 40, 0])
  await host.getByRole('button', { name: /Start round 2/ }).waitFor({ timeout: 10000 })
  await shot(host, 'flip7-04-round1-scored')

  // Guest self-edit on round 2: Bea updates her own score from her device.
  await host.getByRole('button', { name: /Start round 2/ }).click()
  await host.getByText('Round 2', { exact: true }).waitFor({ timeout: 10000 })
  await bea.getByText('Round 2', { exact: true }).waitFor({ timeout: 10000 })

  // Host fills Ada + Cal; Bea fills herself (only her input is enabled on her device).
  await host.locator('input.h-12').nth(0).fill('80')
  await host.keyboard.press('Tab')
  await host.locator('input.h-12').nth(2).fill('30')
  await host.keyboard.press('Tab')
  await bea.locator('input.h-12:not([disabled])').first().fill('50')
  await bea.keyboard.press('Tab')
  await host.getByRole('button', { name: /Start round 3/ }).waitFor({ timeout: 10000 })
  await shot(host, 'flip7-04b-round2')

  await host.getByRole('button', { name: /Start round 3/ }).click()
  await host.getByText('Round 3', { exact: true }).waitFor({ timeout: 10000 })
  await shot(host, 'flip7-04c-round3-empty')
  await fillAllOn(host, [70, 20, 10])

  await host.getByText(/Ada wins with/i).waitFor({ timeout: 15000 })
  await shot(host, 'flip7-05-results')
  await bea.getByText(/Ada wins with/i).waitFor({ timeout: 15000 })
  await shot(bea, 'flip7-06-guest-results')
  console.log('  flip 7 finished ✅')
} catch (err) {
  console.error(err)
  try {
    const pages = browser.contexts().flatMap((c) => c.pages())
    for (const [i, page] of pages.entries()) {
      const file = path.join(ARTIFACTS, `flip7-fail-${i}.png`)
      await page.screenshot({ path: file, fullPage: false }).catch(() => {})
      saveShot(file, `flip7-fail-${i}.png`)
    }
  } catch {
    // ignore
  }
  process.exitCode = 1
} finally {
  await browser.close()
}

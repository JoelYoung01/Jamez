/**
 * End-to-end smoke test: boots the built web app + a local relay, then drives
 * two real browsers (host + guest) through full Wingspan and Gin Rummy
 * sessions talking to each other over actual WebSockets.
 *
 *   pnpm --filter @jamez/web build && node e2e/smoke.mjs
 *
 * Screenshots land in e2e/artifacts/.
 */
import { startRelay } from '../packages/relay/dist/server.js'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const ARTIFACTS = path.join(ROOT, 'e2e', 'artifacts')
const WEB_PORT = 4173

mkdirSync(ARTIFACTS, { recursive: true })

function seedProfile(playerId, name, emoji) {
  return `
    window.localStorage.setItem('jamez.profile.v1', ${JSON.stringify(
      JSON.stringify({ state: { playerId, name, emoji }, version: 0 }),
    )})
  `
}

async function waitForHttp(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`Server at ${url} did not come up`)
}

async function setStepper(page, labelContains, value) {
  const input = page.locator(`input[aria-label*="${labelContains}"]`)
  await input.fill(String(value))
  await input.press('Enter')
}

let failed = false
const relay = await startRelay({ port: 0 })
console.log(`relay up at ${relay.url}`)

const preview = spawn(
  path.join(ROOT, 'node_modules', '.bin', 'vite'),
  ['preview', '--host', '127.0.0.1', '--port', String(WEB_PORT), '--strictPort'],
  { cwd: path.join(ROOT, 'apps', 'web'), stdio: ['ignore', 'inherit', 'inherit'] },
)

const browser = await chromium.launch()

try {
  await waitForHttp(`http://127.0.0.1:${WEB_PORT}/`)
  console.log('web preview up')

  const base = `http://127.0.0.1:${WEB_PORT}`
  const relayParam = `?relay=${encodeURIComponent(relay.url)}`

  const hostContext = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })
  const guestContext = await browser.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })
  await hostContext.addInitScript(seedProfile('e2e-host-1', 'Hana', '🦉'))
  await guestContext.addInitScript(seedProfile('e2e-guest-1', 'Gale', '🦆'))
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()
  host.on('pageerror', (err) => console.error('HOST pageerror:', err))
  guest.on('pageerror', (err) => console.error('GUEST pageerror:', err))

  const shot = async (page, name) => {
    await page.screenshot({ path: path.join(ARTIFACTS, `${name}.png`), fullPage: false })
    console.log(`  📸 ${name}`)
  }

  // ---------------------------------------------------------------- wingspan
  console.log('scenario: wingspan')
  await host.goto(`${base}/${relayParam}`)
  await shot(host, '01-home')

  // Home is a 2×2 tile grid; Host CTA is "Choose a game".
  await host.getByRole('link', { name: /Choose a game/ }).click()
  await host.getByText('Wingspan').first().click()
  await host.getByText('Game options').waitFor()
  await host.getByRole('button', { name: 'Open the lobby' }).click()

  const codeEl = host.locator('.font-mono.text-4xl').first()
  await codeEl.waitFor()
  const code = (await codeEl.innerText()).trim()
  console.log(`  join code: ${code}`)
  await shot(host, '02-host-lobby-qr')

  await guest.goto(`${base}/join/${code}${relayParam}`)
  await guest.getByText('Waiting for the host to start').waitFor({ timeout: 15000 })
  await host.getByText('Gale').waitFor({ timeout: 15000 })
  console.log('  guest joined')

  await host.getByRole('button', { name: 'Start the game' }).click()
  await guest.getByRole('tab', { name: 'Score sheet' }).waitFor({ timeout: 15000 })

  // Guest fills their own sheet from their device.
  await setStepper(guest, 'Birds', 41)
  await setStepper(guest, 'Bonus cards', 11)
  await setStepper(guest, 'End-of-round goals', 14)
  await setStepper(guest, 'Eggs', 12)
  await setStepper(guest, 'Cached food', 3)
  await setStepper(guest, 'Tucked cards', 6)
  await setStepper(guest, 'Unused food', 2)
  await guest.getByText('87', { exact: true }).waitFor()
  await shot(guest, '03-wingspan-guest-sheet')

  // Host fills its own sheet too (its chip is selected by default).
  await setStepper(host, 'Birds', 55)
  await setStepper(host, 'Eggs', 10)

  // Host watches the standings update live.
  await host.getByRole('tab', { name: 'Standings' }).click()
  await host.getByText('87').first().waitFor({ timeout: 15000 })
  await shot(host, '04-wingspan-host-standings')

  await host.getByRole('button', { name: 'Finish & reveal results' }).click()
  await guest.getByText('Gale wins with 87 pts').waitFor({ timeout: 15000 })
  await shot(guest, '05-wingspan-results')
  console.log('  results synced ✅')

  await host.getByRole('button', { name: 'End session for everyone' }).click()
  await host.getByRole('button', { name: 'Yes, end it' }).click()
  await guest.getByText('Session ended').waitFor({ timeout: 15000 })

  // --------------------------------------------------------------- gin rummy
  console.log('scenario: gin rummy')
  await host.getByRole('button', { name: 'Back home' }).isVisible().catch(() => {})
  await host.goto(`${base}/host/gin-rummy${relayParam}`)
  await host.getByText('Game options').waitFor()
  await shot(host, '06-gin-config')
  await host.getByRole('button', { name: 'Open the lobby' }).click()
  const ginCodeEl = host.locator('.font-mono.text-4xl').first()
  await ginCodeEl.waitFor()
  const ginCode = (await ginCodeEl.innerText()).trim()
  console.log(`  join code: ${ginCode}`)

  await guest.goto(`${base}/join/${ginCode}${relayParam}`)
  await host.getByText('Gale').waitFor({ timeout: 15000 })
  await host.getByRole('button', { name: 'Start the game' }).click()
  await guest.getByText('Record a hand').waitFor({ timeout: 15000 })

  // Hand 1: guest (Gale) goes gin catching 30 -> +55.
  await guest.getByRole('button', { name: 'Gale' }).click()
  await guest.getByRole('button', { name: 'Gin', exact: true }).click()
  await guest.locator('#dd').fill('30')
  await guest.getByText('Gale scores +55').waitFor()
  await guest.getByRole('button', { name: 'Add hand' }).click()

  // Hand 2: host (Hana) knocks with 4 vs 21 -> +17, recorded on host device.
  await host.getByText('55').first().waitFor({ timeout: 15000 })
  await host.getByRole('button', { name: 'Hana' }).click()
  await host.getByRole('button', { name: 'Knock', exact: true }).click()
  await host.locator('#kd').fill('4')
  await host.locator('#dd').fill('21')
  await host.getByText('Hana scores +17').waitFor()
  await host.getByRole('button', { name: 'Add hand' }).click()
  await guest.getByText('Hana knocked with 4 vs 21').waitFor({ timeout: 15000 })
  await shot(guest, '07-gin-play')

  // Hand 3: guest gins again catching 20 -> +45, crossing 100 -> auto-finish.
  await guest.getByRole('button', { name: 'Gale' }).click()
  await guest.getByRole('button', { name: 'Gin', exact: true }).click()
  await guest.locator('#dd').fill('20')
  await guest.getByRole('button', { name: 'Add hand' }).click()

  await host.getByText('Gale wins the match').waitFor({ timeout: 15000 })
  await shot(host, '08-gin-results')
  console.log('  auto-finish at 100 ✅')

  // History saved on the guest's device too.
  await guest.getByRole('button', { name: 'Leave session' }).click()
  await guest.goto(`${base}/history`)
  await guest.getByText('Gale wins the match').waitFor({ timeout: 15000 })
  await shot(guest, '09-history')
  console.log('  local history saved ✅')

  console.log('\nALL SCENARIOS PASSED')
} catch (err) {
  failed = true
  console.error('\nE2E FAILED:', err)
  try {
    for (const [i, context] of browser.contexts().entries()) {
      for (const [j, page] of context.pages().entries()) {
        await page.screenshot({ path: path.join(ARTIFACTS, `failure-${i}-${j}.png`) })
      }
    }
  } catch {
    // best effort
  }
} finally {
  await browser.close()
  preview.kill('SIGTERM')
  await relay.close()
}

process.exit(failed ? 1 : 0)

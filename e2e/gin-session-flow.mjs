/**
 * Focused verification for gin / match session chrome changes.
 * Uses the already-running Vite + relay (5173 / 7447).
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ARTIFACTS = '/opt/cursor/artifacts'
const RELAY_Q = 'relay=ws://localhost:7447'
mkdirSync(ARTIFACTS, { recursive: true })

function seedProfile(playerId, name, emoji) {
  return `
    window.localStorage.setItem('jamez.profile.v1', ${JSON.stringify(
      JSON.stringify({ state: { playerId, name, emoji }, version: 0 }),
    )})
  `
}

function seedRoster() {
  return `
    window.localStorage.setItem('jamez.player-roster.v1', ${JSON.stringify(
      JSON.stringify({
        state: {
          entries: [
            {
              id: 'recent-1',
              name: 'Grandma',
              emoji: '👵',
              source: 'local',
              lastPlayedAt: Date.now(),
            },
          ],
        },
        version: 0,
      }),
    )})
  `
}

async function addLocalNamed(page, name) {
  await page.getByRole('button', { name: /Add local player/i }).click()
  await page.getByRole('tab', { name: 'Create new' }).click()
  await page.getByRole('textbox', { name: 'Name' }).fill(name)
  await page.getByRole('button', { name: 'Add player' }).click()
  await page.getByText(name, { exact: true }).waitFor()
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 420, height: 900 },
    recordVideo: { dir: ARTIFACTS, size: { width: 420, height: 900 } },
  })
  const page = await context.newPage()
  const results = []

  await page.addInitScript(seedProfile('host-test', 'Alex', '🎲'))
  await page.addInitScript(seedRoster())

  // --- Host config: no Pass & Play for gin ---
  await page.goto(`http://localhost:5173/host/gin-rummy?${RELAY_Q}`, { waitUntil: 'networkidle' })
  results.push({ check: 'gin host has no Pass & Play', pass: (await page.locator('#pass-and-play').count()) === 0 })
  // Low target so one hand finishes the match (Rematch + Exit path later)
  await page.getByLabel('Play to').fill('10')
  await page.screenshot({ path: path.join(ARTIFACTS, 'gin-host-config-no-passplay.png'), fullPage: true })

  await page.getByRole('button', { name: 'Open the lobby' }).click()
  await page.waitForURL(/\/session\//)
  await page.getByRole('button', { name: /Add local player/i }).waitFor()

  const lobbyOk = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('button')].map(
      (e) => e.getAttribute('aria-label') || e.textContent?.replace(/\s+/g, ' ').trim() || '',
    )
    const hasStart = labels.some((l) => l === 'Start' || l.includes('players to start'))
    const hasCancel = labels.some((l) => l === 'Cancel' || l.includes('Cancel'))
    const hasClose = labels.some((l) => l.includes('Close for now'))
    return hasStart && hasCancel && !hasClose
  })
  results.push({
    check: 'lobby has Start and Cancel, no Close for now',
    pass: lobbyOk,
  })
  await page.screenshot({ path: path.join(ARTIFACTS, 'gin-lobby-start-cancel.png'), fullPage: true })

  // --- Add local player tabs ---
  await page.getByRole('button', { name: /Add local player/i }).click()
  await page.getByRole('tab', { name: 'Recent' }).waitFor()
  results.push({
    check: 'add-local-player has Recent and Create new tabs',
    pass:
      (await page.getByRole('tab', { name: 'Recent' }).count()) === 1 &&
      (await page.getByRole('tab', { name: 'Create new' }).count()) === 1,
  })
  await page.getByText('Grandma').waitFor()
  results.push({
    check: 'recent suggestion has remove control',
    pass: (await page.getByRole('button', { name: /Remove Grandma from suggestions/i }).count()) === 1,
  })
  await page.screenshot({ path: path.join(ARTIFACTS, 'gin-add-local-player-tabs.png'), fullPage: true })

  await page.getByRole('tab', { name: 'Create new' }).click()
  await page.getByRole('textbox', { name: 'Name' }).fill('Bob')
  await page.getByRole('button', { name: 'Add player' }).click()
  await page.getByText('Bob', { exact: true }).waitFor()

  await page.getByRole('button', { name: 'Start' }).click()
  await page.getByRole('button', { name: 'Close for now' }).waitFor()
  results.push({
    check: 'playing has Close for now + End Game only',
    pass:
      (await page.getByRole('button', { name: 'Close for now' }).count()) === 1 &&
      (await page.getByRole('button', { name: 'End Game' }).count()) === 1 &&
      (await page.getByRole('button', { name: /Finish & reveal/i }).count()) === 0,
  })
  await page.screenshot({ path: path.join(ARTIFACTS, 'gin-playing-controls.png'), fullPage: true })

  await page.getByRole('button', { name: 'Gin', exact: true }).click()
  const placeholders = await page.locator('input[placeholder]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('placeholder')),
  )
  results.push({
    check: 'gin outcome: non-knocker placeholder is not after layoffs',
    pass: placeholders.includes('deadwood') && !placeholders.includes('after layoffs'),
  })
  await page.screenshot({ path: path.join(ARTIFACTS, 'gin-placeholder-deadwood.png'), fullPage: true })

  // --- Natural finish → Rematch + Exit ---
  // Enter deadwood for knocker path: knock with scores that exceed target 10.
  await page.getByRole('button', { name: 'Knock', exact: true }).click()
  const deadwoodInputs = page.locator('input:not([disabled])')
  // Fill both editable deadwoods if knock; knocker needs 1-10
  const count = await deadwoodInputs.count()
  for (let i = 0; i < count; i++) {
    await deadwoodInputs.nth(i).fill(i === 0 ? '5' : '20')
  }
  await page.getByRole('button', { name: 'Add hand' }).click()
  // May need another hand depending on scoring; if not finished, End Game path separately.
  const rematch = page.getByRole('button', { name: 'Rematch' })
  const exitBtn = page.getByRole('button', { name: 'Exit' })
  let finishedOk = false
  try {
    await rematch.waitFor({ timeout: 3000 })
    finishedOk =
      (await rematch.count()) === 1 &&
      (await exitBtn.count()) === 1 &&
      (await page.getByRole('button', { name: /Close for now/i }).count()) === 0
  } catch {
    finishedOk = false
  }
  if (finishedOk) {
    await page.screenshot({ path: path.join(ARTIFACTS, 'gin-finished-rematch-exit.png'), fullPage: true })
    await exitBtn.click()
    await page.waitForURL((url) => !url.pathname.includes('/session/'))
  } else {
    // Fallback: End Game as draw
    await page.getByRole('button', { name: 'End Game' }).click()
    await page.getByRole('button', { name: 'Yes, end it' }).click()
    await page.waitForURL((url) => !url.pathname.includes('/session/'))
  }
  results.push({
    check: 'finished shows Rematch + Exit (or End Game draw fallback ran)',
    pass: true, // we always exit one of the two paths
  })
  results.push({
    check: 'finished Rematch + Exit buttons when match completes',
    pass: finishedOk,
  })

  await page.goto(`http://localhost:5173/history?${RELAY_Q}`, { waitUntil: 'networkidle' })
  results.push({
    check: 'history has a finished gin entry',
    pass: (await page.getByText(/Gin Rummy|Draw|wins/i).count()) > 0,
  })
  await page.screenshot({ path: path.join(ARTIFACTS, 'gin-draw-history.png'), fullPage: true })

  // --- Live room + old history opens detail ---
  await page.goto(`http://localhost:5173/host/gin-rummy?${RELAY_Q}`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Open the lobby' }).click()
  await page.waitForURL(/\/session\//)
  await addLocalNamed(page, 'Chris')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.getByRole('button', { name: 'Close for now' }).waitFor()
  const liveUrl = page.url()

  await page.goto(`http://localhost:5173/history?${RELAY_Q}`, { waitUntil: 'networkidle' })
  const histBtn = page.locator('main button, button').filter({ hasText: /Draw|wins|leads|tie/i }).first()
  let historyNavOk = false
  if ((await histBtn.count()) > 0) {
    await histBtn.click()
    await page.waitForTimeout(800)
    historyNavOk = /\/history\//.test(page.url()) && !/\/session\//.test(page.url())
  }
  results.push({
    check: 'history row with live room opens detail not session',
    pass: historyNavOk,
  })
  await page.screenshot({ path: path.join(ARTIFACTS, 'history-opens-detail.png'), fullPage: true })

  await page.goto(liveUrl)
  await page.getByRole('button', { name: 'Close for now' }).click()
  await page.getByRole('button', { name: 'Yes, park it' }).click()
  await page.waitForURL((url) => !url.pathname.includes('/session/'))

  // --- Cancel hard-deletes lobby (back arrow = Cancel) ---
  await page.goto(`http://localhost:5173/host/gin-rummy?${RELAY_Q}`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Open the lobby' }).click()
  await page.waitForURL(/\/session\//)
  const lobbyCode = page.url().match(/session\/([A-Z0-9]+)/)?.[1]
  await page.getByRole('button', { name: 'Cancel', exact: true }).last().click()
  await page.waitForURL((url) => !url.pathname.includes('/session/'), { timeout: 10000 })
  await page.goto(`http://localhost:5173/continue?${RELAY_Q}`, { waitUntil: 'networkidle' })
  results.push({
    check: 'Cancel hard-deletes lobby draft from device',
    pass: lobbyCode ? (await page.getByText(lobbyCode).count()) === 0 : false,
  })
  await page.screenshot({ path: path.join(ARTIFACTS, 'gin-cancel-deleted.png'), fullPage: true })

  writeFileSync(path.join(ARTIFACTS, 'gin-session-flow-results.json'), JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
  const failed = results.filter((r) => !r.pass)
  const videoPath = await page.video()?.path()
  await context.close()
  await browser.close()
  if (videoPath) {
    const { renameSync } = await import('node:fs')
    renameSync(videoPath, path.join(ARTIFACTS, 'gin-session-flow-demo.webm'))
    console.log('Saved video to gin-session-flow-demo.webm')
  }
  if (failed.length) {
    console.error('FAILED', failed)
    process.exit(1)
  }
  console.log('All checks passed')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

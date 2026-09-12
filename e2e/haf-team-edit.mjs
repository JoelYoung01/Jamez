/**
 * Hand & Foot team-edit dialog walkthrough against the Vite + local relay.
 *
 *   BASE_URL=http://localhost:5173 RELAY_URL=ws://localhost:7447 node e2e/haf-team-edit.mjs
 */
import { chromium } from 'playwright'
import { copyFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const ARTIFACTS = path.join(ROOT, 'e2e', 'artifacts')
const OUT = '/opt/cursor/artifacts'
const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const RELAY = process.env.RELAY_URL ?? 'ws://localhost:7447'

mkdirSync(ARTIFACTS, { recursive: true })
mkdirSync(OUT, { recursive: true })

function seedProfile(playerId, name, emoji) {
  return `
    window.localStorage.setItem('jamez.profile.v1', ${JSON.stringify(
      JSON.stringify({ state: { playerId, name, emoji }, version: 0 }),
    )})
  `
}

function publish(file, name) {
  try {
    copyFileSync(file, path.join(OUT, name))
  } catch {
    /* optional */
  }
}

const browser = await chromium.launch()
const relayParam = `?relay=${encodeURIComponent(RELAY)}`

try {
  const ctx = await browser.newContext({
    viewport: { width: 420, height: 900 },
    deviceScaleFactor: 2,
    recordVideo: { dir: ARTIFACTS, size: { width: 420, height: 900 } },
  })
  await ctx.addInitScript(seedProfile('haf-host', 'Hana', '🦉'))
  const page = await ctx.newPage()
  page.on('pageerror', (err) => console.error('pageerror:', err))

  const shot = async (name) => {
    const file = path.join(ARTIFACTS, `${name}.png`)
    await page.screenshot({ path: file, fullPage: false })
    publish(file, `${name}.png`)
    console.log(`  📸 ${name}`)
  }

  console.log('scenario: hand & foot team edit dialog')
  await page.goto(`${BASE}/${relayParam}`)
  await page.getByRole('link', { name: /Choose a game|Host a game|Browse games/i }).first().click()
  // Shelf may already be open via "Host"
  if (await page.getByText('Hand & Foot').first().isVisible().catch(() => false)) {
    await page.getByText('Hand & Foot').first().click()
  } else {
    await page.goto(`${BASE}/host${relayParam}`)
    await page.getByText('Hand & Foot').first().click()
  }

  await page.getByText('Game options').waitFor()
  await page.getByText('Partners (2)').click()
  // Enable Pass & Play
  const pap = page.locator('#pass-and-play')
  if (!(await pap.isChecked())) await pap.click()
  await page.getByRole('button', { name: 'Open the lobby' }).click()

  // Host is seated; add 3 locals → 4 players → 2 partner teams
  for (const [name, emoji] of [
    ['Gale', '🌈'],
    ['Remy', '🌙'],
    ['Dee', '⭐'],
  ]) {
    await page.getByRole('button', { name: /Add local player/i }).click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor()
    // Prefer create-new path
    await dialog.locator('input').first().fill(name)
    // Emoji picker: click the emoji button if present, else leave default
    const emojiBtn = dialog.getByRole('button', { name: emoji })
    if (await emojiBtn.count()) await emojiBtn.click()
    await dialog.getByRole('button', { name: /Add player/i }).click()
    await page.getByText(name, { exact: true }).first().waitFor({ timeout: 10000 })
  }

  await shot('haf-edit-01-lobby')
  await page.getByRole('button', { name: /Start the game/i }).click()
  await page.getByText('Round 1').waitFor({ timeout: 15000 })
  await shot('haf-edit-02-play-before')

  // Open first team's edit dialog from standings (not the session nickname pencil)
  await page.getByRole('button', { name: /^Edit Hana/ }).first().click()
  const edit = page.getByRole('dialog').filter({ hasText: 'Edit team' })
  await edit.waitFor({ timeout: 10000 })
  await shot('haf-edit-03-dialog-open')

  // Rename
  const nameInput = edit.locator('input').first()
  await nameInput.fill('Redbirds')
  await nameInput.blur()
  await page.waitForTimeout(200)

  // Move second member of this team to the other team (if present)
  const moveSelect = edit.locator('select').first()
  if (await moveSelect.count()) {
    const options = await moveSelect.locator('option').allTextContents()
    const target = options.find((o) => o && o !== 'Move to…')
    if (target) {
      await moveSelect.selectOption({ label: target })
      await page.waitForTimeout(300)
    }
  }

  // Split / own team if still available
  const ownTeam = edit.getByRole('button', { name: /Own team/i })
  if (await ownTeam.count()) {
    await ownTeam.first().click()
    await page.waitForTimeout(300)
  }

  // Add new player onto this team
  await edit.getByRole('button', { name: /Add new player/i }).click()
  const addDlg = page.getByRole('dialog').filter({ hasText: /Add player to team/i })
  await addDlg.waitFor()
  await addDlg.locator('input').first().fill('Kai')
  await addDlg.getByRole('button', { name: /Add to team/i }).click()
  await page.waitForTimeout(400)
  await shot('haf-edit-04-after-edits')

  await edit.getByRole('button', { name: /^Done$/ }).click()
  await page.waitForTimeout(300)
  await page.getByText('Redbirds').first().waitFor({ timeout: 10000 })
  await shot('haf-edit-05-play-after')

  console.log('  ✅ team edit dialog flow ok')

  const video = page.video()
  await ctx.close()
  if (video) {
    const vpath = await video.path()
    const dest = path.join(ARTIFACTS, 'haf-team-edit-demo.webm')
    try {
      const { renameSync } = await import('node:fs')
      renameSync(vpath, dest)
    } catch {
      copyFileSync(vpath, dest)
    }
    publish(dest, 'haf-team-edit-demo.webm')
    console.log('  🎥 haf-team-edit-demo.webm')
  }
} finally {
  await browser.close()
}

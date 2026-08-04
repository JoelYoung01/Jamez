import os from 'node:os'
import { startRelay } from './server'

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const port = Number(argValue('--port') ?? 7447)
const host = argValue('--host') ?? '0.0.0.0'

const handle = await startRelay({ port, host, verbose: true })

console.log('')
console.log('  Jamez relay running (in-memory, stores nothing)')
console.log('')
console.log(`  Local:    ws://localhost:${handle.port}`)
for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
  for (const addr of addresses ?? []) {
    if (addr.family === 'IPv4' && !addr.internal) {
      console.log(`  Network:  ws://${addr.address}:${handle.port}  (${name})`)
    }
  }
}
console.log('')
console.log('  Point the app at one of these URLs from Settings -> Relays')
console.log('  to play fully offline on this network. Ctrl+C to stop.')
console.log('')

process.on('SIGINT', async () => {
  await handle.close()
  process.exit(0)
})

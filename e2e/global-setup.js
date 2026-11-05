// EDITOR: STEVEN
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { loadTestEnv, resolveGate, VARS } from '../tests/support/supabaseGate.js'
import { redact } from '../tests/support/redact.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

// Run the Supabase preflight once and pass only its enabled state and reason to workers.
export default async function globalSetup() {
  const mode = process.env.CI ? 'production' : 'development'
  const env = loadTestEnv(mode, ROOT)
  const { enabled, reason } = await resolveGate(env)
  const known = [...VARS.base, ...VARS.account, ...VARS.host].map((name) => env[name])
  process.env.ZOOT_SUPABASE_GATE = JSON.stringify({
    enabled,
    reason: reason === null ? null : redact(reason, known),
  })
}

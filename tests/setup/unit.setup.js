// EDITOR: STEVEN
import { afterAll, afterEach } from 'vitest'
import { installNetworkGuard } from '../support/networkGuard.js'

// Unit tests block network access; tests stub any required responses explicitly.
const guard = installNetworkGuard({ allow: () => false })

function failOnBlocked() {
  const list = guard.take()
  if (list.length === 0) return
  const detail = list.map(({ method, url }) => `${method} ${url}`).join(', ')
  throw new Error(`Blocked ${list.length} network request(s): ${detail}`)
}

afterEach(failOnBlocked)
afterAll(failOnBlocked)

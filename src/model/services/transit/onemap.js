// EDITOR: KAYRA
/**
 * OneMap public-transport routes, through our /api/transit proxy (it holds the login).
 * fromOneMap(from, to) -> Promise<{ coords, parts, minutes, source: 'onemap' } | null>
 * A 503 means the server has no OneMap login, so we stop asking for the rest of the session.
 */
import { HUBS, hubByCode, rideDirection } from './network.js'

const TIMEOUT_MS = 9000
let oneMapAvailable = true

export async function fromOneMap(from, to) {
  if (!oneMapAvailable) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch('/api/transit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start: [from.lng, from.lat], end: [to.lng, to.lat], endName: to.name }),
      signal: ctrl.signal
    })
    // 503 = no keys on the server; a non-JSON reply = no API at all (static preview).
    if (res.status === 503 || !res.headers.get('content-type')?.includes('json')) oneMapAvailable = false
    if (!res.ok || !oneMapAvailable) return null
    const json = await res.json()
    if (!json.parts?.length || json.parts.some((p) => p.coords.length < 2 && p.mode !== 'walk')) return null
    json.parts.forEach(fromOurNetwork)
    return { coords: json.parts.flatMap((p) => p.coords), parts: json.parts, minutes: json.minutes, source: 'onemap' }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * OneMap names stations "PAYA LEBAR MRT STATION" and gives trains no direction. Using the
 * station codes it does send, take the proper names and the direction from our MRT network.
 */
function fromOurNetwork(part) {
  for (const end of [part.from, part.to]) {
    const hub = hubByCode(end?.code)
    if (hub) end.name = HUBS[hub].name
  }
  if (part.mode !== 'mrt') return
  const from = hubByCode(part.from?.code)
  const next = hubByCode(part.nextStop?.code) || hubByCode(part.to?.code)
  part.nextStop = next ? HUBS[next].name : part.nextStop?.name || null
  if (!from || !next) return
  const { towards, loop } = rideDirection(part.line, from, next)
  part.towards = towards ? HUBS[towards].name : part.towards
  part.loop = loop
}

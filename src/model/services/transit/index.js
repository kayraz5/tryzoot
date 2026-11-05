// EDITOR: KAYRA
/**
 * Public transport: the one place the rest of the app imports from.
 *
 *   getTransitRoute(from, to)     -> Promise<{ coords, parts, minutes, source } | null>
 *     1. OneMap (onemap.js): real bus + MRT itineraries, when the server has a login.
 *     2. Otherwise our own: the MRT (mrt.js) or one direct bus (bus.js), whichever is
 *        quicker door to door, with the train preferred for first-timers.
 *   getBusAlternative(from, to)   -> Promise<{ service, stop, minutes } | null>
 *     A single bus that does the job, shown when a leg would otherwise be a taxi.
 *
 * A route is a list of `parts` (walk / mrt / bus, each with its own line on the map);
 * steps.js turns them into plain-language steps. Never throws; null means "keep what you had".
 *
 *   network.js  MRT graph and directions     mrt.js    walk → train(s) → walk
 *   bus.js      bus data, direct bus, live   onemap.js OneMap via /api/transit
 *   walk.js     walking legs (indoor hops)   steps.js  parts → steps, map pins
 */
import { getMrtRoute } from './mrt.js'
import { findDirectBus } from './bus.js'
import { fromOneMap } from './onemap.js'

export { transitSteps, currentPartIndex, transferPoints, partColour, lineInfo } from './steps.js'
export { loadBusData, nearbyStops, getBusArrivals } from './bus.js'

const cache = new Map()

async function fromLocal(from, to) {
  const [mrt, bus] = await Promise.all([
    getMrtRoute(from, to).catch(() => null),
    findDirectBus(from, to).catch(() => null)
  ])
  // Prefer the train unless the bus saves real time: trains are easier for first-timers.
  const best = mrt && (!bus || mrt.minutes <= bus.minutes + 5) ? mrt : bus
  return best && { ...best, source: 'local' }
}

export function getTransitRoute(from, to) {
  const key = [from.lng, from.lat, to.lng, to.lat].map((n) => n.toFixed(4)).join(',')
  if (!cache.has(key)) {
    const job = fromOneMap(from, to).then((r) => r || fromLocal(from, to))
    cache.set(key, job)
    job.then((r) => {
      if (!r) cache.delete(key)
    })
  }
  return cache.get(key)
}

export async function getBusAlternative(from, to) {
  const route = await findDirectBus(from, to).catch(() => null)
  const bus = route?.parts.find((p) => p.mode === 'bus')
  return bus ? { service: bus.service, stop: bus.from.name, minutes: route.minutes } : null
}

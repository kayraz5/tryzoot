import { distanceM } from './distance.js'
import { HUBS, rideMinutes, rideRuns, lineColours } from './transit/network.js'

// Re-exported: most of the app reaches for these through travel.js.
export { distanceM, HUBS }

/**
 * Travel-time model. Groq never produces minutes; this file does.
 *   walk  = Turf great-circle distance × 1.3 detour ÷ 80 m/min
 *   mrt   = walk to nearest hub + 4 min wait + graph ride (+4 min per line change) + walk from hub
 *   taxi  = distance × 1.35 ÷ 28 km/h + 6 min pickup (only when no MRT hub is walkable)
 * The MRT graph itself (stations, lines, which way to ride) lives in transit/network.js.
 */

export const WALK_M_PER_MIN = 80
const DETOUR = 1.3
const MRT_WAIT_MIN = 4
const MAX_HUB_WALK_MIN = 15
export const MRT_THRESHOLD_MIN = 18
// Trains run roughly 05:30–23:30 SGT (last trains vary by line); outside that we plan a taxi.
const MRT_OPEN_MIN = 5 * 60 + 30
const MRT_CLOSE_MIN = 23 * 60 + 30

export function mrtRunning(ms) {
  if (ms == null) return true
  const d = new Date(ms + 8 * 3600e3)
  const m = d.getUTCHours() * 60 + d.getUTCMinutes()
  return m >= MRT_OPEN_MIN && m < MRT_CLOSE_MIN
}

export function walkMinutes(a, b) {
  return Math.max(1, Math.round((distanceM(a, b) * DETOUR) / WALK_M_PER_MIN))
}

export function nearestHub(p) {
  let best = null
  for (const [id, h] of Object.entries(HUBS)) {
    const d = distanceM(p, h)
    if (!best || d < best.d) best = { id, d, hub: h }
  }
  return { id: best.id, ...best.hub, walk_min: Math.max(1, Math.round((best.d * DETOUR) / WALK_M_PER_MIN)) }
}

/** Exported so transit/mrt.js can get at the hub ids + per-hop line sequence, not just the minutes. */
export function transit(a, b) {
  const ha = nearestHub(a)
  const hb = nearestHub(b)
  if (ha.id === hb.id) return null
  if (ha.walk_min > MAX_HUB_WALK_MIN || hb.walk_min > MAX_HUB_WALK_MIN) return null
  const ride = rideMinutes(ha.id, hb.id)
  if (!ride) return null
  return {
    minutes: ha.walk_min + MRT_WAIT_MIN + ride.minutes + hb.walk_min,
    from: ha.name,
    to: hb.name,
    fromHub: ha.id,
    toHub: hb.id,
    walkMin: ha.walk_min + hb.walk_min,
    walkToHubMin: ha.walk_min,
    walkFromHubMin: hb.walk_min,
    waitMin: MRT_WAIT_MIN,
    lines: ride.lines,
    path: ride.path,
    edgeLines: ride.edgeLines,
    runs: rideRuns(ride)
  }
}

/** Door-to-door taxi/Grab estimate: detoured road distance at 28 km/h plus pickup. */
export function taxiMinutes(a, b) {
  return Math.round(((distanceM(a, b) * 1.35) / 1000 / 28) * 60 + 6)
}

/**
 * Pick a travel mode between two {lat,lng} points.
 * @param {{maxWalk?: number, style?: string, atMs?: number}} opts  atMs = departure time (MRT closes at night)
 * @returns {{mode:'walk'|'mrt'|'taxi', minutes:number, walk_min:number, distance_m:number, detail:string}}
 */
export function travel(a, b, opts = {}) {
  const maxWalk = Math.min(opts.maxWalk ?? MRT_THRESHOLD_MIN, MRT_THRESHOLD_MIN)
  const walk = walkMinutes(a, b)
  const distance_m = Math.round(distanceM(a, b))
  const onFoot = { mode: 'walk', minutes: walk, walk_min: walk, distance_m, detail: `${distance_m} m on foot` }
  if (walk <= maxWalk) return onFoot

  const t = mrtRunning(opts.atMs) ? transit(a, b) : null
  const taxi = taxiMinutes(a, b)
  const byMrt = t && { mode: 'mrt', minutes: t.minutes, walk_min: walk, distance_m, detail: `MRT ${t.from} → ${t.to} · ${lineColours(t.lines)}` }
  const byTaxi = (why) => ({ mode: 'taxi', minutes: taxi, walk_min: walk, distance_m, detail: `Taxi / Grab · ${why}` })
  // Budget travellers ride the MRT; others take a cab when it saves 20+ min.
  const mrtOrTaxi = () => (opts.style !== 'budget' && taxi + 20 < t.minutes ? byTaxi(`saves ${t.minutes - taxi} min vs MRT`) : byMrt)

  // Over the walking limit: take the train if it is roughly as quick as walking.
  if (t && t.minutes <= walk + 8) return mrtOrTaxi()
  // MRT is much slower (awkward transfers) and the walk is still sane: walk it.
  if (walk <= 30) return onFoot
  if (t) return mrtOrTaxi()
  return byTaxi(mrtRunning(opts.atMs) ? 'no MRT nearby' : 'MRT closed at this hour')
}

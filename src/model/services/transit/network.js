import network from '../../data/mrtNetwork.sg.json'
import { LINES } from '../../data/transitLines.js'
import { distanceM } from '../distance.js'

/**
 * The MRT network as a graph (pnpm sync:transit → mrtNetwork.sg.json):
 *   HUBS            every station by id, with its codes and exits
 *   rideMinutes()   quickest ride between two stations, changes included
 *   rideRuns()      that ride split into one run per train, each with its direction
 *   rideDirection() which way to ride: the terminus, or clockwise / anti-clockwise on a loop
 *   hubByCode()     station id from a code like "CC19" (OneMap names stations by code)
 * Walking and taxi times, and choosing between them, are in ../travel.js.
 */

const TRANSFER_MIN = 4 // added per line change

// Every MRT station (pnpm sync:transit), keyed by a name slug: `changi_airport`, `city_hall`…
// The Sentosa Express isn't in that dataset, so its two island stops are added by hand.
export const HUBS = {}
for (const [id, s] of Object.entries(network.stations)) {
  HUBS[id] = { name: s.name, code: s.codes.filter((c) => !/^[A-Z]{2}0$/.test(c)).join('/'), lat: s.lat, lng: s.lng, exits: s.exits }
}
HUBS.rws = { name: 'Resorts World (Sentosa Express)', code: 'SE2', lat: 1.2557, lng: 103.8210, exits: [] }
HUBS.beach = { name: 'Beach (Sentosa Express)', code: 'SE3', lat: 1.2535, lng: 103.8174, exits: [] }

/** Ride time between neighbouring stations: track ≈ 1.15 × straight line at 55 km/h, plus a 30 s stop. */
const hopMinutes = (a, b) => (distanceM(HUBS[a], HUBS[b]) * 1.15) / (55000 / 60) + 0.5

// [from, to, ride minutes, line]: consecutive stations along each line, plus loop links.
const EDGES = []
for (const [line, { stations, links }] of Object.entries(network.lines)) {
  for (let i = 1; i < stations.length; i++) EDGES.push([stations[i - 1], stations[i], hopMinutes(stations[i - 1], stations[i]), line])
  for (const [a, b] of links) EDGES.push([a, b, hopMinutes(a, b), line])
}
EDGES.push(['harbourfront', 'rws', 5, 'SE'], ['rws', 'beach', 3, 'SE'])

const ADJ = {}
for (const [a, b, t, line] of EDGES) {
  ;(ADJ[a] ||= []).push({ to: b, t, line })
  ;(ADJ[b] ||= []).push({ to: a, t, line })
}

const rideCache = new Map()

/**
 * Shortest ride between hubs with a transfer penalty. Dijkstra over (hub, line) states.
 * `path` (hub ids visited, start to end) and `edgeLines` (the line each hop in `path` rode)
 * exist so transit/mrt.js can slice real track geometry per line-segment of a multi-transfer
 * ride — `lines` alone only gives the deduped set of lines used, not where each one starts
 * and ends along the path, which is what the slicer needs.
 */
export function rideMinutes(fromHub, toHub) {
  if (fromHub === toHub) return { minutes: 0, lines: [], path: [fromHub], edgeLines: [] }
  const key = fromHub + '>' + toHub
  if (rideCache.has(key)) return rideCache.get(key)
  const best = new Map()
  const queue = [{ node: fromHub, line: null, cost: 0, lines: [], path: [fromHub], edgeLines: [] }]
  let result = null
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost)
    const cur = queue.shift()
    const stateKey = cur.node + '|' + cur.line
    if (best.has(stateKey) && best.get(stateKey) <= cur.cost) continue
    best.set(stateKey, cur.cost)
    if (cur.node === toHub) { result = { minutes: Math.round(cur.cost), lines: cur.lines, path: cur.path, edgeLines: cur.edgeLines }; break }
    for (const e of ADJ[cur.node] || []) {
      const change = cur.line && cur.line !== e.line ? TRANSFER_MIN : 0
      const lines = cur.line === e.line ? cur.lines : [...cur.lines, e.line]
      queue.push({ node: e.to, line: e.line, cost: cur.cost + e.t + change, lines, path: [...cur.path, e.to], edgeLines: [...cur.edgeLines, e.line] })
    }
  }
  rideCache.set(key, result)
  return result
}

/** Line position of a station, for working out which way a train is heading. */
function lineIndex(line, hub) {
  return network.lines[line]?.stations.indexOf(hub) ?? -1
}

// Station code ("CC19") → hub id, for routes that name stations by code (OneMap).
const HUB_BY_CODE = {}
for (const [id, s] of Object.entries(network.stations)) for (const code of s.codes) HUB_BY_CODE[code] = id
export const hubByCode = (code) => (code && HUB_BY_CODE[code]) || null

// Loop lines (Circle): the stations on the ring itself (the loop link closes it) and the
// ring's centre, to tell clockwise from anti-clockwise. Stations off the ring are a spur.
const RINGS = {}
for (const [line, { stations, links }] of Object.entries(network.lines)) {
  if (!LINES[line]?.loop || !links?.length) continue
  const [i, j] = links[0].map((hub) => stations.indexOf(hub)).sort((x, y) => x - y)
  const ring = stations.slice(i, j + 1)
  const centre = { lat: ring.reduce((sum, h) => sum + HUBS[h].lat, 0) / ring.length, lng: ring.reduce((sum, h) => sum + HUBS[h].lng, 0) / ring.length }
  RINGS[line] = { hubs: new Set(ring), centre }
}

/**
 * Which way to ride from `fromHub` when the next stop is `nextHub`:
 *   { towards: terminus hub id, or null; loop: 'clockwise' | 'anti-clockwise' | null }
 * On a loop line there is no terminus, so it says which way round the ring the train goes
 * (as on a north-up map); on the loop's spur, only the end of the spur is a real terminus.
 */
export function rideDirection(line, fromHub, nextHub) {
  const ring = RINGS[line]
  if (ring?.hubs.has(fromHub) && ring.hubs.has(nextHub)) {
    const a = HUBS[fromHub]
    const b = HUBS[nextHub]
    const c = ring.centre
    const cross = (a.lng - c.lng) * (b.lat - c.lat) - (a.lat - c.lat) * (b.lng - c.lng)
    return { towards: null, loop: cross > 0 ? 'anti-clockwise' : 'clockwise' }
  }
  const stations = network.lines[line]?.stations
  const i = lineIndex(line, fromHub)
  const j = lineIndex(line, nextHub)
  if (!stations || i < 0 || j < 0) return { towards: null, loop: null }
  if (LINES[line]?.loop) return { towards: j < i ? stations[0] : null, loop: null }
  return { towards: j > i ? stations.at(-1) : stations[0], loop: null }
}

/**
 * Group a ride into one run per train: [{ line, from, to, stops, towards, loop, nextStop }] (hub ids).
 * `towards` is the terminus shown on platform signs; loop lines (Circle) have none, so
 * `loop` (clockwise / anti-clockwise) and `nextStop` say which platform instead.
 */
export function rideRuns(ride) {
  const runs = []
  ride.edgeLines.forEach((line, i) => {
    const last = runs.at(-1)
    if (last?.line === line) {
      last.to = ride.path[i + 1]
      last.stops++
    } else {
      runs.push({ line, from: ride.path[i], to: ride.path[i + 1], nextStop: ride.path[i + 1], stops: 1 })
    }
  })
  for (const run of runs) Object.assign(run, rideDirection(run.line, run.from, run.nextStop))
  return runs
}

/** ['CG', 'EW', 'NS'] -> "Green → Red line": what travellers see on signs, not line codes. */
export function lineColours(lines) {
  const colours = lines.map((l) => LINES[l]?.colour || l).filter((c, i, all) => c !== all[i - 1])
  return `${colours.join(' → ')} line`
}

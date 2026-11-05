// EDITOR: KAYRA
import { getWalkRoute } from '../routing.js'
import { distanceM } from '../distance.js'

const INDOOR_HOP_M = 300 // terminal ↔ station, platform ↔ exit: indoors, where street routers can't go

/**
 * Walking geometry between two points. Street routers can't see inside Changi's terminals
 * or stations, so for a short hop they either fail or detour around the outside (3 km for
 * T3 → Changi Airport MRT). There, and only there, a direct connector is the honest line.
 */
export async function walkLeg(a, b) {
  const route = await getWalkRoute(a, b)
  const straight = distanceM(a, b)
  if (straight <= INDOOR_HOP_M && (!route || route.distance_m > straight * 4 + 200)) {
    return { coords: [[a.lng, a.lat], [b.lng, b.lat]], distance_m: straight }
  }
  return route
}

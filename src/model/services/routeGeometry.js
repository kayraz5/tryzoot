// EDITOR: MATTHEW
// Distances use a local metre plane (equirectangular); at city scale the error is
// far below GPS accuracy and much cheaper than spherical maths per frame.

const METERS_PER_DEG_LAT = 110540
const METERS_PER_DEG_LNG_AT_EQUATOR = 111320

function toLocalMeters(point, origin) {
  const metersPerDegLng = METERS_PER_DEG_LNG_AT_EQUATOR * Math.cos((origin.lat * Math.PI) / 180)
  return {
    x: (point[0] - origin.lng) * metersPerDegLng,
    y: (point[1] - origin.lat) * METERS_PER_DEG_LAT
  }
}

export function projectOnRoute(coords, position) {
  if (!coords?.length || !position) return null

  if (coords.length === 1) {
    const local = toLocalMeters(coords[0], position)
    return { index: 0, point: coords[0], distanceM: Math.hypot(local.x, local.y) }
  }

  let best = null

  for (let i = 0; i < coords.length - 1; i++) {
    const a = toLocalMeters(coords[i], position)
    const b = toLocalMeters(coords[i + 1], position)

    const dx = b.x - a.x
    const dy = b.y - a.y
    const lengthSq = dx * dx + dy * dy

    let t = lengthSq ? -(a.x * dx + a.y * dy) / lengthSq : 0
    t = Math.max(0, Math.min(1, t))

    const x = a.x + t * dx
    const y = a.y + t * dy
    const distanceSq = x * x + y * y

    if (!best || distanceSq < best.distanceSq) {
      best = {
        index: i,
        distanceSq,
        point: [
          coords[i][0] + t * (coords[i + 1][0] - coords[i][0]),
          coords[i][1] + t * (coords[i + 1][1] - coords[i][1])
        ]
      }
    }
  }

  return best && { index: best.index, point: best.point, distanceM: Math.sqrt(best.distanceSq) }
}

/* Adds a short connector to the projected point when GPS puts the traveller off
   the road; without it the line would start at the stale route origin. */
export function trimRouteAtPosition(coords, position) {
  if (!coords?.length) return { coords: [], distanceM: Infinity }
  if (!position) return { coords: coords.slice(), distanceM: 0 }

  const hit = projectOnRoute(coords, position)
  if (!hit) return { coords: coords.slice(), distanceM: Infinity }

  const trimmed = [[position.lng, position.lat]]
  // 1 m is below display resolution but bridges real GPS offset.
  if (hit.distanceM > 1) trimmed.push(hit.point)

  for (let i = hit.index + 1; i < coords.length; i++) {
    const point = coords[i]
    const last = trimmed[trimmed.length - 1]
    // A projection landing exactly on a vertex would repeat it: skip, or the line
    // gets a zero-length segment.
    if (point[0] === last[0] && point[1] === last[1]) continue
    trimmed.push(point)
  }
  return { coords: trimmed, distanceM: hit.distanceM }
}

export function trimRouteToPosition(coords, position) {
  return trimRouteAtPosition(coords, position).coords
}

export function routeDeviationMeters(coords, position) {
  const hit = projectOnRoute(coords, position)
  return hit ? hit.distanceM : Infinity
}

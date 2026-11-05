// EDITOR: KAYRA
import distance from '@turf/distance'
import { point } from '@turf/helpers'

/** Great-circle metres between two { lat, lng } points. */
export function distanceM(a, b) {
  return distance(point([a.lng, a.lat]), point([b.lng, b.lat]), { units: 'kilometers' }) * 1000
}

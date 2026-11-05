// EDITOR: SHREY
// Stamp artwork in public/stamps/, named <place id>.png or area-<area>.png (e.g. area-civic-district.png).
// Add a file, run `pnpm gen:stamps` to re-index it, and it shows up; anything without one keeps the
// drawn chop. The index is what lets these return null synchronously, which is the signal callers
// use to fall back — a bare /stamps/<id>.png URL would only fail later, as a broken image.
import { STAMP_NAMES } from './stampIndex.js'

const url = (name) => (STAMP_NAMES.has(name) ? `/stamps/${name}.png` : null)

export const placeStamp = (placeId) => url(placeId)
export const areaStamp = (areaId) => url(`area-${areaId.toLowerCase().replace(/\s+/g, '-')}`)

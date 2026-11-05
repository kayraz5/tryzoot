// EDITOR: SHREY
// Stamp artwork in public/stamps/, named <place id>.png or area-<area>.png (e.g. area-civic-district.png).
// Add a file with the right name and it shows up (restart the dev server); anything without one keeps the drawn chop.
// vite.config.js bakes the file names into __STAMP_IDS__; the pictures are served from /stamps/.
const ids = new Set(typeof __STAMP_IDS__ === 'undefined' ? [] : __STAMP_IDS__)
const urlFor = (id) => (ids.has(id) ? `${import.meta.env.BASE_URL}stamps/${id}.png` : null)

export const placeStamp = (placeId) => urlFor(placeId)
export const areaStamp = (areaId) => urlFor(`area-${areaId.toLowerCase().replace(/\s+/g, '-')}`)

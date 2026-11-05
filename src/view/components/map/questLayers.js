// EDITOR: MATTHEW
import { Marker } from 'maplibre-gl'
import destination from '@turf/destination'
import { point } from '@turf/helpers'
import { BRAND } from '../../../model/services/brand.js'
import { BUILDING_LAYERS } from './mapBuildings.js'

// Every function takes the map first and keeps no module state: MapView.vue owns
// the collections and decides when to redraw.

const EMPTY = { type: 'FeatureCollection', features: [] }

export const FENCE = { out: BRAND.pink, in: BRAND.yellow }

export function addQuestLayers(map) {
  const beforeId = map.getLayer(BUILDING_LAYERS.extruded) ? BUILDING_LAYERS.extruded : undefined
  map.addSource('zt-fence', { type: 'geojson', data: EMPTY })

  map.addLayer(
    {
      id: 'zt-fence-fill',
      type: 'fill',
      source: 'zt-fence',
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.22 }
    },
    beforeId
  )
  map.addLayer(
    {
      id: 'zt-fence-line',
      type: 'line',
      source: 'zt-fence',
      paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-dasharray': [2, 1.5] }
    },
    beforeId
  )
}

export function setFence(map, target, radiusMeters, isInside) {
  const source = map.getSource('zt-fence')
  if (!source) return
  if (!target) {
    source.setData(EMPTY)
    return
  }

  // 49 points: the last repeats the first to close the polygon.
  const ring = Array.from(
    { length: 49 },
    (_, index) =>
      destination(point([target.lng, target.lat]), radiusMeters / 1000, (index * 360) / 48, {
        units: 'kilometers'
      }).geometry.coordinates
  )

  source.setData({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { color: isInside ? FENCE.in : FENCE.out },
        geometry: { type: 'Polygon', coordinates: [ring] }
      }
    ]
  })
}

export function syncStopMarkers(map, markers, legs, nextLeg, onSelect) {
  const keep = new Set()

  for (const leg of legs) {
    const key = `${leg.seq}:${leg.place_id || 'home'}`
    keep.add(key)

    let entry = markers.get(key)
    if (!entry) {
      const element = document.createElement('button')
      element.type = 'button'
      element.className = 'zt-stop-marker'
      element.addEventListener('click', (event) => {
        event.stopPropagation()
        onSelect(entry.leg)
      })
      entry = {
        marker: new Marker({ element }).setLngLat([leg.lng, leg.lat]).addTo(map),
        element,
        leg
      }
      markers.set(key, entry)
    }

    entry.leg = leg
    const isHome = leg.kind === 'return'
    entry.element.innerHTML = isHome
      ? '<i class="bi bi-house-door-fill"></i>'
      : leg.status === 'stamped'
        ? '<i class="bi bi-patch-check-fill"></i>'
        : String(leg.seq)
    entry.element.classList.toggle('next', leg === nextLeg)
    entry.element.classList.toggle('done', leg.status !== 'pending')
    entry.element.title = isHome ? `Back to ${leg.name}` : `${leg.seq}. ${leg.name}`
    entry.element.setAttribute('aria-label', entry.element.title)
  }

  for (const [key, entry] of markers) {
    if (keep.has(key)) continue
    entry.marker.remove()
    markers.delete(key)
  }
}

/** The .cone is first in the DOM so the pulse and dot paint on top of it. */
export function createPlayerMarker() {
  const element = document.createElement('div')
  element.className = 'zt-player-marker'
  element.innerHTML =
    '<span class="cone"></span><span class="pulse"></span><span class="core"><i class="bi bi-person-walking"></i></span>'
  return new Marker({ element })
}

/* screenDegrees is clockwise from the top of the SCREEN, not north: the marker
   element lives in screen space and never rotates with the map, so callers pass
   the facing relative to the map's current bearing. */
export function setPlayerFacing(marker, screenDegrees, visible = true) {
  const cone = marker?.getElement()?.querySelector('.cone')
  if (!cone) return
  cone.style.transform = `translate(-50%, -50%) rotate(${screenDegrees}deg)`
  cone.style.opacity = visible ? '1' : '0'
}

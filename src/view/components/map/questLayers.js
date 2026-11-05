// EDITOR: MATTHEW
import { Marker } from 'maplibre-gl'
import destination from '@turf/destination'
import { point } from '@turf/helpers'
import { BRAND } from '../../../model/services/brand.js'
import { BUILDING_LAYERS } from './mapBuildings.js'

// Every function takes the map first and keeps no module state: MapView.vue owns
// the collections and decides when to redraw.

const EMPTY = { type: 'FeatureCollection', features: [] }

const ROUTE_LAYOUT = { 'line-cap': 'round', 'line-join': 'round' }

// Widths grow with zoom so the walking line stays readable on a phone.
const ROUTE_WIDTH = {
  casing: ['interpolate', ['linear'], ['zoom'], 12, 9, 17, 18],
  walk: ['interpolate', ['linear'], ['zoom'], 12, 6, 17, 12],
  ride: ['interpolate', ['linear'], ['zoom'], 12, 5, 17, 10]
}

const THEME = {
  dark: { walk: BRAND.pink, mrt: BRAND.yellow, taxi: '#ff4d00', casing: BRAND.ink },
  light: { walk: BRAND.pink, mrt: BRAND.ink, taxi: '#ff4d00', casing: '#ffffff' }
}

export const FENCE = { out: BRAND.pink, in: BRAND.yellow }

export function addQuestLayers(map) {
  const beforeId = map.getLayer(BUILDING_LAYERS.extruded) ? BUILDING_LAYERS.extruded : undefined
  map.addSource('zt-route', { type: 'geojson', data: EMPTY })
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
  map.addLayer(
    {
      id: 'zt-route-casing',
      type: 'line',
      source: 'zt-route',
      layout: ROUTE_LAYOUT,
      paint: {
        'line-width': ROUTE_WIDTH.casing,
        'line-opacity': ['case', ['get', 'active'], 0.95, 0.5]
      }
    },
    beforeId
  )

// Walking legs follow real streets (solid); MRT/taxi are crow-flies (dashed).
  const routeLine = {
    type: 'line',
    source: 'zt-route',
    layout: ROUTE_LAYOUT,
    paint: {
      'line-width': ROUTE_WIDTH.walk,
      'line-opacity': ['case', ['get', 'active'], 1, 0.6]
    }
  }
  map.addLayer(
    { ...routeLine, id: 'zt-route-walk', filter: ['==', ['get', 'mode'], 'walk'] },
    beforeId
  )
  map.addLayer(
    {
      ...routeLine,
      id: 'zt-route-ride',
      filter: ['!=', ['get', 'mode'], 'walk'],
      paint: {
        ...routeLine.paint,
        'line-width': ROUTE_WIDTH.ride,
        'line-dasharray': [1.2, 1.4]
      }
    },
    beforeId
  )
}

export function setQuestColors(map, isDark) {
  if (!map.getLayer('zt-route-walk')) return
  const colors = isDark ? THEME.dark : THEME.light
  map.setPaintProperty('zt-route-walk', 'line-color', colors.walk)
  map.setPaintProperty('zt-route-ride', 'line-color', ['match', ['get', 'mode'], 'mrt', colors.mrt, colors.taxi])
  map.setPaintProperty('zt-route-casing', 'line-color', colors.casing)
}

export function setRoute(map, segments) {
  map.getSource('zt-route')?.setData({
    type: 'FeatureCollection',
    features: segments.map((segment) => ({
      type: 'Feature',
      properties: { mode: segment.mode, active: !!segment.active },
      geometry: { type: 'LineString', coordinates: segment.coords }
    }))
  })
}

export function setFence(map, target, radiusMeters, isInside) {
  const source = map.getSource('zt-fence')
  if (!source) return
  if (!target) {
    source.setData(EMPTY)
    return
  }

// 49 points: the last repeats the first to close the polygon.
  const ring = Array.from({ length: 49 }, (_, index) =>
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

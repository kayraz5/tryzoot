<!-- EDITOR: MATTHEW -->
<script setup>
/*
 * 3D Map - owns the MapLibre instance and everything drawn on it. Mission state
 * lives in the Pinia store; this view only reads it.
 *
 * Positions are { lat, lng } here; MapLibre expects [lng, lat].
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Map as MapLibreMap, LngLatBounds, setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre resolves its worker next to its own module, which Vite never copies
// into the build. Importing with ?url makes Vite emit it as an asset.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
setWorkerUrl(maplibreWorkerUrl)
import destination from '@turf/destination'
import { point } from '@turf/helpers'
import {
  PinLayer,
  syncStopPins,
  updatePinProximity,
  LANDMARK_BADGE
} from '../components/map/pinPoint.js'
import { TravellerLayer, bearingBetween } from '../components/character/travellerLayer.js'
import MissionInfoCard from '../components/map/MissionInfoCard.vue'
import AirportHelp from '../components/map/AirportHelp.vue'
import MapStatusStack from '../components/map/MapStatusStack.vue'
import MapMenuButton from '../components/map/MapMenuButton.vue'
import QuestMapLive from '../components/quests/QuestMapLive.vue'
import { useMissionNav } from '../components/map/useMissionNav.js'
import { useWeatherRefresh } from '../common/weather/useWeatherRefresh.js'
import { useCooldown } from '../common/useCooldown.js'
import { useMissionStore } from '../../model/stores/mission.js'
import { useUiStore } from '../../model/stores/ui.js'
import { usePartyStore } from '../../model/stores/party.js'
import { useCharacterStore } from '../../model/stores/character.js'

import {
  geo,
  hasFix,
  hasHeading,
  startGps,
  setFake,
  teleport,
  startHeading,
  stopHeading
} from '../../model/services/geo.js'
import { distanceM } from '../../model/services/travel.js'
import {
  addQuestLayers,
  createPlayerMarker,
  setFence,
  setPlayerFacing,
  syncStopMarkers
} from '../components/map/questLayers.js'
import { applyMapLabelStyle } from '../components/map/mapLabels.js'
import { applyBuildingLayers, BUILDING_LAYERS } from '../components/map/mapBuildings.js'
import { loadCatalog } from '../../model/services/catalog.js'
import { formatTime } from '../../model/services/hours.js'
import { getWalkRoute, getDriveRoute } from '../../model/services/routing.js'
import {
  getTransitRoute,
  currentPartIndex,
  transferPoints
} from '../../model/services/transit/index.js'
import {
  setTransitTheme,
  setTransferPoints,
  routeFeatures
} from '../components/map/transit/layers.js'
import { useTransit } from '../components/map/transit/useTransit.js'
import TransitStopSheet from '../components/map/transit/TransitStopSheet.vue'
import { trimRouteAtPosition } from '../../model/services/routeGeometry.js'

const TRAVELLER_LAYER_ID = 'zt-traveller'
const LIVE_ROUTE_SOURCE_ID = 'mission-route'
const LIVE_ROUTE_LAYER_ID = 'mission-route-line'
const LIVE_ROUTE_CASING_LAYER_ID = 'mission-route-casing'
const LIVE_ROUTE_GLOW_LAYER_ID = 'mission-route-glow'
const LIVE_ROUTE_COLOR = '#ff1dce' // brighter than the planned-route pink; the active leg wins
const LIVE_ROUTE_CASING_COLOR = '#111111'
const LIVE_ROUTE_LAYOUT = { 'line-join': 'round', 'line-cap': 'round' }

const MBS_DEMO_PIN = { id: 'mbs-pin', lng: 103.8607, lat: 1.283, label: LANDMARK_BADGE }

const OTTER_VIEW = {
  pitch: 62,
  zoom: 18,
  lookAheadM: 12,
  smoothMs: 120 // time constant for smoothing position jumps
}
const FLAT_VIEW = { pitch: 32 }
const HEADING_SMOOTH_MS = 160
const FLAT_BEARING_SMOOTH_MS = 420
const getBusRoute = async (from, to) => (await getTransitRoute(from, to)) || getDriveRoute(from, to)
const ROUTE_BY_MODE = {
  walk: getWalkRoute,
  taxi: getDriveRoute,
  bus: getBusRoute,
  mrt: getTransitRoute
}

const ROUTE_CHECK_AFTER_MS = 250
const ROUTE_REFRESH_MS = 800
const ROUTE_MIN_INTERVAL_MS = 500
const ROUTE_DEVIATION_M = 20
const TRANSIT_DEVIATION_M = 150
const TRANSIT_REFRESH_MS = 30000

const KEY_DIRECTIONS = {
  w: 0,
  arrowup: 0,
  s: 180,
  arrowdown: 180,
  a: -90,
  arrowleft: -90,
  d: 90,
  arrowright: 90
}

const navItemsBefore = [
  { to: '/map', icon: 'bi-geo-alt-fill', label: 'Map' },
  { to: '/mission', icon: 'bi-signpost-split-fill', label: 'Mission' },
  { to: '/explore', icon: 'bi-compass-fill', label: 'Explore' }
]
const navItemsAfter = [
  { to: '/quests', icon: 'bi-people-fill', label: 'Quests' },
  { to: '/passport', icon: 'bi-journal-bookmark-fill', label: 'Passport' },
  { to: '/me', icon: 'bi-person-circle', label: 'Me' }
]

const MAP_PALETTE = {
  theme: {
    background: cssVar('--zt-black-2', '#282828'),
    water: '#2f6fb8',
    building: '#55493a',
    road: cssVar('--zt-yellow', '#ffcc00'),
    parkFill: cssVar('--zt-soft-line', '#3a3626'),
    landuseFill: '#332f26',
    landcover: {
      landcover_grass: '#4a7a33',
      landcover_ice: '#3f6363',
      landcover_sand: '#9c8324',
      landcover_wood: '#355e22'
    }
  },
  simple: {
    background: '#f2efe8',
    water: '#a8d8f0',
    building: '#e4dbc8',
    road: '#ffffff', // fallback for any road_ layer roadClasses doesn't name
    roadClasses: {
      motorway: '#f8a24d',
      motorwayCasing: '#e8923e',
      primary: '#fcd9a6',
      primaryCasing: '#f0bb7c',
      secondary: '#ffffff',
      secondaryCasing: '#e6e3da',
      minor: '#ffffff',
      minorCasing: '#e9e6de',
      path: '#ddcfb3',
      rail: '#b6b2a8'
    },
    parkFill: '#cfe8c6',
    landuseFill: '#f6eedd',
    landcover: {
      landcover_grass: '#c3e3ae',
      landcover_ice: '#eaf4f4',
      landcover_sand: '#faf1d2',
      landcover_wood: '#bfe8a8'
    }
  }
}

const mapContainer = ref(null) // the <div> MapLibre renders into
const mapReady = ref(false) // style loaded + quest layers added
const following = ref(true) // camera tracks the traveller right now
// Whether the user *wants* to be followed. `following` is the live state and a drag
// pauses it; this is the intent, so an explicit "off" survives the next gesture.
const followEnabled = ref(true)
// What the lock button shows, and so what a tap must reverse: a drag pauses
// `following` while the intent is still on, and then a tap must switch it *on*.
const cameraFollowing = computed(() => followEnabled.value && following.value)
const stamping = ref(false) // a stamp request is in flight
const helpOpen = ref(false) // "Need help?" replan dialog
const airportOpen = ref(false) // "Get to the airport" dialog
const showMissionCard = ref(readMissionCardFlag())

const flatMode = ref(false) // true = top-down free-roam (pan enabled, no 3D)
const mapToolsOpen = ref(false) // right-hand map tools drawer
const mapStyleOpen = ref(false) // map appearance dialog
const savedStyle = readMapStyle() // map appearance choices from last time
const buildingsVisible = ref(savedStyle.buildings ?? false) // show map buildings at all; off gives the cleanest map
const buildings3D = ref(savedStyle.buildings3D ?? false) // true = extruded 3D buildings, false = flat 2D footprints
const mapTheme = ref(savedStyle.theme ?? 'theme') // 'theme' | 'simple'
const colorblindMode = ref(savedStyle.colorblind ?? false) // high-contrast map palette
const showTraveller3D = ref(true) // 3D character vs flat dot
const showStopPins3D = ref(true) // 3D tower pins vs flat numbered dots
const otterView = ref(false) // third-person camera locked behind the traveller

const demoSpeed = ref(20) // Demo-Walk multiplier (1×, 6×, 20×)
const wasdEnabled = ref(true) // keyboard movement during Demo-Walk
const demoPanelOpen = ref(false) // the panel can be tucked away while Demo-Walk keeps running

const liveRoute = ref(null) // { coords, parts?, from, to }
const plannedSegments = ref([]) // [{ coords, mode, parts?, active }]

const router = useRouter()
const currentRoute = useRoute()
const missionStore = useMissionStore()
const party = usePartyStore()
const ui = useUiStore()
const character = useCharacterStore()
useWeatherRefresh(1.2897, 103.8501) // weather is decorative; a failure never blocks the map

const {
  HOME_RADIUS_M,
  modeIcon,
  demo,
  mission,
  next,
  here,
  check,
  lateBy,
  liveTravel,
  distance,
  stopNumber,
  guidance,
  countdown,
  leaveBy,
  isTimeCritical,
  isTimeWarning,
  formatDistance
} = useMissionNav()

let map = null // MapLibre map instance
let player = null // flat "you are here" DOM marker
let traveller3D = null // 3D character layer (null while using the dot)
let lastTravellerAt = null // previous fix, used to work out facing
let travellerHeading = null // last direction of travel (degrees), for otter view
let travellerHeadingAt = 0 // when that direction was recorded
let travellerStopTimer = 0 // drops the walk cycle after the fixes stop
let displayHeading = null // smoothed bearing used by the character + camera
let otterCamera = null // { lng, lat } smoothed otter-view focus point
let movementFrameBearing = null // frozen WASD reference while no compass is available

// Keys come from seq + place_id so a leg keeps identity across replans.
const markers = new Map() // flat stop markers  → MapLibre Marker
const pins = new Map() // 3D stop towers     → PinLayer
// Stale-while-revalidate: a segment that resolved once keeps rendering until a
// fresh geometry replaces it.
const plannedRouteCache = new Map() // legKey → { coords, mode }

let raf = 0
let lastFrame = 0
let noFixTimer = 0
let retryTimer = 0
let lastRouteAt = 0
let routeInFlight = false // one live-route request at a time
let refreshAfterFlight = false // a forced refresh arrived while a request was out
let liveDeviationM = Infinity // how far the traveller is from the resolved live route
const keys = new Set() // pressed Demo-Walk keys (w/a/s/d + arrows)
let orbit = null // active drag-to-orbit gesture, or null

onMounted(async () => {
  createMap()

  await loadCatalog()
  await missionStore.loadActive()
  if (!geo.fake) startGps()
  // On iOS this first attempt is outside a gesture, so it quietly fails and is
  // retried from a tap below.
  startHeading().catch(() => {})

  noFixTimer = window.setTimeout(() => {
    if (!hasFix() && mission.value) {
      ui.toast(
        "Can't find your location. Allow location access, or tap Enable Demo-Walk to try the quest from here.",
        'warning',
        6000
      )
    }
  }, 8000)

  window.addEventListener('keydown', onDemoKeyDown)
  window.addEventListener('keyup', onDemoKeyUp)
  window.addEventListener('pointerdown', onPointerDownOutsideTools)
  raf = requestAnimationFrame(demoWalkLoop)
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
  clearTimeout(noFixTimer)
  clearTimeout(retryTimer)
  clearTimeout(travellerStopTimer)
  window.removeEventListener('keydown', onDemoKeyDown)
  window.removeEventListener('keyup', onDemoKeyUp)
  window.removeEventListener('pointerdown', onPointerDownOutsideTools)
  stopHeading()
  detachOrbitListeners()
  markers.clear()
  pins.clear()
  map?.remove()
  map = null
})

function createMap() {
  map = new MapLibreMap({
    container: mapContainer.value,
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [103.8198, 1.3521], // Singapore
    zoom: 16.5,
    pitch: 56,
    bearing: -18,
    maxPitch: 72,
    minZoom: 10,
    // Panning and rotating are intentionally off, replaced by the custom orbit (3D)
    // and free-roam (flat) modes below.
    dragPan: false,
    dragRotate: false,
    keyboard: false,
    boxZoom: false,
    attributionControl: { compact: true },
    canvasContextAttributes: { antialias: true },
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2)
  })

  map.touchZoomRotate.disableRotation()
  // Scroll zoom centres on the screen, not the cursor, so it cannot drift the
  // view off the traveller.
  map.scrollZoom.enable({ around: 'center' })
  // MapLibre's CSS would give this canvas `touch-action: pan-x pan-y` (its `none`
  // rule never applies because dragPan is off), letting the browser claim a
  // horizontal drag and fire `pointercancel` mid-gesture. Pinch uses touch events.
  map.getCanvas().style.touchAction = 'none'

  map.on('load', () => {
    applyBasemapStyle()
    // A glyph/sprite request can still be settling when `load` fires, making
    // isStyleLoaded() false for that tick and silently skipping basemap styling.
    map.once('idle', () => {
      applyBasemapStyle()
      if (colorblindMode.value) setColorblindMode(true)
    })
  })
  map.on('load', onMapLoad)
  map.on('load', () => centerOnMe(false))
  map.on('load', () => map.addLayer(new PinLayer(MBS_DEMO_PIN)))
  map.on('load', syncPlayerAvatar)

  map.on('movestart', onMapMoveStart)
  map.on('moveend', onMapMoveEnd)

  attachOrbitListeners()
}

function onMapLoad() {
  attachTransit(map, mapTheme.value === 'theme')
  addQuestLayers(map)
  player = createPlayerMarker()
  syncBuildingLayers()
  mapReady.value = true
}

/* A real user gesture pauses follow; our own flyTo/easeTo must not. */
function onMapMoveStart(event) {
  if (event.originalEvent) following.value = false
}

function onMapMoveEnd(event) {
  if (!event.originalEvent || flatMode.value || !followEnabled.value) return
  following.value = true
  if (here.value) map.easeTo({ center: [here.value.lng, here.value.lat], duration: 500 })
}

function attachOrbitListeners() {
  const canvas = map.getCanvas()
  canvas.addEventListener('pointerdown', onOrbitPointerDown)
  canvas.addEventListener('pointermove', onOrbitPointerMove)
  canvas.addEventListener('pointerup', onOrbitPointerUp)
  canvas.addEventListener('pointercancel', onOrbitPointerUp)
}

function detachOrbitListeners() {
  if (!map) return
  const canvas = map.getCanvas()
  canvas.removeEventListener('pointerdown', onOrbitPointerDown)
  canvas.removeEventListener('pointermove', onOrbitPointerMove)
  canvas.removeEventListener('pointerup', onOrbitPointerUp)
  canvas.removeEventListener('pointercancel', onOrbitPointerUp)
}

function cssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function roadColorFor(layerId, palette) {
  const classes = palette.roadClasses
  if (!classes) return palette.road

  const isCasing = layerId.endsWith('_casing') || layerId.endsWith('_hatching')
  if (layerId.includes('motorway')) return isCasing ? classes.motorwayCasing : classes.motorway
  if (layerId.includes('trunk_primary')) return isCasing ? classes.primaryCasing : classes.primary
  if (layerId.includes('secondary_tertiary'))
    return isCasing ? classes.secondaryCasing : classes.secondary
  if (layerId.includes('rail')) return classes.rail
  if (layerId.includes('path_pedestrian')) return classes.path
  return isCasing ? classes.minorCasing : classes.minor
}

function applyBasemapStyle() {
  if (!map || !map.isStyleLoaded()) return

  const isDark = mapTheme.value === 'theme'
  const palette = isDark ? MAP_PALETTE.theme : MAP_PALETTE.simple

  map.setPaintProperty('background', 'background-color', palette.background)
  map.setPaintProperty('water', 'fill-color', palette.water)
  map.setPaintProperty(BUILDING_LAYERS.flat, 'fill-color', palette.building)
  map.setPaintProperty(BUILDING_LAYERS.extruded, 'fill-extrusion-color', palette.building)

  for (const layer of map.getStyle().layers) {
    if (layer.id.startsWith('road_') && layer.type === 'line') {
      map.setPaintProperty(layer.id, 'line-color', roadColorFor(layer.id, palette))
    }
  }

  for (const layer of map.getStyle().layers) {
    if (palette.landcover[layer.id]) {
      map.setPaintProperty(layer.id, 'fill-color', palette.landcover[layer.id])
    } else if (layer.id === 'park' && layer.type === 'fill') {
      map.setPaintProperty(layer.id, 'fill-color', palette.parkFill)
    } else if (layer.id.startsWith('landuse_') && layer.type === 'fill') {
      map.setPaintProperty(layer.id, 'fill-color', palette.landuseFill)
    }
  }

  applyMapLabelStyle(map, isDark)
  setTransitTheme(map, isDark)
}

/* Okabe-Ito high-contrast palette for colourblind users. */
function setColorblindMode(enabled) {
  colorblindMode.value = enabled
  if (!map || !map.isStyleLoaded()) return

  if (!enabled) {
    applyBasemapStyle()
    return
  }

  map.setPaintProperty(BUILDING_LAYERS.flat, 'fill-color', '#E69F00') // orange
  map.setPaintProperty(BUILDING_LAYERS.extruded, 'fill-extrusion-color', '#E69F00')
  map.setPaintProperty('water', 'fill-color', '#0072B2') // blue

  for (const layer of map.getStyle().layers) {
    if (layer.id.startsWith('road_') && layer.type === 'line') {
      map.setPaintProperty(layer.id, 'line-color', '#F0E442') // yellow
    }
  }

  const safeLandcover = {
    landcover_grass: '#009E73', // bluish-green
    landcover_wood: '#009E73',
    landcover_sand: '#E69F00',
    landcover_ice: '#56B4E9'
  }
  for (const layer of map.getStyle().layers) {
    if (safeLandcover[layer.id]) {
      map.setPaintProperty(layer.id, 'fill-color', safeLandcover[layer.id])
    }
  }
}

function syncBuildingLayers() {
  if (!map) return
  applyBuildingLayers(map, {
    visible: buildingsVisible.value,
    extruded: buildings3D.value
  })
}

function setBuildingsVisible(show) {
  buildingsVisible.value = show
  syncBuildingLayers()
}

function setBuildings3D(show) {
  buildings3D.value = show
  if (show) buildingsVisible.value = true
  syncBuildingLayers()
}

function setFlatMode(isFlat) {
  flatMode.value = isFlat

  if (isFlat) {
    // The two locks are mutually exclusive: flat view has its own, gentler one.
    otterView.value = false
    otterCamera = null
    followEnabled.value = true
    following.value = true
    map.dragPan.enable()
    animateToFlat()
    showTraveller3D.value = false
    showStopPins3D.value = false
    return
  }

  map.dragPan.disable()
  following.value = true
  if (!geo.fake) startGps()
  if (here.value) {
    map.flyTo({
      center: [here.value.lng, here.value.lat],
      zoom: 18,
      pitch: 56,
      bearing: -18,
      duration: 1200
    })
  } else {
    animateTo3D()
  }
  showTraveller3D.value = true
  showStopPins3D.value = true
  followEnabled.value = true
}

function toggleFlatMode() {
  setFlatMode(!flatMode.value)
}

function drawMission() {
  if (!mapReady.value) return
  syncPlayerAvatar()
  syncStopVisuals()
  drawRoute()
  drawFence()
  updateMinZoomForStops()
}

/* Panning is locked, so zooming out is the only way to see a distant stop. */
function updateMinZoomForStops() {
  if (!map) return

  const points = missionStore.legs.map((leg) => [leg.lng, leg.lat])
  if (here.value) points.push([here.value.lng, here.value.lat])
  if (points.length < 2) {
    map.setMinZoom(10)
    return
  }

  const bounds = points.reduce(
    (box, coordinate) => box.extend(coordinate),
    new LngLatBounds(points[0], points[0])
  )
  const camera = map.cameraForBounds(bounds, { padding: 60 })
  map.setMinZoom(camera ? Math.min(camera.zoom, 17) : 10)
}

function syncStopVisuals() {
  if (!mapReady.value) return

  if (showStopPins3D.value) {
    syncStopMarkers(map, markers, [], next.value, flyTo)
    syncStopPins(map, pins, missionStore.legs, next.value)
  } else {
    syncStopPins(map, pins, [])
    syncStopMarkers(map, markers, missionStore.legs, next.value, flyTo)
  }

  updatePinProximity(pins, here.value)
}

function drawFence() {
  if (!map) return
  const target = next.value
  const radius = target?.kind === 'return' ? HOME_RADIUS_M : (check.value?.radius ?? 80)
  setFence(map, target, radius, !!check.value?.ok)
}

function drawRoute() {
  if (!mapReady.value) return

  const features = []
  let points = []
  const target = next.value
  liveDeviationM = Infinity
  if (target) {
    const live = liveRoute.value
    if (live && live.to === target) {
      // Re-trim every frame so the line begins at the character's exact position.
      const parts = live.parts || [{ mode: liveTravel.value?.mode || 'walk', coords: live.coords }]
      const index = currentPartIndex(parts, here.value)
      const trimmed = trimRouteAtPosition(parts[index].coords, here.value)
      liveDeviationM = trimmed.distanceM
      features.push(
        ...routeFeatures([{ ...parts[index], coords: trimmed.coords }, ...parts.slice(index + 1)])
      )
      points = live.parts ? transferPoints(parts.slice(index)) : []
    }
  }
  if (!features.length) {
    for (const segment of plannedSegments.value) {
      features.push(
        ...routeFeatures(segment.parts || [{ mode: segment.mode, coords: segment.coords }])
      )
    }
  }
  setTransferPoints(map, points)

  const data = { type: 'FeatureCollection', features }

  const source = map.getSource(LIVE_ROUTE_SOURCE_ID)
  if (source) {
    source.setData(data)
    return
  }

  map.addSource(LIVE_ROUTE_SOURCE_ID, { type: 'geojson', data })
  addLiveRouteLayer(LIVE_ROUTE_GLOW_LAYER_ID, {
    'line-color': ['coalesce', ['get', 'color'], LIVE_ROUTE_COLOR],
    'line-width': ['interpolate', ['linear'], ['zoom'], 12, 14, 17, 24],
    'line-opacity': 0.3,
    'line-blur': 3
  })
  addLiveRouteLayer(LIVE_ROUTE_CASING_LAYER_ID, {
    'line-color': LIVE_ROUTE_CASING_COLOR,
    'line-width': ['interpolate', ['linear'], ['zoom'], 12, 11, 17, 19],
    'line-opacity': 0.92
  })
  addLiveRouteLayer(LIVE_ROUTE_LAYER_ID, {
    'line-color': ['coalesce', ['get', 'color'], LIVE_ROUTE_COLOR],
    'line-width': ['interpolate', ['linear'], ['zoom'], 12, 7, 17, 13],
    'line-opacity': 1
  })
}

function addLiveRouteLayer(id, paint) {
  // Below the board/change/get-off pins, so they stay readable on top of the line.
  const before = map.getLayer('mission-transit-points') ? 'mission-transit-points' : undefined
  map.addLayer(
    { id, type: 'line', source: LIVE_ROUTE_SOURCE_ID, layout: LIVE_ROUTE_LAYOUT, paint },
    before
  )
}

function previousPoint(leg) {
  const legs = missionStore.legs
  const index = legs.indexOf(leg)
  return index > 0 ? legs[index - 1] : mission.value.origin
}

function legKey(a, b) {
  return `${a.seq}:${a.place_id || 'home'}>${b.seq}:${b.place_id || 'home'}:${b.travel_mode}` // mode: a transport switch reroutes
}

function nextLegPair() {
  const target = next.value
  return target ? [previousPoint(target), target] : null
}

function syncPlannedSegments(pair) {
  const segment = pair && plannedRouteCache.get(legKey(...pair))
  plannedSegments.value = segment
    ? [{ coords: segment.coords, mode: segment.mode, parts: segment.parts, active: false }]
    : []
  drawRoute()
}

async function refreshPlannedRoutes() {
  const pair = nextLegPair()

  const activeKey = pair && legKey(...pair)
  for (const key of plannedRouteCache.keys()) {
    if (key !== activeKey) plannedRouteCache.delete(key)
  }

  syncPlannedSegments(pair)
  if (!pair) return

  const [previous, leg] = pair
  const resolveRoute = ROUTE_BY_MODE[leg.travel_mode]
  if (!resolveRoute) return

  const route = await resolveRoute(previous, leg)
  if (!route) return // keep the cached geometry, if any

  plannedRouteCache.set(activeKey, {
    coords: route.coords,
    mode: leg.travel_mode,
    parts: route.parts
  })
  if (nextLegPair()?.[1] === leg) syncPlannedSegments(pair)
}

async function refreshLiveRoute(force = false) {
  clearTimeout(retryTimer)

  const target = next.value
  const travelMode = liveTravel.value?.mode
  const resolveRoute = ROUTE_BY_MODE[travelMode]

  if (!target || !here.value || !resolveRoute) return drawRoute()

  const current = liveRoute.value
  const sameTarget = current?.to === target
  const ageMs = Date.now() - lastRouteAt

  if (!force && sameTarget && current.parts && (travelMode === 'mrt' || travelMode === 'bus')) {
    if (ageMs < TRANSIT_REFRESH_MS && liveDeviationM < TRANSIT_DEVIATION_M) return drawRoute()
  } else if (!force && sameTarget) {
    if (ageMs < ROUTE_CHECK_AFTER_MS) return drawRoute()

    if (ageMs < ROUTE_REFRESH_MS && liveDeviationM < ROUTE_DEVIATION_M) {
      return drawRoute()
    }

    if (ageMs < ROUTE_MIN_INTERVAL_MS) {
      retryTimer = window.setTimeout(() => refreshLiveRoute(), ROUTE_MIN_INTERVAL_MS - ageMs)
      return drawRoute()
    }
  }

  // Never run two router requests for the same leg at once. A forced refresh (new stop, or a
  // switch between public transport and car) runs as soon as the current one comes back.
  if (routeInFlight) {
    if (force) refreshAfterFlight = true
    return drawRoute()
  }

  routeInFlight = true
  lastRouteAt = Date.now()
  try {
    const from = { ...here.value }
    const route = await resolveRoute(from, target)
    // Ignore late responses for a target that is no longer next.
    if (route && next.value === target) {
      liveRoute.value = { coords: route.coords, parts: route.parts, from, to: target }
    }
  } catch (err) {
    console.warn('[3D_Map] live route failed', err)
  } finally {
    routeInFlight = false
  }
  if (refreshAfterFlight || (next.value && next.value !== target)) {
    refreshAfterFlight = false
    return refreshLiveRoute(true)
  }
  drawRoute()
}

function syncPlayerAvatar() {
  if (!mapReady.value) return

  const position = here.value

  if (showTraveller3D.value) {
    player?.remove() // safe every call; no-op if it was never added
    if (!position) return

    if (!traveller3D) {
      traveller3D = new TravellerLayer({
        id: TRAVELLER_LAYER_ID,
        lng: position.lng,
        lat: position.lat,
        outfit: character.outfit,
        fur: character.fur,
        hat: character.hat,
        eyewear: character.eyewear
      })
      map.addLayer(traveller3D)
    }

    moveTraveller(position)
    return
  }

  // Tear the character down: onRemove frees the geometry.
  if (traveller3D) {
    if (map.getLayer(TRAVELLER_LAYER_ID)) map.removeLayer(TRAVELLER_LAYER_ID)
    traveller3D = null
    lastTravellerAt = null
    clearTimeout(travellerStopTimer)
  }
  if (position) player.setLngLat([position.lng, position.lat]).addTo(map)
}

function moveTraveller(position) {
  if (!traveller3D) return
  traveller3D.setLngLat(position.lng, position.lat)

  // Only update on a real step - GPS jitter would spin him on the spot.
  if (lastTravellerAt && distanceM(lastTravellerAt, position) > 3) {
    travellerHeading = bearingBetween(lastTravellerAt, position)
    travellerHeadingAt = Date.now()
    traveller3D.setMoving(true)

    // Fixes stop arriving when you stop walking, so re-arm an idle timer instead.
    clearTimeout(travellerStopTimer)
    travellerStopTimer = window.setTimeout(() => traveller3D?.setMoving(false), 2500)
    lastTravellerAt = { ...position }
  } else if (!lastTravellerAt) {
    lastTravellerAt = { ...position }
  }
}

function onOrbitPointerDown(event) {
  if (!map || flatMode.value) return
  if (!event.isPrimary) {
    orbit = null
    return
  }

  event.preventDefault()
  map.getCanvas().setPointerCapture?.(event.pointerId)
  orbit = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    bearing: map.getBearing(),
    pitch: map.getPitch()
  }
  // Stop the GPS follow watcher recentring mid-gesture and fighting the orbit.
  following.value = false
}

function onOrbitPointerMove(event) {
  if (!orbit || !map || event.pointerId !== orbit.pointerId) return

  const dx = event.clientX - orbit.x
  const dy = event.clientY - orbit.y
  if (otterView.value && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
    otterView.value = false
    otterCamera = null
  }
  const around = here.value ? [here.value.lng, here.value.lat] : undefined

  map.jumpTo({
    bearing: orbit.bearing + dx * 0.7,
    pitch: Math.min(map.getMaxPitch(), Math.max(0, orbit.pitch - dy * 0.35)),
    around
  })
}

function onOrbitPointerUp(event) {
  if (!orbit || event.pointerId !== orbit.pointerId) return

  map?.getCanvas().releasePointerCapture?.(event.pointerId)
  orbit = null
  following.value = true
  // Pivoting on a non-centre `around` nudges `center`; settle back on the traveller.
  if (here.value && map) map.easeTo({ center: [here.value.lng, here.value.lat], duration: 300 })
}

function flyTo(place, zoom = 17) {
  otterView.value = false
  otterCamera = null
  map?.flyTo({ center: [place.lng, place.lat], zoom, duration: 1200 })
  following.value = false
}

function showMembers(userId) {
  const people = party.liveOthers.filter((p) => !userId || p.user_id === userId)
  if (!map || !people.length) return
  otterView.value = false
  otterCamera = null
  following.value = false
  const card = document.querySelector('.mission-card')?.getBoundingClientRect()
  const view = mapContainer.value.getBoundingClientRect()
  const bottom = card?.height ? Math.max(60, view.bottom - card.top + 30) : 60
  const padding = { top: 110, bottom, left: 60, right: 60 }
  if (people.length === 1)
    return map.flyTo({ center: [people[0].lng, people[0].lat], zoom: 16, padding, duration: 1200 })
  const bounds = new LngLatBounds()
  for (const p of here.value ? [...people, here.value] : people) bounds.extend([p.lng, p.lat])
  map.fitBounds(bounds, { padding, maxZoom: 16, duration: 1200 })
}
watch(
  () => party.liveFocus,
  (focus) => focus && showMembers(focus.userId)
)

function centerOnMe(notifyOnFail = true) {
  followEnabled.value = true // asking to be centred is asking to be followed
  following.value = true
  if (!geo.fake) {
    startGps()
    // A tap is a valid gesture for the iOS compass permission prompt.
    startHeading().catch(() => {})
  }

  if (!here.value) {
    if (notifyOnFail)
      ui.toast('Waiting for GPS… Allow location access, or turn on Demo-Walk.', 'dark')
    return
  }

  if (otterView.value) {
    applyOtterView()
    return
  }

  map.flyTo({ center: [here.value.lng, here.value.lat], zoom: 18, duration: 1500 })
}

function zoomIn() {
  map.zoomIn({ duration: 1500 })
}

function zoomOut() {
  map.zoomTo(12, { duration: 1500 })
}

/**
 * Tapping anywhere off the drawer closes it, so the hamburger isn't the only way out.
 * pointerdown rather than click, so dragging the map dismisses it as the drag starts
 * instead of waiting for the gesture to end. The drawer and the hamburger are excluded:
 * the tools inside stay tappable, and the hamburger's own toggle still works.
 */
function onPointerDownOutsideTools(event) {
  if (!mapToolsOpen.value) return
  if (event.target instanceof Element && event.target.closest('.map-tools, .menu-btn')) return
  mapToolsOpen.value = false
}

function animateToFlat() {
  // Arrive already pointed the right way, so the lock does not have to swing the
  // whole world when the transition lands.
  const facing = headingIsKnown() && displayHeading != null ? displayHeading : 0
  const camera = { pitch: FLAT_VIEW.pitch, bearing: facing, duration: 600 }
  if (here.value) camera.center = [here.value.lng, here.value.lat]
  map.easeTo(camera)
}

function animateTo3D() {
  map.easeTo({ pitch: 56, bearing: -18, duration: 600 })
}

function facingHeading() {
  if (!geo.fake && geo.heading != null) return geo.heading

  if (travellerHeading != null && Date.now() - travellerHeadingAt < 3000) {
    return travellerHeading
  }

  if (here.value && next.value) return bearingDegrees(here.value, next.value)

  if (travellerHeading != null) return travellerHeading
  return map?.getBearing() ?? 0
}

function headingIsKnown() {
  return hasHeading() || geo.fake || travellerHeading != null
}

/** Interpolate between two bearings along the shortest arc (359 -> 0 safe). */
function lerpAngle(from, to, t) {
  const delta = ((to - from + 540) % 360) - 180
  return (from + delta * t + 360) % 360
}

function updateFacing(deltaMs) {
  if (!mapReady.value) return

  const target = facingHeading()
  const blend = 1 - Math.exp(-deltaMs / HEADING_SMOOTH_MS)
  displayHeading = displayHeading == null ? target : lerpAngle(displayHeading, target, blend)

  traveller3D?.setBearing(displayHeading)

  if (!showTraveller3D.value) updateFlatFacing(deltaMs)

  if (otterView.value && following.value && here.value) updateOtterCamera(deltaMs)
}

function updateFlatFacing(deltaMs) {
  if (!player || !map || displayHeading == null) return

  const known = headingIsKnown()
  setPlayerFacing(player, displayHeading - map.getBearing(), known)

  if (!flatMode.value || !cameraFollowing.value || !known) return

  const current = map.getBearing()
  const blend = 1 - Math.exp(-deltaMs / FLAT_BEARING_SMOOTH_MS)
  const next = lerpAngle(current, displayHeading, blend)
  // Below a fifth of a degree the turn is invisible but still costs a repaint.
  if (Math.abs(((next - current + 540) % 360) - 180) > 0.2) map.setBearing(next)
}

function updateOtterCamera(deltaMs) {
  if (!map || !here.value || displayHeading == null) return

  const focus = pointAtOffset(here.value, displayHeading, OTTER_VIEW.lookAheadM)

  if (!otterCamera) {
    otterCamera = { lng: focus.lng, lat: focus.lat, bearing: displayHeading }
    map.jumpTo({ center: [focus.lng, focus.lat], bearing: displayHeading })
    return
  }

  const blend = 1 - Math.exp(-deltaMs / OTTER_VIEW.smoothMs)
  otterCamera.lng += (focus.lng - otterCamera.lng) * blend
  otterCamera.lat += (focus.lat - otterCamera.lat) * blend

  // Skip sub-pixel updates while stationary: avoids re-rendering for nothing.
  const bearingDelta = Math.abs(((displayHeading - otterCamera.bearing + 540) % 360) - 180)
  const remainingGap = Math.abs(focus.lng - otterCamera.lng) + Math.abs(focus.lat - otterCamera.lat)
  if (bearingDelta < 0.05 && remainingGap < 1e-7) return

  otterCamera.bearing = displayHeading
  map.jumpTo({
    center: [otterCamera.lng, otterCamera.lat],
    bearing: displayHeading
  })
}

function applyOtterView() {
  if (!map || !here.value) return

  displayHeading = facingHeading()
  const focus = pointAtOffset(here.value, displayHeading, OTTER_VIEW.lookAheadM)
  otterCamera = { lng: focus.lng, lat: focus.lat, bearing: displayHeading }

  map.jumpTo({
    center: [focus.lng, focus.lat],
    bearing: displayHeading,
    pitch: OTTER_VIEW.pitch,
    zoom: OTTER_VIEW.zoom
  })
}

function toggleOtterView() {
  otterView.value = !otterView.value

  if (!otterView.value) {
    otterCamera = null
    following.value = true
    if (here.value) {
      map.easeTo({
        center: [here.value.lng, here.value.lat],
        pitch: 56,
        bearing: -18,
        zoom: 18,
        duration: 900
      })
    } else {
      animateTo3D()
    }
    return
  }

  if (flatMode.value) setFlatMode(false)
  following.value = true
  showTraveller3D.value = true
  // Called from the click gesture, which is what iOS requires for compass access.
  if (!geo.fake) startHeading().catch(() => {})

  otterCamera = null
  applyOtterView()

  if (!here.value) {
    ui.toast('Waiting for GPS… the camera will lock on once it finds you.', 'dark', 3500)
  } else {
    ui.toast('Otter view on: the camera follows the way you face.', 'dark', 3000)
  }
}

async function stampNextStop() {
  const target = next.value
  if (!target || stamping.value) return
  if (!check.value?.ok)
    return ui.toast(check.value?.message || 'Not in range yet.', 'warning', 3500)

  stamping.value = true
  try {
    if (target.kind === 'return') await missionStore.completeReturn()
    else await missionStore.stamp(target)
    liveRoute.value = null
  } catch (err) {
    ui.toast(err.message, 'warning', 4500)
  } finally {
    stamping.value = false
  }
}

async function replan(mode) {
  helpOpen.value = false
  await missionStore.replan(mode)
}

const { cooling: skipping, run: runSkip } = useCooldown()
function skipNextStop() {
  helpOpen.value = false
  if (next.value?.kind !== 'visit') return
  // Without the cooldown a fast double-tap skips two stops and toasts twice.
  return runSkip(async () => {
    await missionStore.skip(next.value)
    ui.toast('Stop skipped. On to the next one.', 'dark')
  })
}

function openAirportHelp() {
  helpOpen.value = false
  airportOpen.value = true
}

const { transitVisible, selectedStop, busAlt, liveSteps, liveStepIndex, attachTransit } =
  useTransit({ getMap: () => map, liveRoute, next, here, liveTravel })
transitVisible.value = savedStyle.transit ?? true

watch([buildingsVisible, buildings3D, transitVisible, mapTheme, colorblindMode], () =>
  writeMapStyle({
    buildings: buildingsVisible.value,
    buildings3D: buildings3D.value,
    transit: transitVisible.value,
    theme: mapTheme.value,
    colorblind: colorblindMode.value
  })
)

function bearingDegrees(a, b) {
  const rad = (degrees) => (degrees * Math.PI) / 180
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat))
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng))
  // Normalised to 0-360 so it matches compass headings and lerpAngle().
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function pointAtOffset(origin, bearing, meters) {
  const [lng, lat] = destination(point([origin.lng, origin.lat]), meters / 1000, bearing, {
    units: 'kilometers'
  }).geometry.coordinates
  return { lat, lng }
}

function pointNearNextStop(meters) {
  const target = next.value
  if (!target) return mission.value?.origin || null
  const previous = previousPoint(target)
  return pointAtOffset(target, bearingDegrees(target, previous), meters)
}

function toggleDemoWalk() {
  if (!geo.fake) {
    setFake(true, here.value || pointNearNextStop(200) || undefined)
    following.value = true
    demoPanelOpen.value = true
    ui.toast('Demo-Walk on: use WASD / arrow keys, or tap the map to move.', 'dark', 4000)
    return
  }

  if (demoPanelOpen.value) {
    demoPanelOpen.value = false
    ui.toast('Demo panel hidden. Press again for real GPS.', 'dark')
    return
  }

  setFake(false)
  ui.toast('Using real GPS.', 'dark')
}

// Demo-Walk can also be left from elsewhere (DevView, a reload), so never leave
// this flag behind.
watch(demo, (on) => {
  if (!on) demoPanelOpen.value = false
})

const cameraLockLabel = computed(() =>
  cameraFollowing.value ? 'Stop following me' : 'Follow me, facing where I face'
)

function toggleCameraFollow() {
  if (cameraFollowing.value) {
    followEnabled.value = false
    following.value = false
    ui.toast('Camera lock off.', 'dark')
    return
  }

  centerOnMe() // sets both flags, starts GPS/compass, and flies back to you
  ui.toast(flatMode.value ? 'Following you, facing where you face.' : 'Following you.', 'dark')
}

function jumpNearNextStop(meters) {
  const place = pointNearNextStop(meters)
  if (!place) return
  if (!geo.fake) {
    setFake(true)
    demoPanelOpen.value = true
  }
  teleport(place)
  following.value = true
}

function onDemoKeyDown(event) {
  if (!geo.fake || !wasdEnabled.value || event.target.closest?.('input, textarea, select')) return
  const key = event.key.toLowerCase()
  if (key in KEY_DIRECTIONS) {
    keys.add(key)
    event.preventDefault()
  }
}

function onDemoKeyUp(event) {
  keys.delete(event.key.toLowerCase())
}

function movementReferenceBearing() {
  const hasCompass = !geo.fake && geo.heading != null
  if (!otterView.value || hasCompass) {
    movementFrameBearing = null
    return map.getBearing()
  }
  if (movementFrameBearing == null) movementFrameBearing = map.getBearing()
  return movementFrameBearing
}

function demoWalkLoop(timestamp) {
  const deltaMs = Math.min(100, timestamp - (lastFrame || timestamp))
  lastFrame = timestamp

  if (keys.size && geo.fake && hasFix() && map) {
    const referenceBearing = movementReferenceBearing()
    let directionX = 0
    let directionY = 0
    for (const key of keys) {
      const angle = ((KEY_DIRECTIONS[key] + referenceBearing) * Math.PI) / 180
      directionX += Math.sin(angle)
      directionY += Math.cos(angle)
    }

    if (directionX || directionY) {
      const metersPerSecond = 1.4 * demoSpeed.value // walking pace × demo multiplier
      const bearing = (Math.atan2(directionX, directionY) * 180) / Math.PI
      teleport(pointAtOffset(here.value, bearing, (metersPerSecond * deltaMs) / 1000))
      if (followEnabled.value) following.value = true // never against an explicit "off"
    }
  } else {
    movementFrameBearing = null
  }

  updateFacing(deltaMs)
  raf = requestAnimationFrame(demoWalkLoop)
}

watch(showMissionCard, (open) => writeMissionCardFlag(open))
watch(
  mapReady,
  (ready) => {
    const { lat, lng } = currentRoute.query
    if (ready && lat && lng) flyTo({ lat: Number(lat), lng: Number(lng) }, 17.5)
  },
  { immediate: true }
)

watch(() => [here.value?.lat, here.value?.lng], onHereChanged)

watch(
  () => [
    mapReady.value,
    mission.value?.id,
    mission.value?.prefs?.transport,
    missionStore.legs
      .map((leg) => `${leg.seq}${leg.status}${leg.place_id}${leg.travel_mode}`)
      .join()
  ],
  onMissionLegsChanged
)

// The leg being travelled now: a new next stop (any plan change saves new leg objects) or a new
// way of getting there (public ↔ car) must fetch its route straight away. Otherwise the old line is
// dropped and nothing redraws it until the traveller moves.
watch(
  () => [next.value, liveTravel.value?.mode],
  ([leg, mode], [prevLeg, prevMode] = []) => {
    if (mapReady.value && (leg !== prevLeg || mode !== prevMode)) refreshLiveRoute(true)
  }
)

watch(check, drawFence)
watch(showTraveller3D, (visible) => {
  // Otter view needs the 3D character; hiding him releases the camera lock.
  if (!visible && otterView.value) {
    otterView.value = false
    otterCamera = null
    map?.easeTo({ pitch: 56, bearing: -18, duration: 700 })
  }
  syncPlayerAvatar()
})
watch(showStopPins3D, syncStopVisuals)

watch(
  () => [character.outfit, character.fur, character.hat, character.eyewear],
  syncTravellerAppearance
)

watch(mapTheme, applyBasemapStyle)

function onHereChanged() {
  if (!mapReady.value) return

  updatePinProximity(pins, here.value)
  if (!here.value) return

  syncPlayerAvatar()

  // Otter view is followed every frame in updateOtterCamera; a normal follow would
  // fight it.
  if (!otterView.value && following.value) {
    const zoom = map.getZoom() < 15.5 ? 16.8 : undefined
    if (geo.fake && !zoom) map.jumpTo({ center: [here.value.lng, here.value.lat] })
    else map.easeTo({ center: [here.value.lng, here.value.lat], zoom, duration: zoom ? 900 : 600 })
  }

  drawFence()
  refreshLiveRoute()
}

function onMissionLegsChanged() {
  drawMission()
  refreshPlannedRoutes()
  refreshLiveRoute(true)
  // A new next stop can change which way "forward" is while standing still.
  if (otterView.value) travellerHeadingAt = 0
}

function syncTravellerAppearance() {
  if (!traveller3D) return
  // setOutfit rebuilds every slot including head/face, so hats and glasses go after.
  traveller3D.setOutfit(character.outfit)
  traveller3D.setFur(character.fur)
  traveller3D.setHat(character.hat)
  traveller3D.setEyewear(character.eyewear)
}

function readMissionCardFlag() {
  try {
    return localStorage.getItem('zoot.mapMissionCard') === '1'
  } catch {
    return false
  }
}

function readMapStyle() {
  try {
    return JSON.parse(localStorage.getItem('zoot.mapStyle')) || {}
  } catch {
    return {}
  }
}

function writeMapStyle(style) {
  try {
    localStorage.setItem('zoot.mapStyle', JSON.stringify(style))
  } catch {
    // Ignore: the map style just will not persist.
  }
}

function writeMissionCardFlag(open) {
  try {
    localStorage.setItem('zoot.mapMissionCard', open ? '1' : '0')
  } catch {
    // Ignore: the preference just will not persist.
  }
}
</script>
<template>
  <div ref="mapContainer" class="quest-map"></div>

  <div id="right-stack">
    <div
      id="top-right"
      class="badge rounded-4 text-bg-warning zt-hud-chip"
      :class="{ red: isTimeCritical, amber: isTimeWarning }"
      role="timer"
    >
      <span class="bi-airplane-fill"> &nbsp; Time to Travel</span>
      <br />
      <div class="time_left_from_trip mono">{{ countdown || '--:--:--' }}</div>
      <div class="time_back_from_trip">
        {{
          leaveBy
            ? `Head back by ${formatTime(leaveBy)}`
            : mission
              ? 'Quest complete'
              : 'No active quest'
        }}
      </div>
    </div>

    <MapMenuButton :open="mapToolsOpen" @toggle="mapToolsOpen = !mapToolsOpen" />

    <div class="map-tools" :class="{ open: mapToolsOpen }">
      <div id="zoom" class="map-btn" @click="zoomIn">
        <i class="bi bi-zoom-in"></i>
      </div>

      <div id="outlook" class="map-btn" @click="zoomOut">
        <i class="bi bi-arrows-fullscreen"></i>
      </div>

      <div id="RealGps" class="map-btn" title="Centre on me" @click="centerOnMe()">
        <i class="bi bi-crosshair"></i>
      </div>

      <button
        v-if="flatMode"
        id="CameraLock"
        type="button"
        class="map-btn"
        :class="{ active: cameraFollowing }"
        :aria-pressed="cameraFollowing"
        :aria-label="cameraLockLabel"
        :title="cameraLockLabel"
        @click="toggleCameraFollow()"
      >
        <i class="bi bi-cursor-fill" aria-hidden="true"></i>
      </button>

      <button
        v-else
        id="OtterView"
        type="button"
        class="map-btn"
        :class="{ active: otterView }"
        :aria-pressed="otterView"
        :disabled="!showTraveller3D"
        :aria-label="
          showTraveller3D
            ? 'Otter view: third-person camera behind the traveller'
            : 'Otter view needs the 3D traveller switched on'
        "
        :title="showTraveller3D ? 'Otter view' : 'Turn the 3D traveller on to use otter view'"
        @click="toggleOtterView()"
      >
        <i class="bi bi-binoculars-fill" aria-hidden="true"></i>
      </button>

      <div id="TopView" class="map-btn" @click="toggleFlatMode()">
        <i class="bi-map"></i>
      </div>
    </div>
  </div>

  <QuestMapLive :get-map="() => (mapReady ? map : null)" />

  <Transition name="mission-pop">
    <MissionInfoCard
      v-if="showMissionCard"
      :mission="mission"
      :next="next"
      :stop-number="stopNumber"
      :live-travel="liveTravel"
      :distance="distance"
      :late-by="lateBy"
      :guidance="guidance"
      :steps="liveSteps"
      :step-index="liveStepIndex"
      :bus-alternative="busAlt"
      :check="check"
      :stamping="stamping"
      :stamped-count="missionStore.stampedCount"
      :total-visits="missionStore.visitLegs.length"
      :mode-icon="modeIcon"
      :format-distance="formatDistance"
      @plan="router.push('/plan')"
      @open-passport="router.push('/passport')"
      @stamp="stampNextStop"
      @change-map-style="mapStyleOpen = !mapStyleOpen"
      @need-help="helpOpen = true"
      @close="showMissionCard = false"
    />
  </Transition>

  <TransitStopSheet v-if="selectedStop" :stop="selectedStop" @close="selectedStop = null" />

  <MapStatusStack :demo="demo" :panel-open="demoPanelOpen" @toggle-demo="toggleDemoWalk">
    <div v-if="demo && demoPanelOpen" id="demo-controls" class="rounded-4">
      <div class="demo-row">
        <span class="demo-label">Speed</span>
        <button
          class="btn rounded-pill btn-sm"
          :class="demoSpeed === 1 ? 'btn-warning' : 'btn-outline-warning'"
          @click="demoSpeed = 1"
        >
          1x
        </button>
        <button
          class="btn rounded-pill btn-sm"
          :class="demoSpeed === 6 ? 'btn-warning' : 'btn-outline-warning'"
          @click="demoSpeed = 6"
        >
          6x
        </button>
        <button
          class="btn rounded-pill btn-sm"
          :class="demoSpeed === 20 ? 'btn-warning' : 'btn-outline-warning'"
          @click="demoSpeed = 20"
        >
          20x
        </button>
      </div>
      <div class="demo-row">
        <span class="demo-label">WASD movement</span>
        <button
          class="btn rounded-pill btn-sm"
          :class="wasdEnabled === true ? 'btn-warning' : 'btn-outline-warning'"
          @click="wasdEnabled = true"
        >
          Yes
        </button>
        <button
          class="btn rounded-pill btn-sm"
          :class="wasdEnabled === false ? 'btn-warning' : 'btn-outline-warning'"
          @click="wasdEnabled = false"
        >
          No
        </button>
      </div>
      <div class="demo-row">
        <span class="demo-label">CheckPoint</span>
        <button
          class="btn rounded-pill btn-sm btn-outline-warning"
          :disabled="!next"
          @click="jumpNearNextStop(200)"
        >
          Near
        </button>
        <button
          class="btn rounded-pill btn-sm btn-outline-warning"
          :disabled="!next"
          @click="jumpNearNextStop(25)"
        >
          At stop
        </button>
      </div>
      <div class="demo-hint">Tap the map to walk there.</div>
    </div>
  </MapStatusStack>

  <template v-if="helpOpen">
    <div class="map-backdrop" @click="helpOpen = false"></div>
    <div id="HelpPop" class="rounded-4" role="dialog" aria-label="Need help?">
      <button class="btn btn-danger btn-sm w-100 mb-2 airport-cta" @click="openAirportHelp">
        <i class="bi bi-airplane-fill"></i> I need to get to the airport
      </button>
      <p class="help-note">Quickest way from where you are, with MRT or Grab steps.</p>

      <div class="demo-label mb-2">Change the plan</div>
      <p class="help-note">
        Stamped stops stay. Only the stops ahead get rewritten from where you are now.
      </p>
      <button
        class="btn btn-warning btn-sm w-100 mb-2"
        :disabled="missionStore.status === 'planning'"
        @click="replan('behind')"
      >
        <i class="bi bi-hourglass-split"></i> I'm behind schedule
      </button>
      <button
        class="btn btn-warning btn-sm w-100 mb-2"
        :disabled="missionStore.status === 'planning'"
        @click="replan('less-walking')"
      >
        <i class="bi bi-person-walking"></i> Less walking
      </button>
      <button
        class="btn btn-warning btn-sm w-100 mb-2"
        :disabled="missionStore.status === 'planning' || next?.kind !== 'visit'"
        @click="replan('swap')"
      >
        <i class="bi bi-shuffle"></i> Swap this stop
      </button>
      <button
        class="btn btn-warning btn-sm w-100 mb-2"
        :disabled="missionStore.status === 'planning'"
        @click="replan('rain')"
      >
        <i class="bi bi-cloud-rain-heavy-fill"></i> It's raining
      </button>
      <button
        class="btn btn-outline-warning btn-sm w-100 mb-2"
        :disabled="skipping || next?.kind !== 'visit'"
        @click="skipNextStop"
      >
        <i class="bi bi-skip-forward-fill"></i> Skip this stop
      </button>
      <button
        class="btn btn-outline-warning btn-sm w-100"
        @click="router.push(mission ? `/mission/${mission.id}` : '/plan')"
      >
        <i class="bi bi-list-ol"></i> See full itinerary
      </button>
      <div v-if="missionStore.status === 'planning'" class="help-note mt-2">
        {{ missionStore.statusText || 'Replanning…' }}
      </div>
    </div>
  </template>

  <AirportHelp
    v-if="airportOpen"
    :mission="mission"
    :position="here"
    @close="airportOpen = false"
  />

  <div v-if="mapStyleOpen" class="map-backdrop" @click="mapStyleOpen = false"></div>

  <div id="MapPop" class="rounded-4" v-if="mapStyleOpen">
    <div class="demo-row">
      <span class="demo-label">Buildings</span>
      <button
        class="btn rounded-pill btn-sm"
        :class="buildingsVisible === true ? 'btn-warning' : 'btn-outline-warning'"
        @click="setBuildingsVisible(true)"
      >
        On
      </button>
      <button
        class="btn rounded-pill btn-sm"
        :class="buildingsVisible === false ? 'btn-warning' : 'btn-outline-warning'"
        @click="setBuildingsVisible(false)"
      >
        Off
      </button>
    </div>
    <div class="demo-row">
      <span class="demo-label">3D Buildings</span>
      <button
        class="btn rounded-pill btn-sm"
        :class="buildings3D === true ? 'btn-warning' : 'btn-outline-warning'"
        @click="setBuildings3D(true)"
      >
        On
      </button>
      <button
        class="btn rounded-pill btn-sm"
        :class="buildings3D === false ? 'btn-warning' : 'btn-outline-warning'"
        @click="setBuildings3D(false)"
      >
        Off
      </button>
    </div>
    <div class="demo-row">
      <span class="demo-label">MRT &amp; Bus</span>
      <button
        class="btn rounded-pill btn-sm"
        :class="transitVisible === true ? 'btn-warning' : 'btn-outline-warning'"
        @click="transitVisible = true"
      >
        On
      </button>
      <button
        class="btn rounded-pill btn-sm"
        :class="transitVisible === false ? 'btn-warning' : 'btn-outline-warning'"
        @click="transitVisible = false"
      >
        Off
      </button>
    </div>
    <div class="demo-row">
      <span class="demo-label">Color Theme</span>
      <button
        class="btn rounded-pill btn-sm"
        :class="mapTheme === 'theme' ? 'btn-warning' : 'btn-outline-warning'"
        @click="mapTheme = 'theme'"
      >
        Zoot
      </button>
      <button
        class="btn rounded-pill btn-sm"
        :class="mapTheme === 'simple' ? 'btn-warning' : 'btn-outline-warning'"
        @click="mapTheme = 'simple'"
      >
        Simple
      </button>
    </div>
    <div class="demo-row">
      <span class="demo-label">3D Traveller</span>
      <button
        class="btn rounded-pill btn-sm"
        :class="showTraveller3D === true ? 'btn-warning' : 'btn-outline-warning'"
        @click="showTraveller3D = true"
      >
        On
      </button>
      <button
        class="btn rounded-pill btn-sm"
        :class="showTraveller3D === false ? 'btn-warning' : 'btn-outline-warning'"
        @click="showTraveller3D = false"
      >
        Off
      </button>
    </div>
    <div class="demo-row">
      <span class="demo-label">Colorblind Mode</span>
      <button
        class="btn rounded-pill btn-sm"
        :class="colorblindMode === true ? 'btn-warning' : 'btn-outline-warning'"
        @click="setColorblindMode(true)"
      >
        On
      </button>
      <button
        class="btn rounded-pill btn-sm"
        :class="colorblindMode === false ? 'btn-warning' : 'btn-outline-warning'"
        @click="setColorblindMode(false)"
      >
        Off
      </button>
    </div>
  </div>

  <Transition name="fab-pop">
    <button
      v-if="!showMissionCard && !selectedStop"
      type="button"
      class="map-nav-fab"
      aria-label="Show next-stop card"
      @click="showMissionCard = true"
    >
      <i class="bi bi-flag-fill" aria-hidden="true"></i>
    </button>
  </Transition>

  <nav class="map-nav zt-glass" aria-label="Main">
    <RouterLink v-for="item in navItemsBefore" :key="item.to" :to="item.to">
      <i class="bi" :class="item.icon" aria-hidden="true"></i>
      <span>{{ item.label }}</span>
    </RouterLink>
    <RouterLink v-for="item in navItemsAfter" :key="item.to" :to="item.to">
      <i class="bi" :class="item.icon" aria-hidden="true"></i>
      <span>{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.quest-map {
  position: absolute;
  inset: 0;
  /* Without an explicit z-index this element does not form its own stacking
	   context, and the overlays below escape it. */
  z-index: 0;
}

#right-stack {
  position: absolute;
  top: clamp(8px, 3vw, 12px);
  right: clamp(8px, 3vw, 12px);
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: clamp(6px, 2vw, 10px);
}

#top-right {
  padding: clamp(8px, 3.4vw, 14px);
  line-height: 1.6;
  text-align: left;
}

.time_left_from_trip {
  font-size: clamp(20px, 7vw, 30px);
  text-align: left;
}

.map-btn {
  z-index: 1;
  width: clamp(40px, 10.5vw, 48px);
  height: clamp(40px, 10.5vw, 48px);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-family: inherit;
  font-size: clamp(15px, 4.4vw, 20px);
  color: var(--zt-yellow-pale);
  background: var(--zt-black);
  border: clamp(2px, 0.7vw, 3px) solid var(--zt-yellow);
  border-radius: clamp(12px, 3.4vw, 16px);
  box-shadow: var(--zt-shadow-sm);
  cursor: pointer;
  touch-action: manipulation;
}

.map-tools {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: clamp(6px, 2vw, 10px);
  opacity: 0;
  transform: translateY(-12px);
  pointer-events: none;
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.map-tools.open {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

/* Landscape / very short screens: let the drawer scroll instead of overflowing. */
@media (max-height: 640px) {
  .map-tools {
    max-height: calc(100vh - 170px);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0 4px 4px 0;
  }
}

#demo-controls {
  background: var(--zt-black);
  border: clamp(2px, 1vw, 4px) solid var(--zt-yellow);
  padding: clamp(8px, 3vw, 12px) clamp(10px, 3.8vw, 16px);
}

.demo-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.demo-row + .demo-row {
  margin-top: 8px;
}

.demo-label {
  color: var(--zt-yellow-pale);
  font-size: clamp(0.65rem, 2.4vw, 0.75rem);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-right: 4px;
  min-width: clamp(80px, 26vw, 110px);
}

.map-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  background: rgba(0, 0, 0, 0.3);
}

#MapPop {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
  background: var(--zt-black);
  border: clamp(2px, 1vw, 4px) solid var(--zt-yellow);
  box-shadow: var(--zt-shadow);
  padding: clamp(8px, 3vw, 12px) clamp(10px, 3.8vw, 16px);
}

.map-btn.active {
  color: var(--zt-black);
  background: var(--zt-yellow);
}

.map-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

#top-right.amber {
  background: var(--zt-orange) !important;
}

#top-right.red {
  background: #e5243b !important;
  color: #fff !important;
  animation: ttg-alarm 1.2s infinite;
}

@keyframes ttg-alarm {
  0% {
    box-shadow: 0 0 0 0 rgba(229, 36, 59, 0.7);
  }

  70%,
  100% {
    box-shadow: 0 0 0 16px rgba(229, 36, 59, 0);
  }
}

.time_back_from_trip {
  font-size: clamp(0.7rem, 2.6vw, 0.8rem);
}

.demo-hint {
  color: var(--zt-yellow-pale);
  opacity: 0.7;
  font-size: clamp(0.62rem, 2.2vw, 0.7rem);
  margin-top: 8px;
}

#HelpPop {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
  width: min(340px, 90vw);
  max-height: 86vh;
  overflow-y: auto;
  background: var(--zt-black);
  border: clamp(2px, 1vw, 4px) solid var(--zt-yellow);
  box-shadow: var(--zt-shadow);
  padding: clamp(10px, 4vw, 16px);
}
#HelpPop .btn-warning {
  color: var(--zt-black);
  font-weight: 700;
  text-align: left;
}
#HelpPop .btn-outline-warning {
  text-align: left;
}
#HelpPop .airport-cta {
  font-weight: 800;
  text-align: left;
}
.help-note {
  color: var(--zt-yellow-pale);
  opacity: 0.75;
  font-size: clamp(0.65rem, 2.4vw, 0.75rem);
  margin-bottom: 10px;
}

.map-nav {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: var(--zt-nav-inset);
  width: min(520px, calc(100% - 24px));
  height: var(--zt-nav-h);
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr; /* one column per tab, like the shared AppNav */
  border-radius: 26px;
  box-shadow: var(--zt-shadow);
  z-index: 1030;
}
.map-nav a {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  color: var(--zt-ink);
  text-decoration: none;
  font-size: 0.66rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 18px;
  margin: 6px;
  border: 2px solid transparent;
  background: none;
  padding: 0;
  cursor: pointer;
}
.map-nav a i {
  font-size: 1.3rem;
  line-height: 1;
}
@media (max-width: 440px) {
  .map-nav a {
    margin: 6px 2px;
    font-size: 0.58rem;
    letter-spacing: 0.01em;
  }
  .map-nav a i {
    font-size: 1.15rem;
  }
}
.map-nav a.router-link-active {
  color: #111;
  background: var(--zt-yellow);
  border-color: var(--zt-line);
}

.map-nav-fab {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: var(--zt-nav-dock);
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--zt-black);
  border: clamp(2px, 1vw, 4px) solid var(--zt-yellow);
  color: var(--zt-yellow-pale);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  z-index: 1031;
}

.mission-pop-enter-active {
  animation: mission-pop-bounce 0.42s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.mission-pop-leave-active {
  animation: mission-pop-bounce 0.2s ease reverse forwards;
}
@keyframes mission-pop-bounce {
  from {
    opacity: 0;
    transform: translate(-50%, 28px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0) scale(1);
  }
}

.fab-pop-enter-active {
  animation: fab-pop-bounce 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fab-pop-leave-active {
  animation: fab-pop-bounce 0.18s ease reverse forwards;
}
@keyframes fab-pop-bounce {
  from {
    opacity: 0;
    transform: translate(-50%, 10px) scale(0.6);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0) scale(1);
  }
}
</style>

<!-- Map markers are created by MapLibre outside this component, so their styles
     cannot be scoped. -->
<style>
.zt-stop-marker {
  width: clamp(26px, 8vw, 34px);
  height: clamp(26px, 8vw, 34px);
  border-radius: 50%;
  border: clamp(2px, 0.9vw, 3px) solid #111;
  background: #fff4c2;
  color: #111;
  font-weight: 800;
  font-size: clamp(0.78rem, 2.8vw, 0.95rem);
  display: grid;
  place-items: center;
  box-shadow: 3px 3px 0 #111;
  cursor: pointer;
  padding: 0;
}
.zt-stop-marker.next {
  background: #f83878;
  color: #fff;
  width: clamp(32px, 10vw, 42px);
  height: clamp(32px, 10vw, 42px);
  font-size: clamp(0.92rem, 3.2vw, 1.1rem);
  z-index: 2;
  animation: zt-marker-pulse 1.4s infinite;
}
.zt-stop-marker.done {
  background: #111;
  color: #ffcc00;
  border-color: #ffcc00;
  box-shadow: none;
}
@keyframes zt-marker-pulse {
  0% {
    box-shadow:
      3px 3px 0 #111,
      0 0 0 0 rgba(248, 56, 120, 0.7);
  }
  70%,
  100% {
    box-shadow:
      3px 3px 0 #111,
      0 0 0 16px rgba(248, 56, 120, 0);
  }
}

.zt-player-marker {
  position: relative;
  width: clamp(30px, 10vw, 40px);
  height: clamp(30px, 10vw, 40px);
  pointer-events: none;
}
.zt-player-marker .core {
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  background: #ffcc00;
  border: clamp(2px, 0.9vw, 3px) solid #111;
  color: #111;
  display: grid;
  place-items: center;
  font-size: clamp(0.8rem, 2.8vw, 1rem);
}

.zt-player-marker .pulse {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(255, 204, 0, 0.45);
  animation: zt-player-pulse 1.8s ease-out infinite;
}

/* `from -35deg` centres the 70deg slice on straight up, so setPlayerFacing can
   rotate it by the heading directly. */
.zt-player-marker .cone {
  position: absolute;
  left: 50%;
  top: 50%;
  width: clamp(88px, 28vw, 132px);
  height: clamp(88px, 28vw, 132px);
  transform: translate(-50%, -50%) rotate(0deg);
  border-radius: 50%;
  background: conic-gradient(
    from -35deg,
    rgba(217, 119, 6, 0.88) 0deg,
    rgba(234, 140, 10, 0.66) 42deg,
    rgba(245, 158, 11, 0.3) 62deg,
    transparent 70deg
  );
  -webkit-mask-image: radial-gradient(
    circle at 50% 50%,
    rgba(0, 0, 0, 1) 32%,
    rgba(0, 0, 0, 0.8) 58%,
    transparent 84%
  );
  mask-image: radial-gradient(
    circle at 50% 50%,
    rgba(0, 0, 0, 1) 32%,
    rgba(0, 0, 0, 0.8) 58%,
    transparent 84%
  );
  opacity: 0; /* no heading yet; setPlayerFacing fades it in */
  pointer-events: none;
  transition: opacity 0.25s ease;
}

/* The cone is decoration, and a 60 fps rotation is what this asks to stop. */
@media (prefers-reduced-motion: reduce) {
  .zt-player-marker .cone {
    transition: none;
  }
}

.psi-dot {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1.5px solid #111;
  margin-left: 2px;
}
.psi-good {
  background: #2e9e5b;
}
.psi-moderate {
  background: #f5f5f5;
} /* white dot with a dark ring reads on yellow */
.psi-unhealthy {
  background: #e07a1f;
}
.psi-very-unhealthy,
.psi-hazardous {
  background: #d6322e;
}

@keyframes zt-player-pulse {
  from {
    transform: scale(0.8);
    opacity: 1;
  }

  to {
    transform: scale(2.2);
    opacity: 0;
  }
}
</style>

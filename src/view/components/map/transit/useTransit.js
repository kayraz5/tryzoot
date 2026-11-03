import { computed, ref, watch } from 'vue'
import { distanceM } from '../../../../model/services/distance.js'
import { getBusAlternative, transitSteps, currentPartIndex } from '../../../../model/services/transit/index.js'
import { addTransitLayers, syncBusStops, setTransitVisible, TAPPABLE_LAYERS } from './layers.js'

const BUS_STOPS_RELOAD_M = 400 // reload nearby bus stops after the camera moves this far

/**
 * Everything public-transport the map screen needs, so MapView only wires it up:
 *   transitVisible  the "MRT & Bus" layer toggle
 *   selectedStop    the station / bus stop the traveller tapped (opens TransitStopSheet)
 *   busAlt          a single bus that replaces a taxi leg, if there is one
 *   liveSteps / liveStepIndex   step-by-step for the leg being travelled, and where they are in it
 *   attachTransit(map, isDark)  add the layers and tap / bus-stop handlers once the map loads
 *
 * `liveRoute`, `next`, `here` and `liveTravel` are MapView's refs; `getMap` returns its map.
 */
export function useTransit({ getMap, liveRoute, next, here, liveTravel }) {
  const transitVisible = ref(true)
  const selectedStop = ref(null) // { kind: 'station'|'bus', name, … } from a tap
  const busAlt = ref(null) // { service, stop, minutes } or null
  let busStopsAt = null // map centre bus stops were last loaded around

  // Steps only for the leg actually being travelled (bus/MRT legs have parts; walks don't).
  const liveParts = computed(() => (liveRoute.value?.to === next.value ? liveRoute.value?.parts : null) || null)
  const liveSteps = computed(() => transitSteps(liveParts.value))
  const liveStepIndex = computed(() => currentPartIndex(liveParts.value, here.value))

  /** Tap on a station or bus stop: open its sheet (lines, or live bus arrivals). */
  function onTap(event) {
    const map = getMap()
    if (!transitVisible.value || !map) return
    const { x, y } = event.point
    const layers = TAPPABLE_LAYERS.filter((id) => map.getLayer(id))
    const hit = map.queryRenderedFeatures([[x - 14, y - 14], [x + 14, y + 14]], { layers })[0]
    if (!hit) return
    const [lng, lat] = hit.geometry.coordinates
    selectedStop.value = { ...hit.properties, lat, lng }
  }

  /** Bus stops only show at street zoom, so load the ones around wherever the camera is. */
  function loadBusStopsInView() {
    const map = getMap()
    if (!map || map.getZoom() < 14.5) return
    const { lat, lng } = map.getCenter()
    if (busStopsAt && distanceM(busStopsAt, { lat, lng }) < BUS_STOPS_RELOAD_M) return
    busStopsAt = { lat, lng }
    syncBusStops(map, busStopsAt)
  }

  function attachTransit(map, isDark) {
    addTransitLayers(map, isDark)
    map.on('click', onTap)
    map.on('moveend', loadBusStopsInView)
  }

  // A taxi leg (no train nearby): is there one bus that does the job?
  watch(() => [next.value, liveTravel.value?.mode], async () => {
    busAlt.value = null
    const target = next.value
    if (!target || !here.value || liveTravel.value?.mode !== 'taxi') return
    const alt = await getBusAlternative({ ...here.value }, target)
    if (next.value === target) busAlt.value = alt
  })

  watch(transitVisible, (visible) => {
    const map = getMap()
    if (map) setTransitVisible(map, visible)
    if (!visible) selectedStop.value = null
  })

  return { transitVisible, selectedStop, busAlt, liveSteps, liveStepIndex, attachTransit }
}

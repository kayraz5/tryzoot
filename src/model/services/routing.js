// EDITOR: MATTHEW
// Each mode tries its providers in order and returns null only when all have failed.
// Callers must never draw straight() on a null - they keep the last-good geometry.
//
// router.project-osrm.org's "foot" path silently serves car geometry whatever profile
// you ask for (it ignores the profile segment), so it is only ever used for drive.

const TIMEOUT_MS = 6000

async function fetchJson(url, opts) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal })
    if (!res.ok) throw new Error(`${url} -> ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

function osrm(baseUrl, { steps = false } = {}) {
  return async (from, to) => {
    const json = await fetchJson(
      `${baseUrl}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=${steps}`
    )
    const route = json.routes?.[0]
    if (!route) throw new Error('no route')
    return {
      coords: route.geometry.coordinates,
      distance_m: route.distance,
      ...(steps && {
        steps: route.legs[0].steps.map((s) => ({
          ...describe(s.maneuver, s.name),
          name: s.name,
          distance_m: s.distance,
          at: { lng: s.maneuver.location[0], lat: s.maneuver.location[1] }
        }))
      })
    }
  }
}

/** Server-proxied OpenRouteService failover; the key never reaches the client. */
function proxy(profile) {
  return async (from, to) => {
    const json = await fetchJson('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start: [from.lng, from.lat], end: [to.lng, to.lat], profile })
    })
    if (!json?.coords) throw new Error('no route')
    return json
  }
}

const PROVIDERS = {
  walk: [
    osrm('https://routing.openstreetmap.de/routed-foot/route/v1/driving', { steps: true }),
    proxy('walk')
  ],
  drive: [
    osrm('https://routing.openstreetmap.de/routed-car/route/v1/driving'),
    osrm('https://router.project-osrm.org/route/v1/driving'),
    proxy('taxi')
  ]
}

async function tryProviders(providers, from, to) {
  for (const p of providers) {
    try {
      return await p(from, to)
    } catch {}
  }
  return null // every provider in the list failed
}

function router(mode) {
  const cache = new Map()
  return function getRoute(from, to) {
    const key = [from.lng, from.lat, to.lng, to.lat].map((n) => n.toFixed(5)).join(',')
    if (!cache.has(key)) {
      const job = tryProviders(PROVIDERS[mode], from, to)
      cache.set(key, job)
      job.then((r) => {
        if (!r) cache.delete(key)
      }) // don't remember an all-failed result — retry next time
    }
    return cache.get(key)
  }
}

export const getWalkRoute = router('walk')
export const getDriveRoute = router('drive')

const ICONS = {
  left: 'bi-arrow-left',
  'sharp left': 'bi-arrow-left',
  'slight left': 'bi-arrow-up-left',
  right: 'bi-arrow-right',
  'sharp right': 'bi-arrow-right',
  'slight right': 'bi-arrow-up-right',
  straight: 'bi-arrow-up',
  uturn: 'bi-arrow-return-left'
}

function describe({ type, modifier }, name) {
  const onto = name ? ` onto ${name}` : ''
  if (type === 'depart')
    return { text: `Head off${name ? ' along ' + name : ''}`, icon: 'bi-person-walking' }
  if (type === 'arrive') return { text: 'Arrive at the stop', icon: 'bi-flag-fill' }
  if (type === 'roundabout' || type === 'rotary')
    return { text: `Go round the roundabout${onto}`, icon: 'bi-arrow-repeat' }
  const icon = ICONS[modifier] || 'bi-arrow-up'
  if (!modifier || modifier === 'straight') return { text: `Continue straight${onto}`, icon }
  if (modifier === 'uturn') return { text: `Make a U-turn${onto}`, icon }
  const verb = type === 'fork' ? 'Keep' : 'Turn'
  return { text: `${verb} ${modifier}${onto}`, icon }
}

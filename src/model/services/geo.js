// EDITOR: MATTHEW
import { reactive } from 'vue'

// `heading` is degrees clockwise from north; null means unknown (no magnetometer,
// denied permission, desktop), and consumers must fall back to movement direction.
export const geo = reactive({
  lat: null,
  lng: null,
  accuracy: null,
  source: null,
  fake: false,
  heading: null
})

let watchId = null
let headingStarted = false
let headingDenied = false
let headingListener = null

export function hasFix() {
  return geo.lat != null && geo.lng != null
}

export function hasHeading() {
  return geo.heading != null
}

/* The compass reports where the device's natural top edge points, not where the
   top of the screen points. They match in portrait; in landscape they differ by
   exactly this angle, which is why an uncorrected cone is 90 degrees off. */
function screenAngle() {
  if (typeof window === 'undefined') return 0

  const angle = window.screen?.orientation?.angle
  if (Number.isFinite(angle)) return angle

  // Legacy iOS: window.orientation reports −90 where the modern API says 270.
  const legacy = window.orientation
  return Number.isFinite(legacy) ? ((legacy % 360) + 360) % 360 : 0
}

export function startGps() {
  if (watchId != null || typeof navigator === 'undefined' || !navigator.geolocation) return
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (geo.fake) return
      geo.lat = pos.coords.latitude
      geo.lng = pos.coords.longitude
      geo.accuracy = pos.coords.accuracy
      geo.source = 'gps'
    },
    (err) => console.warn('[geo]', err.message),
    { enableHighAccuracy: true, maximumAge: 5000 }
  )
}

export function setFake(on, point) {
  geo.fake = on
  if (on) {
    if (point) teleport(point)
  } else {
    geo.lat = geo.lng = geo.accuracy = geo.source = null
    startGps()
  }
}

export function teleport({ lat, lng }) {
  geo.lat = lat
  geo.lng = lng
  geo.accuracy = 5
  geo.source = 'fake'
}

/* iOS 13+ requires requestPermission() from a user gesture, so the map calls this
   on mount (fine on Android/desktop) and retries from taps when iOS needs consent. */
export async function startHeading() {
  if (headingStarted) return true
  if (headingDenied || typeof window === 'undefined') return false

  const OrientationEvent = window.DeviceOrientationEvent
  if (!OrientationEvent) return false

  if (typeof OrientationEvent.requestPermission === 'function') {
    try {
      const permission = await OrientationEvent.requestPermission()
      if (permission !== 'granted') {
        headingDenied = true
        return false
      }
    } catch {
      // Not from a gesture, or dismissed: retry on a tap.
      return false
    }
  }

  headingListener = (event) => {
    let degrees = null

    // iOS reports a ready-made compass heading (clockwise from magnetic north).
    if (
      typeof event.webkitCompassHeading === 'number' &&
      Number.isFinite(event.webkitCompassHeading)
    ) {
      degrees = event.webkitCompassHeading
    } else if (
      Number.isFinite(event.alpha) &&
      (event.absolute || event.type === 'deviceorientationabsolute')
    ) {
      // `alpha` rotates counter-clockwise, so invert it for a compass bearing.
      degrees = 360 - event.alpha
    }

    if (degrees == null) return
    geo.heading = ((degrees + screenAngle()) % 360 + 360) % 360
  }

  // Android exposes a reliably north-referenced event; iOS uses the regular one.
  window.addEventListener('deviceorientationabsolute', headingListener, true)
  window.addEventListener('deviceorientation', headingListener, true)
  headingStarted = true
  return true
}

export function stopHeading() {
  if (headingListener && typeof window !== 'undefined') {
    window.removeEventListener('deviceorientationabsolute', headingListener, true)
    window.removeEventListener('deviceorientation', headingListener, true)
  }
  headingListener = null
  headingStarted = false
  geo.heading = null
}

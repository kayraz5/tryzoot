import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCleanSlate } from '../../support/unit/index.js'

useCleanSlate()

const loadGeo = () => import('../../../src/model/services/geo.js')

/** Pose the browser as a device held at `angle` degrees of screen rotation. */
function screenAt(angle) {
  vi.stubGlobal('screen', { orientation: { angle } })
}

beforeEach(() => {
  vi.resetModules()
  // jsdom has no DeviceOrientationEvent; the listener only needs the constructor
  // to exist, and no requestPermission (that is the Android / desktop path).
  vi.stubGlobal('DeviceOrientationEvent', function DeviceOrientationEvent() {})
})

afterEach(async () => {
  const { stopHeading } = await loadGeo()
  stopHeading()
})

/**
 * Fire an orientation reading and return the heading geo settled on.
 * `deviceorientationabsolute` is north-referenced by definition, so it is trusted
 * without an `absolute` flag; plain `deviceorientation` needs the flag.
 */
async function headingFrom(event, type = 'deviceorientationabsolute') {
  const { startHeading, geo } = await loadGeo()
  await startHeading()
  window.dispatchEvent(Object.assign(new Event(type), event))
  return geo.heading
}

describe('compass heading', () => {
  it('reads iOS webkitCompassHeading straight through in portrait', async () => {
    screenAt(0)
    expect(await headingFrom({ webkitCompassHeading: 125 })).toBe(125)
  })

  it('inverts Android alpha, which counts counter-clockwise', async () => {
    screenAt(0)
    expect(await headingFrom({ alpha: 90, absolute: true })).toBe(270)
  })

  it('corrects for a landscape screen, so the cone tracks the phone', async () => {
    // Device top points north, but the page is rotated 90°: the top of the screen
    // — where the user is actually looking — points east.
    screenAt(90)
    expect(await headingFrom({ webkitCompassHeading: 0 })).toBe(90)
  })

  it('corrects the other landscape too, wrapping past 360', async () => {
    screenAt(270)
    expect(await headingFrom({ webkitCompassHeading: 180 })).toBe(90) // 180 + 270 = 450 → 90
  })

  it('corrects upside-down portrait', async () => {
    screenAt(180)
    expect(await headingFrom({ webkitCompassHeading: 10 })).toBe(190)
  })

  it('reads legacy window.orientation when screen.orientation is absent', async () => {
    vi.stubGlobal('screen', {}) // old iOS Safari
    vi.stubGlobal('orientation', -90) // the modern API would call this 270
    expect(await headingFrom({ webkitCompassHeading: 180 })).toBe(90)
  })

  it('trusts alpha on deviceorientationabsolute without an absolute flag', async () => {
    screenAt(0)
    expect(await headingFrom({ alpha: 90 })).toBe(270)
  })

  it('ignores a relative alpha on the plain deviceorientation event', async () => {
    screenAt(0)
    expect(await headingFrom({ alpha: 90 }, 'deviceorientation')).toBe(null)
  })

  it('still takes a flagged-absolute alpha on the plain event', async () => {
    screenAt(0)
    expect(await headingFrom({ alpha: 90, absolute: true }, 'deviceorientation')).toBe(270)
  })

  it('ignores a reading with no usable angle at all', async () => {
    screenAt(0)
    expect(await headingFrom({ alpha: null, absolute: true })).toBe(null)
  })

  it('stopHeading clears the reading so stale facing is never reused', async () => {
    screenAt(0)
    const { startHeading, stopHeading, geo, hasHeading } = await loadGeo()
    await startHeading()
    window.dispatchEvent(Object.assign(new Event('deviceorientationabsolute'), { webkitCompassHeading: 42 }))
    expect(hasHeading()).toBe(true)

    stopHeading()
    expect(geo.heading).toBe(null)
    expect(hasHeading()).toBe(false)
  })
})

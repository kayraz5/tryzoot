// EDITOR: STEVEN
import { describe, beforeEach, expect, it, vi } from 'vitest'
import mrtLines from '../../../src/model/data/mrtLines.sg.json'
import { distanceM } from '../../../src/model/services/distance.js'
import { HUBS } from '../../../src/model/services/travel.js'
import { getWalkRoute } from '../../../src/model/services/routing.js'
import { getMrtRoute } from '../../../src/model/services/transit/mrt.js'
import { useCleanSlate } from '../../support/unit/index.js'

vi.mock('../../../src/model/services/routing.js', () => ({
  getWalkRoute: vi.fn(),
}))

useCleanSlate()

const changiT3 = { lat: 1.3563, lng: 103.9866 }
const cityHall = { lat: 1.2935, lng: 103.8532 }
// Over 800 m from Napier's nearest exit: too far for the indoor-hop fallback in walk.js.
const botanicGardens = { lat: 1.3138, lng: 103.8159 }

const passesNear = (coords, hub, metres = 300) =>
  coords.some(([lng, lat]) => distanceM({ lat, lng }, hub) <= metres)

const twoPointWalk = (from, to) => ({
  coords: [[from.lng, from.lat], [to.lng, to.lat]],
})

beforeEach(() => {
  getWalkRoute.mockImplementation(async (from, to) => twoPointWalk(from, to))
})

describe('MRT route service', () => {
  it('stitches the Changi T3 to City Hall walk and rail geometry', async () => {
    const route = await getMrtRoute(changiT3, cityHall)

    expect(route).toEqual(expect.objectContaining({
      coords: expect.any(Array),
      distance_m: expect.any(Number),
    }))
    expect(route.distance_m).toBeGreaterThan(0)
    expect(route.coords[0]).toEqual([changiT3.lng, changiT3.lat])
    expect(route.coords.at(-1)).toEqual([cityHall.lng, cityHall.lat])
    // Walks end at a station exit and rides follow real track, so the hub point itself is not a vertex.
    expect(passesNear(route.coords, HUBS.changi_airport)).toBe(true)
    expect(passesNear(route.coords, HUBS.city_hall)).toBe(true)
    expect(route.parts.map((part) => part.line || part.mode)).toEqual(['walk', 'CG', 'EW', 'walk'])
    expect(getWalkRoute).toHaveBeenCalledTimes(2)
  })

  it('returns null when both points resolve to the same hub', async () => {
    const point = { lat: HUBS.city_hall.lat, lng: HUBS.city_hall.lng }

    await expect(getMrtRoute(point, point)).resolves.toBeNull()
    expect(getWalkRoute).not.toHaveBeenCalled()
  })

  it('returns null when a required walk leg is unavailable', async () => {
    getWalkRoute.mockResolvedValue(null)

    await expect(getMrtRoute(changiT3, botanicGardens)).resolves.toBeNull()
  })

  it('bridges a short indoor hop when the street router has no walk', async () => {
    getWalkRoute.mockResolvedValue(null)
    const route = await getMrtRoute(changiT3, cityHall)

    expect(route.parts[0].coords).toHaveLength(2)
    expect(route.parts.at(-1).coords).toHaveLength(2)
  })

  it('draws the Sentosa Express station to station (it has no track dataset)', async () => {
    const route = await getMrtRoute(HUBS.harbourfront, HUBS.rws)

    expect(route.parts.find((part) => part.mode === 'mrt').line).toBe('SE')
    expect(route).toEqual(expect.objectContaining({
      coords: expect.any(Array),
      distance_m: expect.any(Number),
    }))
    expect(route.distance_m).toBeGreaterThan(0)
    expect(route.coords[0]).toEqual([HUBS.harbourfront.lng, HUBS.harbourfront.lat])
    expect(route.coords.at(-1)).toEqual([HUBS.rws.lng, HUBS.rws.lat])
  })
})

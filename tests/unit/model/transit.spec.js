// EDITOR: KAYRA
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HUBS, nearestHub, transit, travel } from '../../../src/model/services/travel.js'
import { hubByCode, rideDirection } from '../../../src/model/services/transit/network.js'
import { transitSteps, transferPoints, currentPartIndex } from '../../../src/model/services/transit/steps.js'
import { decodePolyline } from '../../../src/model/services/transit/polyline.js'

const CHANGI = { lat: 1.3574, lng: 103.9884 }
const ORCHARD = { lat: 1.304, lng: 103.832 }

describe('MRT network', () => {
  it('knows every station, not just a hand-picked few', () => {
    expect(Object.keys(HUBS).length).toBeGreaterThan(140)
    expect(nearestHub({ lat: 1.3496, lng: 103.8735 }).name).toBe('Serangoon') // not in the old 35-station graph
  })

  it('plans Changi → Orchard as Changi branch, East West Line, North South Line, with directions', () => {
    const t = transit(CHANGI, ORCHARD)
    expect(t.lines).toEqual(['CG', 'EW', 'NS'])
    expect(t.runs.map((r) => [r.line, HUBS[r.to].name, HUBS[r.towards].name])).toEqual([
      ['CG', 'Tanah Merah', 'Tanah Merah'],
      ['EW', 'City Hall', 'Tuas Link'],
      ['NS', 'Orchard', 'Jurong East']
    ])
    expect(t.runs[1].stops).toBe(9)
    expect(t.minutes).toBeGreaterThan(35)
    expect(t.minutes).toBeLessThan(60)
  })

  it('describes MRT legs by official line name, not code or colour', () => {
    expect(travel(CHANGI, ORCHARD).detail).toBe('MRT Changi Airport → Orchard · East West Line → North South Line')
  })
})

describe('transitSteps', () => {
  const parts = [
    { mode: 'walk', minutes: 4, coords: [[103.85, 1.3], [103.851, 1.3]], to: { name: 'Bugis', kind: 'station', exit: 'C' } },
    { mode: 'mrt', line: 'EW', coords: [[103.851, 1.3], [103.852, 1.293]], from: { name: 'Bugis', lat: 1.3, lng: 103.851 }, to: { name: 'City Hall', lat: 1.293, lng: 103.852 }, stops: 1, towards: 'Tuas Link' },
    { mode: 'mrt', line: 'NS', coords: [[103.852, 1.293], [103.832, 1.304]], from: { name: 'City Hall', lat: 1.293, lng: 103.852 }, to: { name: 'Orchard', lat: 1.304, lng: 103.832 }, stops: 3, towards: 'Jurong East' },
    { mode: 'walk', minutes: 3, coords: [[103.832, 1.304], [103.831, 1.305]], from: { name: 'Orchard', exit: 'E' }, to: { name: 'ION Sky', kind: 'place' } }
  ]

  it('reads like directions a first-timer can follow', () => {
    const steps = transitSteps(parts)
    expect(steps.map((s) => s.title)).toEqual([
      'Walk to Bugis MRT station · 4 min',
      'Take the East West Line towards Tuas Link',
      'Change at City Hall to the North South Line towards Jurong East',
      'Walk to ION Sky · 3 min'
    ])
    expect(steps[0].detail).toContain('Exit C')
    expect(steps[1].detail).toBe('1 stop · get off at City Hall')
    expect(steps[3].detail).toBe('Leave by Exit E')
  })

  it('pins where to board, change and get off', () => {
    expect(transferPoints(parts).map((p) => p.label)).toEqual(['Board · East West Line', 'Change · North South Line', 'Get off · Orchard'])
  })

  it('knows which step you are on from your position', () => {
    expect(currentPartIndex(parts, { lat: 1.3, lng: 103.8503 })).toBe(0)
    expect(currentPartIndex(parts, { lat: 1.298, lng: 103.842 })).toBe(2)
  })
})

describe('decodePolyline', () => {
  it('decodes Google polylines to [lng, lat]', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC')).toEqual([[-120.2, 38.5], [-120.95, 40.7]])
  })
})

describe('findDirectBus', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('finds a single bus between stops near each end', async () => {
    const data = {
      stops: {
        '01012': [103.8545, 1.2967, 'Hotel Grand Pacific', 'Victoria St', ['7']],
        '01013': [103.8560, 1.2990, 'St. Joseph\'s Ch', 'Victoria St', ['7']],
        '09047': [103.8350, 1.3040, 'Orchard Stn', 'Orchard Rd', ['7']]
      },
      services: { 7: { name: 'A ⇄ B', routes: [['01012', '01013', '09047']], lines: [] } }
    }
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('bus.sg.json')) return { ok: true, json: async () => data }
      // OSRM walk routes
      const [a, b] = String(url).split('/').pop().split('?')[0].split(';').map((p) => p.split(',').map(Number))
      return { ok: true, json: async () => ({ routes: [{ geometry: { coordinates: [a, b] }, distance: 100, legs: [{ steps: [] }] }] }) }
    }))
    const { findDirectBus } = await import('../../../src/model/services/transit/bus.js')
    const route = await findDirectBus({ lat: 1.2965, lng: 103.8542 }, { lat: 1.3042, lng: 103.8352, name: 'Orchard' })
    const bus = route.parts.find((p) => p.mode === 'bus')
    expect(bus.service).toBe('7')
    expect(bus.from.code).toBe('01012')
    expect(bus.to.code).toBe('09047')
    expect(bus.stops).toBe(2)
    expect(transitSteps(route.parts)[1].title).toBe('Take bus 7 towards Orchard Stn')
  })
})

describe('which way to ride', () => {
  const dir = (line, from, next) => {
    const d = rideDirection(line, hubByCode(from), hubByCode(next))
    return d.loop || (d.towards && HUBS[d.towards].name)
  }

  it('names the terminus on lines with two ends', () => {
    expect(dir('EW', 'EW4', 'EW5')).toBe('Tuas Link') // Tanah Merah → Bedok, heading west
    expect(dir('EW', 'EW5', 'EW4')).toBe('Pasir Ris')
  })

  it('says clockwise or anti-clockwise round the Circle loop', () => {
    expect(dir('CC', 'CC19', 'CC17')).toBe('clockwise') // Botanic Gardens → Caldecott: west to north
    expect(dir('CC', 'CC17', 'CC19')).toBe('anti-clockwise')
    expect(dir('CC', 'CC24', 'CC25')).toBe('anti-clockwise') // Kent Ridge → Haw Par Villa: down the west side
  })

  it('uses the spur end, not a loop direction, off the ring', () => {
    expect(dir('CC', 'CC3', 'CC2')).toBe('Dhoby Ghaut')
  })

  it('reads the direction into the step', () => {
    const [step] = transitSteps([{ mode: 'mrt', line: 'CC', loop: 'clockwise', nextStop: 'Caldecott', stops: 9, from: { name: 'Botanic Gardens' }, to: { name: 'Paya Lebar' } }])
    expect(step.title).toBe('Take the Circle Line clockwise')
    expect(step.detail).toBe('Next stop Caldecott · 9 stops · get off at Paya Lebar')
  })
})

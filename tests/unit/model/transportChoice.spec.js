import { describe, expect, it } from 'vitest'
import { travel, busMinutes, taxiMinutes, walkMinutes } from '../../../src/model/services/travel.js'

// Times in SGT on a weekday afternoon (trains and buses running) and at 02:00 (not running).
const afternoon = Date.parse('2030-01-15T14:00:00+08:00')
const lateNight = Date.parse('2030-01-15T02:00:00+08:00')
const changiT3 = { lat: 1.3563, lng: 103.9866 }
const cityHall = { lat: 1.2935, lng: 103.8532 }
const maxwell = { lat: 1.2803, lng: 103.8448 }
const buddhaTooth = { lat: 1.2814, lng: 103.8442 } // ~150 m from Maxwell
// No MRT station within a walk of either end, so public transport means the bus.
const pulauUbinJetty = { lat: 1.4041, lng: 103.9886 }
const pasirRisFarm = { lat: 1.3807, lng: 103.9553 }

describe('transport choice: how the traveller gets around beyond walking distance', () => {
  it('short hops are on foot whatever the choice', () => {
    for (const transport of ['transit', 'car', undefined]) {
      expect(travel(maxwell, buddhaTooth, { transport, atMs: afternoon }).mode).toBe('walk')
    }
  })

  it('car: always by road, and it is the quickest', () => {
    const car = travel(changiT3, cityHall, { transport: 'car', atMs: afternoon })
    expect(car.mode).toBe('taxi')
    expect(car.minutes).toBe(taxiMinutes(changiT3, cityHall))
    expect(car.minutes).toBeLessThan(
      travel(changiT3, cityHall, { transport: 'transit', atMs: afternoon }).minutes
    )
  })

  it('public transport: MRT where it helps, never a taxi while trains and buses run', () => {
    const pt = travel(changiT3, cityHall, { transport: 'transit', style: 'party', atMs: afternoon })
    expect(['mrt', 'bus']).toContain(pt.mode)
  })

  it('public transport with no MRT nearby: the bus, which takes longer than a car', () => {
    const pt = travel(pulauUbinJetty, pasirRisFarm, { transport: 'transit', atMs: afternoon })
    if (walkMinutes(pulauUbinJetty, pasirRisFarm) > busMinutes(pulauUbinJetty, pasirRisFarm)) {
      expect(pt.mode).toBe('bus')
      expect(pt.minutes).toBeGreaterThan(taxiMinutes(pulauUbinJetty, pasirRisFarm))
    }
  })

  it('public transport late at night: nothing runs, so a taxi', () => {
    expect(travel(changiT3, cityHall, { transport: 'transit', atMs: lateNight }).mode).toBe('taxi')
  })

  it('no choice yet (older plans): the same automatic mix as before', () => {
    const before = travel(changiT3, cityHall, { style: 'budget', atMs: afternoon })
    expect(before.mode).toBe('mrt')
  })
})

describe('switching transport mid-plan (map card): the stops ahead are re-timed', () => {
  it('car → shorter rides and earlier arrivals than public transport', async () => {
    const { retimeMission } = await import('../../../src/model/services/planner.js')
    const at = (h) => new Date(Date.parse('2030-01-15T00:00:00+08:00') + h * 3600e3).toISOString()
    const leg = (place_id, p) => ({
      kind: 'visit',
      status: 'pending',
      place_id,
      name: place_id,
      ...p,
      stay_min: 30,
      arrive_iso: at(13),
      depart_iso: at(13.5)
    })
    const mission = (transport) => ({
      origin: { label: 'Changi', ...changiT3 },
      start_iso: at(12),
      must_return_iso: at(23),
      buffers: { exit_min: 30 },
      style: 'budget',
      prefs: { transport },
      legs: [
        leg('city-hall', cityHall),
        leg('maxwell', maxwell),
        {
          kind: 'return',
          status: 'pending',
          arrive_by: at(22),
          arrive_iso: at(20),
          depart_iso: at(20)
        }
      ]
    })
    const start = { point: changiT3, ms: Date.parse(at(12.5)) }
    const byCar = retimeMission(mission('car'), { start, catalogById: new Map() }).mission
    const byPt = retimeMission(mission('transit'), { start, catalogById: new Map() }).mission
    expect(byCar.legs[0].travel_mode).toBe('taxi')
    expect(['mrt', 'bus']).toContain(byPt.legs[0].travel_mode)
    expect(Date.parse(byCar.legs[0].arrive_iso)).toBeLessThan(Date.parse(byPt.legs[0].arrive_iso))
  })
})

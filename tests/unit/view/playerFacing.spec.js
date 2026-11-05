import { describe, expect, it, vi } from 'vitest'

// maplibre-gl is excluded from optimizeDeps and wants a real WebGL context, so the
// Marker is stubbed down to the one thing setPlayerFacing touches: getElement().
vi.mock('maplibre-gl', () => ({
  Marker: class {
    constructor({ element }) {
      this.element = element
    }
    getElement() {
      return this.element
    }
  }
}))

const load = () => import('../../../src/view/components/map/questLayers.js')

const coneOf = (marker) => marker.getElement().querySelector('.cone')

describe('the flat marker view cone', () => {
  it('ships a cone that starts hidden, behind the dot', async () => {
    const { createPlayerMarker } = await load()
    const element = createPlayerMarker().getElement()
    const cone = element.querySelector('.cone')

    expect(cone).not.toBeNull()
    expect(cone.style.opacity).toBe('') // nothing inline yet; the stylesheet hides it
    // Painted first so the pulse and the dot sit on top of it.
    expect(element.firstElementChild).toBe(cone)
    expect(element.querySelector('.core')).not.toBeNull()
  })

  it('rotates the cone to the heading it is given and fades it in', async () => {
    const { createPlayerMarker, setPlayerFacing } = await load()
    const marker = createPlayerMarker()

    setPlayerFacing(marker, 90)

    // Rotation keeps the centring translate, or the cone would jump off the dot.
    expect(coneOf(marker).style.transform).toBe('translate(-50%, -50%) rotate(90deg)')
    expect(coneOf(marker).style.opacity).toBe('1')
  })

  it('hides the cone when no heading is known', async () => {
    const { createPlayerMarker, setPlayerFacing } = await load()
    const marker = createPlayerMarker()

    setPlayerFacing(marker, 0, true)
    expect(coneOf(marker).style.opacity).toBe('1')

    setPlayerFacing(marker, 0, false)
    expect(coneOf(marker).style.opacity).toBe('0')
  })

  it('takes a negative heading, as a map rotated past the facing produces', async () => {
    const { createPlayerMarker, setPlayerFacing } = await load()
    const marker = createPlayerMarker()

    setPlayerFacing(marker, -45)

    expect(coneOf(marker).style.transform).toBe('translate(-50%, -50%) rotate(-45deg)')
  })

  it('ignores a marker that has no cone instead of throwing', async () => {
    const { setPlayerFacing } = await load()
    const bare = { getElement: () => document.createElement('div') }

    expect(() => setPlayerFacing(bare, 90)).not.toThrow()
    expect(() => setPlayerFacing(null, 90)).not.toThrow()
  })
})

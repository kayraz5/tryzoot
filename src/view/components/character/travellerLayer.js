// EDITOR: MATTHEW
// Wraps traveller.js in MapLibre's custom-layer contract. Same pattern as pinPoint.js.

import * as THREE from 'three'
import { MercatorCoordinate } from 'maplibre-gl'
import { createTraveller } from './traveller.js'

// Scale 10 makes him ~22 map-metres tall. Deliberate: at life size he is a couple
// of pixels at the default quest zoom. Raise it if he gets lost among tall buildings.
const DEFAULT_SCALE = 10

export class TravellerLayer {
  constructor({ id = 'zt-traveller', lng, lat, outfit = 'zoot', fur = 'zoot', hat, eyewear, scale = DEFAULT_SCALE, bearing = 0 } = {}) {
    this.id = id
    this.lng = lng
    this.lat = lat
    this.scaleFactor = scale
    this.bearing = bearing
    this.outfitName = outfit
    this.furName = fur
    this.hatName = hat
    this.eyewearName = eyewear
    this.moving = false

    this.type = 'custom'
    this.renderingMode = '3d'

    this.start = performance.now()
  }

  onAdd(map, gl) {
    this.map = map
    this.camera = new THREE.Camera()
    this.scene = new THREE.Scene()

// MeshStandardMaterial is pitch black without lights.
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xbfd2a8, 2.0))
    const sun = new THREE.DirectionalLight(0xfff3dd, 2.4)
    sun.position.set(3, 6, 4) // direction only — a directional light has no position on the map, just an angle
    this.scene.add(sun)
    const rim = new THREE.DirectionalLight(0xcfe3ff, 0.8)
    rim.position.set(-3, 2, -4)
    this.scene.add(rim)

    this.traveller = createTraveller({ outfit: this.outfitName, fur: this.furName, hat: this.hatName, eyewear: this.eyewearName })
    this.traveller.setBearing(this.bearing)
    this.scene.add(this.traveller.group)

    this.updateMatrix()

// Draw into MapLibre's own canvas and GL context, not a separate layer on top.
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true })
    this.renderer.autoClear = false // MapLibre already drew the map — don't wipe it
  }

  updateMatrix() {
    const mc = MercatorCoordinate.fromLngLat([this.lng, this.lat], 0)
    const s = mc.meterInMercatorCoordinateUnits() * this.scaleFactor
    this.base = new THREE.Matrix4()
      .makeTranslation(mc.x, mc.y, mc.z)
      .scale(new THREE.Vector3(s, -s, s))
      .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
  }

  render(gl, args) {
// onRemove() nulls this; a stray frame after removal would otherwise throw.
    if (!this.traveller) return
    const t = (performance.now() - this.start) / 1000
    this.traveller.update(t, this.moving)

    const m = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix)
    this.camera.projectionMatrix = m.multiply(this.base)

    this.renderer.resetState() // MapLibre just used this context — re-sync Three's idea of its state

// Depth handover. MapLibre carves the depth buffer into a thin slice per style
// layer via gl.depthRange, and Three's resetState() deliberately does not restore
// it - so the character lands in whatever slice was left set, behind the ground,
// and is thrown away by the depth test. Take the full range back and clear the
// depth the map wrote. He then draws over buildings rather than inside them, which
// is what you want for a "you are here" avatar. Clearing depth only keeps the map
// image intact, and his own parts still occlude each other.
    gl.depthRange(0, 1)
    this.renderer.clearDepth()

    this.renderer.render(this.scene, this.camera)

// MapLibre only redraws on change; he animates on his own, so ask for the next
// frame explicitly or he freezes the moment you stop touching the map.
    this.map.triggerRepaint()
  }

  setLngLat(lng, lat) {
    this.lng = lng
    this.lat = lat
    if (this.map) this.updateMatrix()
  }

  setBearing(deg) {
    this.bearing = deg
    this.traveller?.setBearing(deg)
  }

  setMoving(moving) { this.moving = !!moving }

  setOutfit(name) {
    this.outfitName = name
    this.traveller?.setOutfit(name)
  }

  setFur(name) {
    this.furName = name
    this.traveller?.setFur(name)
  }

  setHat(name) {
    this.hatName = name
    this.traveller?.setHat(name)
  }

  setEyewear(name) {
    this.eyewearName = name
    this.traveller?.setEyewear(name)
  }

  setScale(scale) {
    this.scaleFactor = scale
    if (this.map) this.updateMatrix()
  }

// Freeing geometry and materials here is what stops repeated visits filling GPU memory.
  onRemove() {
    this.traveller?.dispose()
    this.traveller = null
  }
}

/* Standard initial-bearing formula: atan2(dLat, dLng) will not do, because a
   degree of longitude shrinks away from the equator - that is the cos(lat) terms. */
export function bearingBetween(from, to) {
  const rad = Math.PI / 180
  const dLng = (to.lng - from.lng) * rad
  const lat1 = from.lat * rad
  const lat2 = to.lat * rad
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return (Math.atan2(y, x) / rad + 360) % 360
}

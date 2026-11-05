// EDITOR: MATTHEW
import * as THREE from 'three'
import { MercatorCoordinate } from 'maplibre-gl'
import { distanceM } from '../../../model/services/travel.js'
import { BRAND } from '../../../model/services/brand.js'

// Geometry is authored in tiny units (gem radius 0.55); this scales it to street zoom.
const PIN_SCALE = 40

export const PIN_NEAR_M = 90

const PIN_CREAM = '#fff4c2'
const PIN_TOP_Y = 2.75
const BADGE_Y = 4.1
const BADGE_SCALE = 1.05
const BADGE_RENDER_ORDER = 20

const BADGE_HOME = 'home'
export const LANDMARK_BADGE = 'landmark'

const BADGE = {
  size: 160,
  padding: 7,
  border: 10,
  font: '800 84px Poppins, "Noto Sans", system-ui, sans-serif',
  nextFill: BRAND.yellow,
  idleFill: PIN_CREAM,
  ink: BRAND.ink
}

const GLOW_COLOR = 0xff3d9a
const GROUND_RING_COLOR = 0xff2d9a

let sharedGlowTexture = null

function pinGlowTexture() {
  if (sharedGlowTexture) return sharedGlowTexture

  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.16, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0)')
  gradient.addColorStop(0.34, 'rgba(255, 255, 255, 0.9)')
  gradient.addColorStop(0.55, 'rgba(255, 255, 255, 0.32)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  sharedGlowTexture = new THREE.CanvasTexture(canvas)
  sharedGlowTexture.colorSpace = THREE.SRGBColorSpace
  sharedGlowTexture.minFilter = THREE.LinearFilter
  sharedGlowTexture.magFilter = THREE.LinearFilter
  sharedGlowTexture.generateMipmaps = false
  return sharedGlowTexture
}

function drawHomeGlyph(ctx, cx, cy) {
  ctx.fillStyle = BADGE.ink
  ctx.beginPath()
  ctx.moveTo(cx, cy - 38)
  ctx.lineTo(cx + 42, cy - 2)
  ctx.lineTo(cx + 30, cy - 2)
  ctx.lineTo(cx + 30, cy + 34)
  ctx.lineTo(cx - 30, cy + 34)
  ctx.lineTo(cx - 30, cy - 2)
  ctx.lineTo(cx - 42, cy - 2)
  ctx.closePath()
  ctx.fill()
}

function drawStarGlyph(ctx, cx, cy) {
  ctx.fillStyle = BADGE.ink
  ctx.beginPath()
  for (let point = 0; point < 10; point++) {
    const radius = point % 2 === 0 ? 42 : 18
    const angle = -Math.PI / 2 + (point * Math.PI) / 5
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    if (point === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
}

function badgeTexture(label, isNext) {
  const { size } = BADGE
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const c = size / 2

  ctx.beginPath()
  ctx.arc(c, c, c - BADGE.padding, 0, Math.PI * 2)
  ctx.fillStyle = isNext ? BADGE.nextFill : BADGE.idleFill
  ctx.fill()
  ctx.lineWidth = BADGE.border
  ctx.strokeStyle = BADGE.ink
  ctx.stroke()

  if (label === BADGE_HOME) {
    drawHomeGlyph(ctx, c, c)
  } else if (label === LANDMARK_BADGE) {
    drawStarGlyph(ctx, c, c)
  } else {
    ctx.fillStyle = BADGE.ink
    ctx.font = BADGE.font
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, c, c + 5)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}

function phaseFor(id) {
  let hash = 7
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return ((hash % 1000) / 1000) * Math.PI * 2
}

export class PinLayer {
  constructor({ id, lng, lat, label = '', isNext = false }) {
    this.id = id
    this.lng = lng
    this.lat = lat
    this.badgeLabel = label    // sequence number ("1", "2", …), "home" or "landmark"
    this.isNext = isNext       // the stop the traveller is heading to now
    this.phase = phaseFor(id)

    this.spawn = 0            // 0 → 1 entrance growth
    this.nearness = 0         // smoothed 0 (far) → 1 (close)
    this.targetNearness = 0
    this.lastFrame = 0

    this.type = 'custom'
    this.renderingMode = '3d'
  }

  onAdd(map, gl) {
    this.map = map
    this.camera = new THREE.Camera()
    this.scene = new THREE.Scene()

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9cc7a4, 2.2))

    const material = (color, emissive = 0x000000, emissiveIntensity = 0) =>
      new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity, flatShading: true })

    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 2.2, 6), material(PIN_CREAM))
    pillar.position.y = 1.2 // lift the base to ground level

    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), material(BRAND.pink, 0x8a0030, 0.7))
    gem.position.y = PIN_TOP_Y // sits on top of the pillar

    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.07, 6, 24), material(0x211a00, 0xffa400, 0.45))
    halo.position.y = PIN_TOP_Y // rings the gem

    const ping = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.035, 6, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffcc00,
        transparent: true,
        opacity: 0,
        depthWrite: false
      })
    )
    ping.position.y = PIN_TOP_Y
    ping.visible = false

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: pinGlowTexture(),
        color: GLOW_COLOR,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    )
    glow.position.y = PIN_TOP_Y
    glow.scale.set(3.4, 3.4, 1)

    const groundRing = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 1.0, 40),
      new THREE.MeshBasicMaterial({
        color: GROUND_RING_COLOR,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    )
    groundRing.rotation.x = -Math.PI / 2
    groundRing.position.y = 0.05

    const group = new THREE.Group()
    group.add(pillar, gem, halo, ping, glow, groundRing)

    if (this.badgeLabel) {
      const badge = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: badgeTexture(this.badgeLabel, this.isNext),
          transparent: true,
          depthTest: false,
          depthWrite: false
        })
      )
      badge.position.y = BADGE_Y
      badge.scale.set(BADGE_SCALE, BADGE_SCALE, 1)
      badge.renderOrder = BADGE_RENDER_ORDER
      group.add(badge)
      this.badge = badge
    }

    group.scale.setScalar(0.001) // grows in on spawn
    this.scene.add(group)

    this.group = group
    this.gem = gem
    this.halo = halo
    this.ping = ping
    this.glow = glow
    this.groundRing = groundRing

// meterInMercatorCoordinateUnits() keeps the pin a consistent real-world size
    // regardless of latitude.
    const position = MercatorCoordinate.fromLngLat([this.lng, this.lat], 0)
    const scale = position.meterInMercatorCoordinateUnits() * PIN_SCALE

// Three.js Y-up rotated into the map's Z-up.
    this.baseTransform = new THREE.Matrix4()
      .makeTranslation(position.x, position.y, position.z)
      .scale(new THREE.Vector3(scale, -scale, scale))
      .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))

// Reuse the map's canvas and context so Three draws into the same frame.
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true })
// MapLibre has already drawn the map; clearing here would erase it.
    this.renderer.autoClear = false
  }

  setNear(near) {
    this.targetNearness = near ? 1 : 0
  }

  setBadge(label, isNext) {
    if (label === this.badgeLabel && isNext === this.isNext) return
    this.badgeLabel = label
    this.isNext = isNext

    if (!this.badge) return
    const previous = this.badge.material.map
    this.badge.material.map = badgeTexture(label, isNext)
    this.badge.material.needsUpdate = true
    previous?.dispose()
  }

  animate(dt, now) {
    const t = now / 1000
    const active = this.isNext ? 1 : 0

    this.spawn = Math.min(1, this.spawn + dt * 2.5)
    const grow = 1 - Math.pow(1 - this.spawn, 3)
    this.group.scale.setScalar(grow)

    this.nearness += (this.targetNearness - this.nearness) * Math.min(1, dt * 5)
    const near = this.nearness

    const bobSpeed = 1.6 + near * 2.6
    const bobHeight = 0.05 + near * 0.14
    const bob = Math.sin(t * bobSpeed + this.phase) * bobHeight

    this.gem.position.y = PIN_TOP_Y + bob
    this.halo.position.y = PIN_TOP_Y + bob
    this.ping.position.y = PIN_TOP_Y + bob
    this.glow.position.y = PIN_TOP_Y + bob
    if (this.badge) this.badge.position.y = BADGE_Y + bob * 0.6

    this.gem.rotation.y = t * (0.6 + near * 2.4) + this.phase
    this.halo.rotation.z = t * (0.5 + near * 2.0)
    this.halo.rotation.y = Math.sin(t * 0.8 + this.phase) * (0.2 + near * 0.3)

    this.halo.material.emissiveIntensity = 0.45 + near * 1.1 + active * 0.25
    this.gem.material.emissiveIntensity = 0.7 + near * 0.6 + active * 0.35

    const shimmer = 0.5 + 0.5 * Math.sin(t * 2 + this.phase)
    this.glow.material.opacity = 0.4 + near * 0.22 + active * 0.24 + shimmer * 0.08
    const glowScale = 3.4 + near * 0.25 + active * 0.2 + shimmer * 0.1
    this.glow.scale.set(glowScale, glowScale, 1)

    this.groundRing.material.opacity = 0.2 + near * 0.24 + active * 0.22 + shimmer * (0.04 + active * 0.06)
    this.groundRing.scale.setScalar(1 + (0.03 + active * 0.04) * shimmer)

    const beat = 1 + near * 0.12 * (0.5 + 0.5 * Math.sin(t * 6 + this.phase))
    this.gem.scale.setScalar(beat)

    if (this.badge) {
      const badgeScale = BADGE_SCALE * (1 + active * 0.045 * (0.5 + 0.5 * Math.sin(t * 4 + this.phase)))
      this.badge.scale.set(badgeScale, badgeScale, 1)
    }

    if (near > 0.01) {
      const cycle = (t * 0.9 + this.phase) % 1
      this.ping.visible = true
      this.ping.scale.setScalar(1 + cycle * 0.9)
      this.ping.material.opacity = near * (1 - cycle) * 0.7
      this.ping.rotation.z = this.halo.rotation.z
      this.ping.rotation.y = this.halo.rotation.y
    } else {
      this.ping.visible = false
    }
  }

  render(gl, args) {
    if (!this.map || !this.baseTransform) return

    const now = performance.now()
    const dt = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 0
    this.lastFrame = now
    this.animate(dt, now)

    const projection = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix)
    this.camera.projectionMatrix = projection.multiply(this.baseTransform)

// The shared context's GL state was last set by MapLibre; reset it first.
    this.renderer.resetState()
    this.renderer.render(this.scene, this.camera)

// MapLibre only repaints on change; the pins move on their own, so keep asking.
    this.map.triggerRepaint()
  }

  onRemove() {
    this.scene.traverse((object) => {
// Sprites share one internal geometry, so only meshes own theirs.
      if (object.isMesh) object.geometry.dispose()
      if (!object.material) return
// The glow texture is shared by every pin; the badge texture is this pin's.
      if (object.material.map && object.material.map !== sharedGlowTexture) {
        object.material.map.dispose()
      }
      object.material.dispose()
    })
    this.renderer?.dispose()
    this.map = null
  }
}

export function syncStopPins(map, pins, legs, nextLeg = null) {
  const keep = new Set()

  for (const leg of legs) {
    const key = `${leg.seq}:${leg.place_id || 'home'}`
    keep.add(key)

    const label = leg.kind === 'return' ? BADGE_HOME : String(leg.seq)
    const isNext = leg === nextLeg
    const existing = pins.get(key)
    if (existing) {
      existing.setBadge(label, isNext)
      continue
    }

    const pin = new PinLayer({ id: `pin-${key}`, lng: leg.lng, lat: leg.lat, label, isNext })
    map.addLayer(pin)
    pins.set(key, pin)
  }

  for (const [key, pin] of pins) {
    if (keep.has(key)) continue
    map.removeLayer(pin.id)
    pins.delete(key)
  }
}

export function updatePinProximity(pins, position, nearMeters = PIN_NEAR_M) {
  for (const pin of pins.values()) {
    pin.setNear(Boolean(position) && distanceM(position, pin) <= nearMeters)
  }
}

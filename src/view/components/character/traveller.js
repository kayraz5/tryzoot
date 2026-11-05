// EDITOR: MATTHEW
// The animal only. Everything he wears lives in travellerAssets.js.

import * as THREE from 'three'
import {
  ACCESSORIES,
  EYEWEAR,
  HATS,
  OUTFITS,
  getEyewear,
  getFur,
  getHat,
  getOutfit,
  PALETTE,
  at,
  ball,
  box,
  clothMat,
  furMat,
  group,
  leatherMat,
  metalMat,
  pill,
  ring,
  spin,
  tube
} from './travellerAssets.js'

const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x241a13, side: THREE.BackSide })

function outlineAll(root, thickness = 0.055) {
  // Collect first, THEN add - traverse() would walk into the outlines we just made.
  const meshes = []
  root.traverse((o) => {
    if (o.isMesh && !o.userData.noOutline) meshes.push(o)
  })
  for (const mesh of meshes) {
    const shell = new THREE.Mesh(mesh.geometry, OUTLINE_MAT)
    shell.scale.setScalar(1 + thickness)
    shell.userData.noOutline = true
    mesh.add(shell)
  }
}

/** Geometry and materials are not garbage collected on their own. */
function disposeChildren(parent) {
  for (const child of [...parent.children]) {
    child.traverse((o) => {
      if (!o.isMesh) return
      o.geometry.dispose()
      // The shared outline material is reused forever; never dispose that one.
      if (o.material !== OUTLINE_MAT) o.material.dispose()
    })
    parent.remove(child)
  }
}

export function createTraveller({
  outfit = 'zoot',
  fur = 'zoot',
  hat,
  eyewear,
  outline = true,
  shadow = true
} = {}) {
  const startFur = getFur(fur)
  const startKit = getOutfit(outfit)
  hat = hat ?? startKit.hat ?? 'none'
  eyewear = eyewear ?? startKit.eyewear ?? 'none'

  const M = {
    coat: furMat(startFur.coat), // the fur
    belly: furMat(startFur.belly), // muzzle, chest, cheeks
    inner: furMat(startFur.inner ?? PALETTE.inner), // inside of the ears
    nose: furMat(startFur.markings ?? PALETTE.noseDark), // nose + eyebrows
    eye: new THREE.MeshStandardMaterial({ color: PALETTE.eyeDark, roughness: 0.25 }),
    shine: new THREE.MeshBasicMaterial({ color: PALETTE.white }), // eye highlight: unlit, so it always stays bright
    shirt: clothMat(startKit.colors.shirt),
    pants: clothMat(startKit.colors.pants),
    boots: leatherMat(startKit.colors.boots),
    belt: leatherMat(startKit.colors.belt),
    beltDark: leatherMat(startKit.colors.beltDark ?? startKit.colors.belt),
    metal: metalMat(startKit.colors.metal)
  }

  const root = new THREE.Group()

  function makeLeg(side) {
    const hip = at(new THREE.Group(), side * 0.19, 0.78, 0)

    const thigh = at(pill(0.135, 0.26, M.pants), 0, -0.22, 0)
    const cuff = at(ring(0.14, 0.05, M.pants), 0, -0.46, 0)

    const foot = at(new THREE.Group(), 0, -0.52, 0)
    foot.add(
      at(box(0.3, 0.26, 0.44, M.boots, 0.11), 0, -0.12, 0.04),
      at(ball(0.15, M.boots, { y: 0.85, z: 0.9 }), 0, -0.14, 0.17), // rounded toe cap
      at(box(0.33, 0.08, 0.47, M.beltDark, 0.03), 0, -0.23, 0.05) // sole
    )

    hip.add(thigh, spin(cuff, 90, 0, 0), foot)
    return { hip, foot }
  }
  const legL = makeLeg(-1)
  const legR = makeLeg(1)

  const hips = at(ball(0.42, M.pants, { x: 1, y: 0.78, z: 0.88 }), 0, 0.86, 0)
  const belly = at(ball(0.5, M.shirt, { x: 0.95, y: 0.85, z: 0.82 }), 0, 1.14, 0)
  const chest = at(ball(0.4, M.shirt, { x: 1.05, y: 0.78, z: 0.9 }), 0, 1.38, 0)
  const collar = spin(at(ring(0.26, 0.055, M.shirt), 0, 1.52, 0), 90, 0, 0)
  const bib = at(ball(0.22, M.belly, { x: 1.1, y: 0.85, z: 0.5 }), 0, 1.52, 0.2)

  const beltLoop = group(spin(ring(0.45, 0.06, M.belt), 90, 0, 0))
  beltLoop.position.y = 0.98
  beltLoop.scale.z = 0.86
  const buckle = at(box(0.17, 0.14, 0.07, M.metal, 0.03), 0, 0.98, 0.4)

  function makeArm(side) {
    const shoulder = at(new THREE.Group(), side * 0.58, 1.38, 0)
    const sleeve = at(pill(0.125, 0.2, M.shirt), 0, -0.18, 0)

    const elbow = at(new THREE.Group(), 0, -0.34, 0)
    elbow.add(
      at(pill(0.11, 0.16, M.coat), 0, -0.08, 0),
      at(ball(0.15, M.coat, { y: 0.9 }), 0, -0.28, 0.03) // paw
    )

    shoulder.add(sleeve, elbow)
    shoulder.rotation.z = THREE.MathUtils.degToRad(side * -13)
    return { shoulder, elbow }
  }
  const armL = makeArm(-1)
  const armR = makeArm(1)

  const head = at(new THREE.Group(), 0, 1.58, 0)

  const skull = at(ball(0.46, M.coat, { y: 0.94, z: 0.95 }), 0, 0.24, 0)
  const muzzle = at(ball(0.235, M.belly, { x: 1.05, y: 0.85, z: 0.92 }), 0, 0.08, 0.31)
  const cheekL = at(ball(0.175, M.belly, { z: 0.8 }), -0.18, 0.05, 0.25)
  const cheekR = at(ball(0.175, M.belly, { z: 0.8 }), 0.18, 0.05, 0.25)
  const nose = at(ball(0.072, M.nose, { y: 0.85, z: 0.8 }), 0, 0.19, 0.5)

  // Each eye group sits AT the eyeball with its parts at the group's own origin:
  // scaling a group whose children are offset would slide the eyes down the face
  // instead of closing them.
  const eye = (side) => {
    const socket = at(new THREE.Group(), side * 0.195, 0.33, 0.39)
    socket.add(ball(0.11, M.eye), at(ball(0.038, M.shine), side * 0.04, 0.045, 0.065))
    return socket
  }
  const eyeL = eye(-1)
  const eyeR = eye(1)
  const eyes = group(eyeL, eyeR)
  eyes.traverse((o) => {
    o.userData.noOutline = true
  })

  const browL = spin(at(box(0.18, 0.04, 0.06, M.nose, 0.015), -0.2, 0.48, 0.36), 0, 0, 9)
  const browR = spin(at(box(0.18, 0.04, 0.06, M.nose, 0.015), 0.2, 0.48, 0.36), 0, 0, -9)

  const ear = (side) =>
    group(
      at(ball(0.13, M.coat, { z: 0.72 }), side * 0.35, 0.54, -0.02),
      at(ball(0.075, M.inner, { z: 0.5 }), side * 0.35, 0.54, 0.035)
    )

  // noOutline: an outline on something this thin would swallow the whisker whole.
  const whisker = (side, i) => {
    const w = at(tube(0.005, 0.007, 0.34, M.nose, 5), side * 0.33, 0.14 - i * 0.07, 0.36)
    spin(w, 0, 0, -side * (74 + i * 10)) // negative Z-rotation swings +Y towards +X, so negate for the left side
    w.userData.noOutline = true
    return w
  }
  const whiskers = group(whisker(-1, 0), whisker(-1, 1), whisker(1, 0), whisker(1, 1))

  head.add(skull, muzzle, cheekL, cheekR, nose, eyes, browL, browR, ear(-1), ear(1), whiskers)

  const tail = at(new THREE.Group(), 0, 0.8, -0.26)
  spin(tail, -96, 0, 0) // leaves the body roughly level, just dipping
  tail.scale.x = 0.8 // flattened side-to-side, like the real animal

  let link = tail
  const segments = [0.21, 0.175, 0.14, 0.105, 0.075]
  segments.forEach((radius, i) => {
    const joint = new THREE.Group()
    if (i > 0) {
      joint.position.y = segments[i - 1] * 0.85 // step along the tail
      joint.rotation.x = THREE.MathUtils.degToRad(-15) // and bend a bit further down
    }
    joint.add(ball(radius, M.coat))
    link.add(joint)
    link = joint
  })

  const slots = {
    head: at(new THREE.Group(), 0, 0.55, 0), // where a hat band sits, not the very crown
    face: at(new THREE.Group(), 0, 0.33, 0.52), // just clear of the eyeballs, which bulge to z 0.5
    neck: at(new THREE.Group(), 0, 1.52, 0),
    chest: at(new THREE.Group(), 0, 1.36, 0.26),
    back: at(new THREE.Group(), 0, 1.2, -0.32),
    waist: at(new THREE.Group(), 0, 0.98, 0),
    handL: at(new THREE.Group(), 0, -0.42, 0.1),
    handR: at(new THREE.Group(), 0, -0.42, 0.1)
  }
  head.add(slots.head, slots.face)
  armL.elbow.add(slots.handL)
  armR.elbow.add(slots.handR)

  const upper = new THREE.Group()
  upper.add(
    belly,
    chest,
    collar,
    bib,
    beltLoop,
    buckle,
    armL.shoulder,
    armR.shoulder,
    head,
    slots.neck,
    slots.chest,
    slots.back,
    slots.waist
  )

  root.add(legL.hip, legR.hip, hips, upper, tail)

  if (shadow) {
    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.62, 24),
      // depthWrite: false stops the disc blocking things drawn after it.
      new THREE.MeshBasicMaterial({
        color: 0x1a1208,
        transparent: true,
        opacity: 0.26,
        depthWrite: false
      })
    )
    spin(at(blob, 0, 0.01, 0.02), -90, 0, 0)
    blob.scale.set(1, 0.85, 1)
    blob.userData.noOutline = true
    root.add(blob)
  }

  if (outline) outlineAll(root)

  let currentOutfit = outfit
  let currentHat = hat
  let currentEyewear = eyewear
  const restArm = { L: 0, R: 0 }

  function applyOutfit(name) {
    const kit = getOutfit(name)
    currentOutfit = OUTFITS[name] ? name : 'zoot' // getOutfit() falls back to the house kit, so record what we actually put on

    M.shirt.color.set(kit.colors.shirt)
    M.pants.color.set(kit.colors.pants)
    M.boots.color.set(kit.colors.boots)
    M.belt.color.set(kit.colors.belt)
    M.beltDark.color.set(kit.colors.beltDark ?? kit.colors.belt)
    M.metal.color.set(kit.colors.metal)

    for (const slot of Object.values(slots)) disposeChildren(slot)
    restArm.L = 0
    restArm.R = 0
    for (const key of kit.accessories) {
      const asset = ACCESSORIES[key]
      if (!asset) {
        console.warn(`[traveller] unknown accessory "${key}"`);
        continue
      }
      const prop = asset.build(kit.colors)
      if (outline) outlineAll(prop, 0.05)
      slots[asset.slot].add(prop)

      if (asset.arm != null) {
        if (asset.slot === 'handR') restArm.R = THREE.MathUtils.degToRad(asset.arm)
        if (asset.slot === 'handL') restArm.L = THREE.MathUtils.degToRad(asset.arm)
      }
    }
    armR.shoulder.rotation.x = restArm.R
    armL.shoulder.rotation.x = restArm.L

    // The loop above just wiped the head and face slots, so put them back.
    applyHat(currentHat)
    applyEyewear(currentEyewear)
  }

  function wear(slot, asset, colors) {
    disposeChildren(slot)
    if (!asset?.build) return
    const prop = asset.build(colors)
    if (outline) outlineAll(prop, 0.05)
    slot.add(prop)
  }

  function applyHat(name) {
    currentHat = HATS[name] ? name : 'none'
    wear(slots.head, getHat(currentHat), getOutfit(currentOutfit).colors)
  }

  function applyEyewear(name) {
    currentEyewear = EYEWEAR[name] ? name : 'none'
    wear(slots.face, getEyewear(currentEyewear), getOutfit(currentOutfit).colors)
  }

  applyOutfit(outfit)

  const STRIDE_HZ = 0.95 // full left-right cycles per second — an unhurried walk
  let lastTime = 0
  let gait = 0 // eased 0→1; how much of the walk is mixed in
  let phase = 0 // where we are in the stride, in radians
  let nextBlink = 2 // seconds until the next blink
  let blinkStart = -1

  function update(time, moving = false) {
    // Clamp dt: a backgrounded tab hands back a multi-second jump, which would fling
    // every limb across its whole range in one frame.
    const dt = Math.min(0.05, Math.max(0, time - lastTime))
    lastTime = time

    gait += ((moving ? 1 : 0) - gait) * Math.min(1, dt * 8)
    const idle = 1 - gait

    phase += dt * STRIDE_HZ * Math.PI * 2 * gait
    if (phase > Math.PI * 2) phase -= Math.PI * 2
    const swing = Math.sin(phase)

    // Positive rotation.x swings a limb backwards (it hangs along -Y), so the two
    // legs take opposite signs.
    legL.hip.rotation.x = swing * 0.5 * gait
    legR.hip.rotation.x = -swing * 0.5 * gait
    legL.foot.rotation.x = -swing * 0.26 * gait
    legR.foot.rotation.x = swing * 0.26 * gait

    armL.shoulder.rotation.x = restArm.L - swing * 0.38 * gait
    armR.shoulder.rotation.x = restArm.R + swing * 0.38 * gait
    armL.elbow.rotation.x = -(0.1 + 0.22 * (0.5 + 0.5 * Math.sin(phase - 0.9))) * gait
    armR.elbow.rotation.x = -(0.1 + 0.22 * (0.5 - 0.5 * Math.sin(phase - 0.9))) * gait

    upper.rotation.y = -swing * 0.13 * gait
    upper.rotation.z = -swing * 0.045 * gait
    upper.position.x = swing * 0.03 * gait
    upper.position.y = Math.sin(time * 1.6) * 0.012 * idle

    const bounce = Math.cos(phase * 2) * 0.5 + 0.5
    root.position.y = (bounce - 0.5) * 0.06 * gait + Math.sin(time * 2.2) * 0.02 * idle

    head.rotation.y = -upper.rotation.y * 0.75 + Math.sin(time * 0.6) * 0.09 * idle
    head.rotation.z = Math.sin(time * 0.9) * 0.035 * idle - upper.rotation.z * 0.5
    head.rotation.x = -0.03 * gait // leans into the walk a touch

    tail.rotation.z = swing * 0.22 * gait + Math.sin(time * 1.7) * 0.16 * idle
    tail.rotation.y = -upper.rotation.y * 1.2 + Math.sin(time * 1.1) * 0.1 * idle

    if (time >= nextBlink) {
      blinkStart = time
      nextBlink = time + 2.5 + Math.random() * 4
    }
    const bt = (time - blinkStart) / 0.13
    const lid = bt >= 0 && bt <= 1 ? Math.max(0.05, Math.abs(Math.cos(bt * Math.PI))) : 1
    eyeL.scale.y = lid
    eyeR.scale.y = lid
  }

  return {
    group: root,
    parts: { head, upper, tail, armL, armR, legL, legR, eyeL, eyeR, slots }, // exposed so you can pose him by hand
    materials: M,

    setOutfit: (name) => applyOutfit(name),
    setHat: (name) => applyHat(name),
    setEyewear: (name) => applyEyewear(name),
    get hat() {
      return currentHat
    },
    get eyewear() {
      return currentEyewear
    },

    setFur: (name) => {
      const f = getFur(name)
      M.coat.color.set(f.coat)
      M.belly.color.set(f.belly)
      M.inner.color.set(f.inner ?? PALETTE.inner)
      M.nose.color.set(f.markings ?? PALETTE.noseDark)
    },
    setBearing: (deg) => {
      root.rotation.y = THREE.MathUtils.degToRad(180 - deg)
    },
    update,
    get outfit() {
      return currentOutfit
    },
    dispose: () => {
      root.traverse((o) => {
        if (!o.isMesh) return
        o.geometry.dispose()
        if (o.material !== OUTLINE_MAT) o.material.dispose()
      })
      root.removeFromParent()
    }
  }
}

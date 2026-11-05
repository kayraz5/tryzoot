<!-- EDITOR: MATTHEW -->
<script setup>
// The only place the 3D preview exists. ProfileView imports it lazily
// (defineAsyncComponent) so Three is never downloaded by someone who skips the tab.
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { createTraveller } from './traveller.js'
import { EYEWEAR, FURS, HATS, OUTFITS } from './travellerAssets.js'

const props = defineProps({
  outfit: { type: String, default: 'zoot' },
  fur: { type: String, default: 'zoot' },
  hat: { type: String, default: 'cap' },
  eyewear: { type: String, default: 'none' },
  height: { type: String, default: 'min(52dvh, 420px)' }
})
const emit = defineEmits(['update:outfit', 'update:fur', 'update:hat', 'update:eyewear'])

const outfits = Object.entries(OUTFITS).map(([key, o]) => ({ key, label: o.label }))
const furs = Object.entries(FURS).map(([key, f]) => ({ key, label: f.label }))
const hats = Object.entries(HATS).map(([key, h]) => ({ key, label: h.label }))
const eyewears = Object.entries(EYEWEAR).map(([key, e]) => ({ key, label: e.label }))

function chooseOutfit(key) {
  emit('update:outfit', key)
  const kit = OUTFITS[key]
  if (kit?.hat) emit('update:hat', kit.hat)
  if (kit?.eyewear) emit('update:eyewear', kit.eyewear)
}

const slots = computed(() => [
  { key: 'outfit', label: 'Outfit', options: outfits, value: props.outfit, choose: chooseOutfit },
  { key: 'hat', label: 'Hat', options: hats, value: props.hat, choose: (k) => emit('update:hat', k) },
  { key: 'eyewear', label: 'Eyewear', options: eyewears, value: props.eyewear, choose: (k) => emit('update:eyewear', k) },
  { key: 'fur', label: 'Fur', options: furs, value: props.fur, choose: (k) => emit('update:fur', k) }
])

const walking = ref(false)
const canvas = ref(null)
let traveller = null
let renderer = null
let frame = 0

watch(() => props.outfit, (v) => {
// setOutfit() rebuilds every slot, head and face included, so hat and glasses
  // must be re-applied after it or they vanish on an outfit change.
  traveller?.setOutfit(v)
  traveller?.setHat(props.hat)
  traveller?.setEyewear(props.eyewear)
})
watch(() => props.fur, (v) => traveller?.setFur(v))
watch(() => props.hat, (v) => traveller?.setHat(v))
watch(() => props.eyewear, (v) => traveller?.setEyewear(v))

onMounted(() => {
// alpha: true leaves the canvas transparent so the card behind shows through.
  renderer = new THREE.WebGLRenderer({ canvas: canvas.value, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0xffffff, 0xbfd2a8, 2.0))
  const sun = new THREE.DirectionalLight(0xfff3dd, 2.4); sun.position.set(3, 6, 4); scene.add(sun)
  const rim = new THREE.DirectionalLight(0xcfe3ff, 0.8); rim.position.set(-3, 2, -4); scene.add(rim)

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)

  traveller = createTraveller({ outfit: props.outfit, fur: props.fur, hat: props.hat, eyewear: props.eyewear })
  let bearing = 195 // facing you, turned slightly so he reads as 3D rather than flat
  traveller.setBearing(bearing)
  scene.add(traveller.group)

// Keep the drawing buffer matching the element's CSS size, or the render
  // stretches on resize - they are two different things.
  function resize() {
    const el = canvas.value
    if (!el || !el.clientWidth) return
    renderer.setSize(el.clientWidth, el.clientHeight, false)
    camera.aspect = el.clientWidth / el.clientHeight
// Framed for the TALLEST outfit: the monsoon umbrella reaches about y 2.9, well
  // above his own 2.25, and a body-framed camera crops it.
    camera.position.set(0, 1.7, 6.2)
    camera.lookAt(0, 1.35, 0)
    camera.updateProjectionMatrix()
  }
  resize()
  window.addEventListener('resize', resize)

// Pointer capture keeps the drag alive when the finger slides off the canvas.
  let dragging = false
  let lastX = 0
  const down = (e) => { dragging = true; lastX = e.clientX; canvas.value.setPointerCapture?.(e.pointerId) }
  const move = (e) => {
    if (!dragging) return
    bearing = (bearing - (e.clientX - lastX) * 0.6 + 360) % 360
    lastX = e.clientX
    traveller.setBearing(bearing)
  }
  const up = () => { dragging = false }
  canvas.value.addEventListener('pointerdown', down)
  canvas.value.addEventListener('pointermove', move)
  canvas.value.addEventListener('pointerup', up)
  canvas.value.addEventListener('pointercancel', up)

// performance.now() rather than THREE.Clock - Clock is deprecated as of three r186.
  const start = performance.now()
  function loop() {
    traveller.update((performance.now() - start) / 1000, walking.value)
    renderer.render(scene, camera)
    frame = requestAnimationFrame(loop)
  }
  loop()

  onUnmounted(() => {
    cancelAnimationFrame(frame)
    window.removeEventListener('resize', resize)
    traveller.dispose()
    renderer.dispose()
  })
})
</script>

<template>
  <div class="studio">
    <canvas ref="canvas" class="stage" :style="{ height }"></canvas>

    <div class="rack">
      <div v-for="slot in slots" :key="slot.key" class="rack-row rack-row--slot">
        <span class="rack-label">{{ slot.label }}</span>

        <span class="rack-select-wrap">
          <select
            class="rack-select"
            :value="slot.value"
            :aria-label="slot.label"
            @change="slot.choose($event.target.value)"
          >
            <option v-for="o in slot.options" :key="o.key" :value="o.key">{{ o.label }}</option>
          </select>
        </span>

        <div class="rack-opts">
          <button
            v-for="o in slot.options"
            :key="o.key"
            class="zt-chip"
            :class="{ active: slot.value === o.key }"
            :aria-pressed="slot.value === o.key"
            @click="slot.choose(o.key)"
          >{{ o.label }}</button>
        </div>
      </div>

      <div class="rack-row">
        <span class="rack-label">Pose</span>
        <div class="rack-opts">
          <button class="zt-chip" :class="{ active: walking }" :aria-pressed="walking" @click="walking = !walking">
            <i class="bi" :class="walking ? 'bi-person-walking' : 'bi-person-standing'"></i>
            {{ walking ? 'Walking' : 'Standing' }}
          </button>
        </div>
      </div>
    </div>

    <slot name="actions" />
  </div>
</template>

<style scoped>
.stage {
  display: block;
  width: 100%;
  border: var(--zt-bw) solid var(--zt-line);
  border-radius: var(--zt-radius);
  background: var(--zt-card);
  touch-action: none; /* the drag-to-spin handler owns horizontal drags */
  cursor: grab;
}
.stage:active { cursor: grabbing; }

.rack { display: grid; gap: 0.6rem; margin-top: 0.9rem; }
.rack-row { display: flex; align-items: baseline; gap: 0.5rem; }
.rack-label {
  font-family: var(--zt-font-head);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--zt-muted);
  flex: 0 0 4.2rem;
  padding-top: 0.35rem;
}
.rack-opts { display: flex; flex-wrap: wrap; gap: 0.35rem; }

.rack-select-wrap { display: none; }

@media (max-width: 767px) {
/* Wardrobe slots only - Pose is a single toggle and must not be caught by this. */
  .rack-row--slot .rack-opts { display: none; }

  .rack-select-wrap {
    display: block;
    position: relative;
    flex: 1 1 auto;
    min-width: 0; /* a flex child must be allowed to shrink, or long labels overflow */
  }

/* Inherits currentColor: --zt-line flips between themes, and a fixed-colour
   arrow would disappear in one of them. */
  .rack-select-wrap::after {
    content: '';
    position: absolute;
    top: 50%;
    right: 0.9rem;
    width: 0.5rem;
    height: 0.5rem;
    transform: translateY(-70%) rotate(45deg);
    border-right: 2px solid currentColor;
    border-bottom: 2px solid currentColor;
    color: var(--zt-ink);
    pointer-events: none; /* the arrow must not swallow the tap */
  }

  .rack-select {
    width: 100%;
    appearance: none;
    -webkit-appearance: none;
    padding: 0.6rem 2.2rem 0.6rem 0.9rem;
    border: var(--zt-bw) solid var(--zt-line);
    border-radius: 999px;
    background: var(--zt-card);
    color: var(--zt-ink);
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .rack-select:focus-visible { outline: 3px solid var(--zt-pink); outline-offset: 2px; }

/* The open menu is drawn by the OS, which otherwise ignores the theme. */
  .rack-select option { background: var(--zt-card); color: var(--zt-ink); text-transform: none; }

  .rack-row { align-items: center; }
  .rack-label { padding-top: 0; }
}
</style>

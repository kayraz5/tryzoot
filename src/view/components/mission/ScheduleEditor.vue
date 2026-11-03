<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useMissionStore } from '../../../model/stores/mission.js'
import { useUiStore } from '../../../model/stores/ui.js'
import { formatDuration, formatTime } from '../../../model/services/hours.js'

/**
 * Inline schedule editor on the mission page: the remaining stops as compact rows.
 *   - drag the ≡ handle (or focus it and press ↑/↓) to change the order
 *   - −/+ changes a stay by 15 min; tap the minutes to type an exact length
 * Every change goes through the mission store, which re-times the plan and refuses anything
 * that would hit a closed place or miss the airport. The line under the spare time shows the
 * math of the last change, so they can see what it cost.
 */
const emit = defineEmits(['done'])
const store = useMissionStore()
const ui = useUiStore()

const STEP = 15
const MIN_STAY = 10
const MAX_STAY = 240

const m = computed(() => store.mission)
const rows = computed(() => store.visitLegs.filter((l) => l.status === 'pending'))
const doneCount = computed(() => store.visitLegs.length - rows.value.length)
const ret = computed(() => store.returnLeg)
const spareMin = computed(() => (ret.value ? Math.max(0, Math.round((Date.parse(ret.value.arrive_by) - Date.parse(ret.value.arrive_iso)) / 60000)) : 0))
const spareTone = computed(() => (spareMin.value < 45 ? 'danger' : spareMin.value < 90 ? 'warn' : 'ok'))

// Apply one edit and remember its math
const busy = ref(false)
const lastChange = ref(null) // { what, spareFrom, spareTo, backBy }
async function apply(what, action) {
	if (busy.value) return false
	busy.value = true
	const spareFrom = spareMin.value
	try {
		const ok = await action()
		if (ok) lastChange.value = { what, spareFrom, spareTo: spareMin.value, backBy: ret.value.arrive_iso }
		return ok
	} catch (err) {
		ui.toast(err.message, 'danger')
		return false
	} finally {
		busy.value = false
	}
}

// Stay length
const clampStay = (min) => Math.min(MAX_STAY, Math.max(MIN_STAY, Math.round(min)))
function setStay(leg, minutes) {
	const next = clampStay(minutes)
	if (!Number.isFinite(next) || next === leg.stay_min) return
	apply(`${leg.name}: ${leg.stay_min} → ${next} min`, () => store.changeStay(leg, next - leg.stay_min))
}

const typing = ref(null) // place_id whose minutes are being typed
const typed = ref('')
async function startTyping(leg) {
	typing.value = leg.place_id
	typed.value = String(leg.stay_min)
	await nextTick()
	document.getElementById(`stay-${leg.place_id}`)?.select()
}
function commitTyping(leg) {
	if (typing.value !== leg.place_id) return
	typing.value = null
	const n = Number(typed.value)
	if (typed.value !== '' && Number.isFinite(n)) setStay(leg, n)
}

// Order 
function moveTo(leg, from, to) {
	if (to === from || to < 0 || to >= rows.value.length) return Promise.resolve(false)
	return apply(`Moved ${leg.name} to stop ${to + 1 + doneCount.value}`, () => store.moveStopTo(leg, to))
}
async function keyMove(leg, from, dir) {
	if (await moveTo(leg, from, from + dir)) {
		await nextTick()
		document.getElementById(`handle-${leg.place_id}`)?.focus()
	}
}

/** Pointer drag on the handle: the row follows the finger, the others slide out of the way. */
const rootEl = ref(null)
onMounted(() => rootEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
const listEl = ref(null)
const drag = ref(null) // { leg, from, to, startY, dy, mids, height }
function startDrag(event, leg, from) {
	if (busy.value || leg.fixed) return
	const items = [...listEl.value.querySelectorAll(':scope > li')]
	const rects = items.map((el) => el.getBoundingClientRect())
	const gap = rects.length > 1 ? rects[1].top - rects[0].bottom : 0
	drag.value = { leg, from, to: from, startY: event.clientY, dy: 0, mids: rects.map((r) => r.top + r.height / 2), height: rects[from].height + gap }
	event.currentTarget.setPointerCapture?.(event.pointerId)
	window.addEventListener('pointermove', onDragMove)
	window.addEventListener('pointerup', endDrag)
	window.addEventListener('pointercancel', cancelDrag)
}
function onDragMove(event) {
	const d = drag.value
	if (!d) return
	d.dy = event.clientY - d.startY
	const centre = d.mids[d.from] + d.dy
	d.to = d.mids.filter((mid, i) => i !== d.from && mid < centre).length
}
function endDrag() {
	const d = drag.value
	stopListening()
	drag.value = null
	if (d && d.to !== d.from) moveTo(d.leg, d.from, d.to)
}
function cancelDrag() {
	stopListening()
	drag.value = null
}
function stopListening() {
	window.removeEventListener('pointermove', onDragMove)
	window.removeEventListener('pointerup', endDrag)
	window.removeEventListener('pointercancel', cancelDrag)
}
onBeforeUnmount(stopListening)

function rowStyle(i) {
	const d = drag.value
	if (!d) return null
	if (i === d.from) return { transform: `translateY(${d.dy}px)` }
	if (d.from < d.to && i > d.from && i <= d.to) return { transform: `translateY(${-d.height}px)` }
	if (d.to < d.from && i >= d.to && i < d.from) return { transform: `translateY(${d.height}px)` }
	return null
}
</script>

<template>
	<section v-if="m && ret" ref="rootEl" class="zt-card p-3 editor" aria-label="Edit order and stay times">
		<div class="d-flex justify-content-between align-items-start gap-2">
			<div>
				<div class="zt-label">Spare before the airport</div>
				<div class="spare" :class="spareTone">{{ formatDuration(spareMin) }}</div>
				<div class="tiny text-muted">Back by <b class="mono">{{ formatTime(ret.arrive_iso) }}</b> · latest <b class="mono">{{ formatTime(ret.arrive_by) }}</b></div>
			</div>
			<button type="button" class="btn btn-primary btn-sm" @click="emit('done')">Done</button>
		</div>

		<p class="math tiny mb-0 mt-2" aria-live="polite">
			<template v-if="lastChange">
				<b>{{ lastChange.what }}</b><br />
				Spare {{ formatDuration(lastChange.spareFrom) }} → <b>{{ formatDuration(lastChange.spareTo) }}</b>
				<span v-if="lastChange.spareTo !== lastChange.spareFrom">
					({{ lastChange.spareTo < lastChange.spareFrom ? '−' : '+' }}{{ formatDuration(Math.abs(lastChange.spareTo - lastChange.spareFrom)) }})
				</span>
				· back by {{ formatTime(lastChange.backBy) }}
			</template>
			<template v-else>Drag <i class="bi bi-grip-vertical"></i> to reorder. Use − / + or tap the minutes to change a stay.</template>
		</p>

		<ol ref="listEl" class="rows list-unstyled mt-3 mb-0" :class="{ dragging: drag }">
			<li v-for="(leg, i) in rows" :key="leg.place_id" class="row-item"
				:class="{ lifted: drag?.from === i, fixed: leg.fixed }" :style="rowStyle(i)">
				<button v-if="!leg.fixed" :id="`handle-${leg.place_id}`" type="button" class="handle"
					:aria-label="`Move ${leg.name}. Use up and down arrows.`" :disabled="busy"
					@pointerdown.prevent="startDrag($event, leg, i)"
					@keydown.up.prevent="keyMove(leg, i, -1)" @keydown.down.prevent="keyMove(leg, i, 1)">
					<i class="bi bi-grip-vertical"></i>
				</button>
				<span v-else class="handle locked" :title="`Fixed time with ${leg.with_host}`"><i class="bi bi-lock-fill"></i></span>

				<span class="num">{{ i + 1 + doneCount }}</span>
				<div class="main">
					<div class="name">{{ leg.name }}</div>
					<div class="tiny text-muted mono">{{ formatTime(leg.arrive_iso) }}–{{ formatTime(leg.depart_iso) }}</div>
				</div>

				<div v-if="!leg.fixed" class="stepper" role="group" :aria-label="`${leg.name} stay length`">
					<button type="button" :disabled="busy || leg.stay_min <= MIN_STAY" :aria-label="`${STEP} minutes less`" @click="setStay(leg, leg.stay_min - STEP)">−</button>
					<input v-if="typing === leg.place_id" :id="`stay-${leg.place_id}`" v-model="typed" class="mins-input mono"
						type="number" inputmode="numeric" :min="MIN_STAY" :max="MAX_STAY" :aria-label="`${leg.name} minutes`"
						@keydown.enter.prevent="commitTyping(leg)" @keydown.esc="typing = null" @blur="commitTyping(leg)" />
					<button v-else type="button" class="mins mono" :disabled="busy" :aria-label="`${leg.stay_min} minutes, tap to type`" @click="startTyping(leg)">
						{{ leg.stay_min }}<small>min</small>
					</button>
					<button type="button" :disabled="busy || leg.stay_min >= MAX_STAY" :aria-label="`${STEP} minutes more`" @click="setStay(leg, leg.stay_min + STEP)">+</button>
				</div>
				<span v-else class="tiny text-muted fw-800 text-nowrap">{{ leg.stay_min }} min</span>
			</li>
		</ol>
		<p v-if="doneCount" class="tiny text-muted mt-2 mb-0"><i class="bi bi-check2-circle"></i> {{ doneCount }} completed stop{{ doneCount === 1 ? '' : 's' }} stay where they are.</p>
	</section>
</template>
<style scoped>
.editor {
  scroll-margin-top: 12px;
}

.spare {
  font-family: var(--zt-font-head);
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.05;
}

.spare.warn {
  color: var(--zt-orange);
}

.spare.danger {
  color: var(--zt-pink);
}

.math {
  padding: 8px 10px;
  border-radius: 12px;
  background: var(--zt-yellow-pale);
  color: #111;
  min-height: 2.6em;
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 8px 4px;
  border-radius: 14px;
  border: 2px solid var(--zt-line);
  background: var(--zt-card);
  transition: transform 0.15s ease;
}

.rows.dragging .row-item {
  user-select: none;
}

.row-item.lifted {
  transition: none;
  z-index: 2;
  position: relative;
  box-shadow: 4px 4px 0 var(--zt-line);
}

.row-item.fixed {
  border-color: var(--zt-pink);
}

.handle {
  flex: none;
  width: 34px;
  height: 40px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: none;
  color: var(--zt-muted);
  font-size: 1.2rem;
  touch-action: none;
  cursor: grab;
}

.row-item.lifted .handle {
  cursor: grabbing;
}

.handle.locked {
  font-size: 0.9rem;
  cursor: default;
}

.num {
  flex: none;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--zt-yellow);
  color: #111;
  border: 2px solid var(--zt-line);
  font-weight: 800;
  font-size: 0.78rem;
}

.main {
  flex: 1;
  min-width: 0;
}

.name {
  font-weight: 800;
  font-size: 0.86rem;
  line-height: 1.2;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow-wrap: anywhere;
}

/* Big tap targets: 40 px buttons either side of the minutes. */
.stepper {
  flex: none;
  display: inline-flex;
  align-items: stretch;
  border: 2px solid var(--zt-line);
  border-radius: 12px;
  overflow: hidden;
}

.stepper > button {
  border: 0;
  background: var(--zt-card);
  color: var(--zt-ink);
  font-weight: 900;
  font-size: 1.1rem;
  width: 36px;
  height: 40px;
}

.stepper > button:disabled {
  opacity: 0.4;
}

.stepper .mins,
.stepper .mins-input {
  width: 54px;
  border: 0;
  border-left: 2px solid var(--zt-line);
  border-right: 2px solid var(--zt-line);
  background: var(--zt-yellow-pale);
  color: #111;
  font-weight: 800;
  font-size: 0.95rem;
  text-align: center;
  padding: 0;
}

.stepper .mins small {
  font-size: 0.6rem;
  margin-left: 1px;
}

.mins-input {
  -moz-appearance: textfield;
}

.mins-input::-webkit-inner-spin-button,
.mins-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>

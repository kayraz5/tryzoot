<script setup>
import { computed, ref, watch } from 'vue'
import { useMissionStore } from '../../../model/stores/mission.js'
import { useUiStore } from '../../../model/stores/ui.js'
import { usePartyStore } from '../../../model/stores/party.js'
import { placeById } from '../../../model/services/catalog.js'
import { formatTime } from '../../../model/services/hours.js'
import StopGallery from '../../common/StopGallery.vue'
import PlacePicker from './PlacePicker.vue'

/**
 * One stop on the mission timeline (or the trip back to the airport).
 * Hand edits live here: "Change stop" opens swap / add after / remove, and the return leg
 * can add a stop before heading back. The parent keeps one card open at a time (`open`).
 */
const props = defineProps({
  leg: { type: Object, required: true },
  open: { type: Boolean, default: false }
})
const emit = defineEmits(['toggle', 'close'])

const store = useMissionStore()
const ui = useUiStore()
const party = usePartyStore()
const place = computed(() => placeById.value.get(props.leg.place_id))
const missionPlaceIds = computed(() => new Set(store.mission?.legs.map((l) => l.place_id) || []))

const picker = ref(null) // { mode: 'swap' | 'add', near, title }
const busy = ref(false)
watch(() => props.open, (open) => { if (!open) picker.value = null })

function openSwap() {
  picker.value = { mode: 'swap', near: props.leg, title: `Swap ${props.leg.name} for…` }
}
function openAdd() {
  const visit = props.leg.kind === 'visit'
  const near = visit ? props.leg : store.visitLegs.filter((l) => l.status === 'pending').at(-1) || store.mission.origin
  picker.value = { mode: 'add', near, title: visit ? `Add a stop after ${props.leg.name}` : 'Add a stop before heading back' }
  if (!visit) emit('toggle')
}
function closePicker() {
  picker.value = null
  if (props.leg.kind === 'return') emit('close')
}
async function run(action) {
  busy.value = true
  try {
    if (await action()) emit('close')
  } catch (err) {
    ui.toast(err.message, 'danger')
  } finally {
    busy.value = false
  }
}
function onPick(p) {
  const { leg } = props
  run(() => (picker.value.mode === 'swap' ? store.swapStop(leg, p) : store.addStop(p, leg.kind === 'visit' ? leg.place_id : null)))
}
</script>

<template>
  <div class="zt-card p-3 stop-card" :class="{ joined: leg.fixed }">
    <StopGallery v-if="leg.kind === 'visit' && place" :place="place" class="mb-3" />
    <div class="d-flex justify-content-between gap-2">
      <div class="flex-grow-1">
        <div class="tiny text-muted fw-800 mono">
          {{ formatTime(leg.arrive_iso) }}<template v-if="leg.kind === 'visit'">–{{ formatTime(leg.depart_iso) }} · stay {{ leg.stay_min }} min</template>
          <template v-else> · must arrive by {{ formatTime(leg.arrive_by) }}</template>
        </div>
        <h2 class="h6 mb-1">
          <RouterLink v-if="leg.kind === 'visit'" :to="`/place/${leg.place_id}`" class="text-reset">{{ leg.name }}</RouterLink>
          <span v-else>{{ leg.name }}</span>
        </h2>
      </div>
      <div class="text-end">
        <span class="zt-pill pink text-nowrap">+{{ leg.xp }} XP</span>
        <div v-if="leg.kind === 'visit'" class="tiny mt-1" :class="leg.indoor ? 'text-muted' : 'fw-800'">
          <i class="bi" :class="leg.indoor ? 'bi-house' : 'bi-sun'"></i> {{ leg.indoor ? 'Indoor' : 'Outdoor' }}
        </div>
      </div>
    </div>
    <p class="small mb-2 why">{{ leg.why }}</p>
    <p v-if="leg.kind === 'visit' && place?.hours_verified === false" class="tiny fw-800 mb-2 hours-note">
      <i class="bi bi-exclamation-circle"></i> Opening hours not confirmed, check before going
    </p>
    <div v-if="leg.sidequest" class="zt-pill pale mb-2"><i class="bi bi-gem"></i> Sidequest</div>
    <template v-if="leg.fixed && leg.status === 'pending'">
      <div class="d-flex gap-2 flex-wrap align-items-center">
        <RouterLink :to="`/map?focus=${leg.seq}`" class="btn btn-sm btn-soft"><i class="bi bi-geo"></i> On map</RouterLink>
        <button type="button" class="btn btn-sm btn-primary" @click="party.openChat(leg.party_id)"><i class="bi bi-chat-dots-fill"></i> Chat</button>
        <RouterLink :to="`/quests/${leg.party_id}`" class="btn btn-sm btn-soft"><i class="bi bi-people-fill"></i> Quest</RouterLink>
        <span class="tiny text-muted"><i class="bi bi-lock-fill"></i> Fixed time with {{ leg.with_host }}</span>
      </div>
    </template>
    <template v-else-if="leg.kind === 'visit' && leg.status === 'pending'">
      <div class="d-flex gap-2 flex-wrap">
        <RouterLink :to="`/map?focus=${leg.seq}`" class="btn btn-sm btn-soft"><i class="bi bi-geo"></i> On map</RouterLink>
        <button class="btn btn-sm btn-soft" :class="{ active: open }" :aria-expanded="open" @click="emit('toggle')">
          <i class="bi bi-pencil"></i> Change stop
        </button>
        <button class="btn btn-sm btn-link text-muted" @click="store.skip(leg)">Skip</button>
      </div>
      <div v-if="open" class="edit-panel mt-3">
        <div class="tiny fw-800 mb-2">Change this stop</div>
        <div class="d-flex gap-2 flex-wrap">
          <button class="btn btn-sm btn-soft" :disabled="busy" @click="openSwap"><i class="bi bi-arrow-left-right"></i> Swap</button>
          <button class="btn btn-sm btn-soft" :disabled="busy" @click="openAdd"><i class="bi bi-plus-lg"></i> Add after</button>
          <button class="btn btn-sm btn-link text-danger ms-auto" :disabled="busy" @click="run(() => store.removeStop(leg))"><i class="bi bi-trash"></i> Remove</button>
        </div>
        <PlacePicker v-if="picker" :title="picker.title" :near="picker.near"
          :exclude="missionPlaceIds" :busy="busy" @pick="onPick" @close="closePicker" />
      </div>
    </template>
    <div v-else-if="leg.status === 'stamped'" class="tiny text-success fw-800"><i class="bi bi-check2-circle"></i> Stamped {{ leg.stamped_at ? formatTime(leg.stamped_at) : '' }}</div>
    <div v-else-if="leg.status === 'skipped'" class="tiny text-muted fw-800">Skipped</div>
    <template v-if="leg.kind === 'return' && leg.status === 'pending'">
      <PlacePicker v-if="open && picker" :title="picker.title" :near="picker.near" :exclude="missionPlaceIds" :busy="busy"
        @pick="onPick" @close="closePicker" />
      <button v-else class="btn btn-sm btn-soft" :disabled="busy" @click="openAdd">
        <i class="bi bi-plus-lg"></i> Add a stop before heading back
      </button>
    </template>
  </div>
</template>

<style scoped>
.stop-card { 
  box-shadow: var(--zt-shadow-sm); }
.stop-card.joined { 
  border-color: var(--zt-pink); }
.why { 
  color: var(--zt-muted); }
.hours-note { 
  color: #b45309; }
[data-bs-theme='dark'] .hours-note { 
  color: var(--zt-yellow); }
.edit-panel { 
  border-top: 2px dashed var(--zt-soft-line); 
  padding-top: 12px; }
</style>


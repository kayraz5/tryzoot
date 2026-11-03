<!-- EDITOR: KAYRA -->

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMissionStore } from '../../model/stores/mission.js'
import { useUiStore } from '../../model/stores/ui.js'
import { loadCatalog } from '../../model/services/catalog.js'
import { formatTime } from '../../model/services/hours.js'
import { rainLookup } from '../../model/services/weather.js'
import { RAIN_LIMIT } from '../../model/services/planner.js'
import { tick } from '../../model/services/clock.js'
import LayoverCard from '../components/mission/LayoverCard.vue'
import MissionHeader from '../components/mission/MissionHeader.vue'
import QuestDoneCard from '../components/mission/QuestDoneCard.vue'
import StopCard from '../components/mission/StopCard.vue'
import ReplanCard from '../components/mission/ReplanCard.vue'
import ScheduleEditor from '../components/mission/ScheduleEditor.vue'
import OpenToCompanySheet from '../components/quests/OpenToCompanySheet.vue'

const route = useRoute()
const router = useRouter()
const store = useMissionStore()
const ui = useUiStore()

async function load() {
  await loadCatalog()
  if (route.params.id) await store.load(route.params.id)
  else await store.loadActive()
  if (!ui.weather && store.mission) ui.loadWeather(store.mission.legs[0].lat, store.mission.legs[0].lng)
  // Joined someone's quest? Check the host hasn't closed it or changed my stops.
  if (store.mission?.joined) store.checkJoined()
  focusCurrent()
}
onMounted(load)
watch(() => route.params.id, load)

const m = computed(() => store.mission)

// Completed stops (stamped or skipped) stay out of the way: one summary row, expandable to compact lines.
const showDone = ref(false)
const isDone = (leg) => leg.kind === 'visit' && leg.status !== 'pending'
const doneCount = computed(() => m.value?.legs.filter(isDone).length || 0)

// Opening the page brings the current stop into view, with a short highlight.
const flash = ref(null) // seq of the card being highlighted
async function focusCurrent() {
  await nextTick()
  const next = store.nextLeg
  const el = next && document.getElementById(`leg-${next.seq}`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.querySelector('.stop-card')?.focus({ preventScroll: true })
  flash.value = next.seq
  setTimeout(() => { if (flash.value === next.seq) flash.value = null }, 1600)
}
const companyOpen = ref(false) // "Open to company" sheet (group quests)
const editingSchedule = ref(false) // stop cards swap for the compact order + stay-time editor

// Live "leave by" from where the traveller is; refreshed every 30 s of the app clock.
const clockStep = computed(() => Math.floor(tick.value / 30000))
const leaveBy = computed(() => (clockStep.value, m.value ? store.leaveBy() : null))

const modeIcon = { walk: 'bi-person-walking', mrt: 'bi-train-front', taxi: 'bi-taxi-front' }
const modePill = { walk: '', mrt: 'ink', taxi: 'pale' }

// Weather checker
const wetLegs = computed(() => {
  if (!m.value) return []
  const rainAt = rainLookup(ui.weather, ui.forceRain)
  return m.value.legs.filter((l) => l.kind === 'visit' && l.status === 'pending' && l.indoor === false && rainAt(Date.parse(l.arrive_iso)) > RAIN_LIMIT)
})

// Editing schedule
const editing = ref(null)
const editKey = (leg) => (leg.kind === 'return' ? 'end' : leg.place_id)
const toggleEdit = (leg) => (editing.value = editing.value === editKey(leg) ? null : editKey(leg))
watch(() => m.value?.id, () => { editing.value = null; editingSchedule.value = false })

// "New itinerary": different stops for the rest of the plan (the old one can be brought back).
async function regenerate() {
  editing.value = null
  if (await store.regenerate()) focusCurrent()
}
</script>

<template>
  <main class="zt-page">
    <div v-if="!m" class="text-center py-5">
      <div v-if="store.status === 'planning'" class="spinner-border text-primary"></div>
      <template v-else>
        <i class="bi bi-signpost-split display-4 text-muted"></i>
        <h1 class="h4 mt-3">No mission yet</h1>
        <p class="text-muted">Tell us your layover and we’ll build one.</p>
        <RouterLink to="/plan" class="btn btn-primary">Plan a layover</RouterLink>
      </template>
    </div>

    <template v-else>
      <MissionHeader v-model:editing-schedule="editingSchedule" @regenerate="regenerate" />

      <QuestDoneCard v-if="m.completed" />

      <LayoverCard :mission="m" :leave-by-ms="leaveBy?.ms ?? null" class="mb-3" />

      <div v-if="wetLegs.length" class="alert rain-alert d-flex align-items-center gap-3" role="alert">
        <i class="bi bi-cloud-lightning-rain fs-3"></i>
        <div class="flex-grow-1 small">
          <b>Rain likely during {{ wetLegs.map((l) => l.name).join(', ') }}.</b>
          Swap outdoor stops for indoor ones nearby?
        </div>
        <button class="btn btn-sm" :disabled="store.status === 'planning'" @click="store.replan('rain')">Indoor rewrite</button>
      </div>

      <ScheduleEditor v-if="editingSchedule" class="mb-3" @done="editingSchedule = false" />

      <ol v-else class="timeline list-unstyled">
        <li class="tl-start">
          <div class="dot start"><i class="bi bi-airplane-fill"></i></div>
          <div class="small"><b class="mono">{{ formatTime(Date.parse(m.start_iso) + m.buffers.exit_min * 60000) }}</b> Leave {{ m.origin.label }}<span v-if="m.buffers.exit_min" class="text-muted"> (after {{ m.buffers.exit_min }} min immigration)</span></div>
        </li>

        <li v-if="doneCount" class="tl-done-toggle">
          <div class="dot done"><i class="bi bi-check-lg"></i></div>
          <button type="button" class="btn btn-link btn-sm p-0 text-reset fw-800" :aria-expanded="showDone" @click="showDone = !showDone">
            {{ doneCount }} completed stop{{ doneCount === 1 ? '' : 's' }} · <span class="text-decoration-underline">{{ showDone ? 'Hide' : 'Show' }}</span>
          </button>
        </li>

        <template v-for="leg in m.legs" :key="leg.seq + leg.place_id">
          <!-- Done: a compact greyed line, only when expanded -->
          <template v-if="isDone(leg)">
            <li v-if="showDone" class="tl-done">
              <div class="dot done"><i class="bi" :class="leg.status === 'stamped' ? 'bi-patch-check-fill' : 'bi-skip-forward-fill'"></i></div>
              <div class="min-w-0 text-truncate small">
                <RouterLink :to="`/place/${leg.place_id}`" class="text-reset fw-800">{{ leg.name }}</RouterLink>
                <span class="text-muted"> · {{ leg.status === 'stamped' ? `Stamped ${leg.stamped_at ? formatTime(leg.stamped_at) : ''}` : 'Skipped' }}</span>
              </div>
            </li>
          </template>

          <template v-else>
          <li class="tl-travel">
            <span class="zt-pill" :class="modePill[leg.travel_mode]"><i class="bi" :class="modeIcon[leg.travel_mode]"></i> {{ leg.travel_min }} min</span>
            <span class="tiny text-muted ms-2">{{ leg.travel_detail }}</span>
          </li>

          <li :id="`leg-${leg.seq}`" :class="['tl-stop', leg.kind, leg.status, { next: store.nextLeg === leg, flash: flash === leg.seq }]">
            <div class="dot">
              <i v-if="leg.kind === 'return'" class="bi bi-house-door-fill"></i>
              <i v-else-if="leg.status === 'stamped'" class="bi bi-patch-check-fill"></i>
              <span v-else>{{ leg.seq }}</span>
            </div>

            <StopCard :leg="leg" :open="editing === editKey(leg)" :tabindex="store.nextLeg === leg ? -1 : undefined"
              @toggle="toggleEdit(leg)" @close="editing = null" />

          </li>

          </template>
        </template>
      </ol>

      <ReplanCard v-if="!m.completed" @finished="focusCurrent" />

      <div v-if="!m.completed" class="play-bar d-flex gap-2">
        <button class="btn btn-soft btn-lg company-btn" @click="companyOpen = true" aria-label="Open to company">
          <i class="bi bi-people-fill"></i><span class="d-none d-sm-inline"> Open to company</span>
        </button>
        <button class="btn btn-pop btn-lg flex-grow-1" @click="router.push('/map')"><i class="bi bi-controller"></i> Play on map</button>
      </div>
      <OpenToCompanySheet :mission="m" :open="companyOpen" @close="companyOpen = false" />
    </template>
  </main>
</template>
<style scoped>
.timeline {
  position: relative;
  margin: 0 0 16px;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 18px;
  top: 8px;
  bottom: 8px;
  border-left: 3px dotted var(--zt-line);
}

.timeline li {
  position: relative;
  padding-left: 52px;
}

.tl-start {
  padding-bottom: 8px;
  display: flex;
  align-items: center;
  min-height: 40px;
}

.tl-travel {
  padding: 6px 0 6px 52px;
}

.tl-stop {
  padding-bottom: 6px;
}

.dot {
  position: absolute;
  left: 0;
  top: 10px;
  width: 39px;
  height: 39px;
  border-radius: 50%;
  background: var(--zt-yellow);
  color: #111;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-family: var(--zt-font-head);
  border: var(--zt-bw) solid var(--zt-line);
  z-index: 1;
}

.tl-start .dot {
  top: 0;
  background: var(--zt-card);
  color: var(--zt-ink);
}

.tl-stop.return .dot {
  background: var(--zt-card);
  color: var(--zt-ink);
}

.tl-stop.stamped .dot {
  background: #111;
  color: var(--zt-yellow);
  border-color: #111;
}

[data-bs-theme='dark'] .tl-stop.stamped .dot {
  border-color: var(--zt-yellow);
}

.tl-stop.skipped {
  opacity: 0.5;
}

.tl-stop.next .dot {
  background: var(--zt-pink);
  animation: zt-pulse 1.4s infinite;
}

.tl-stop.next .stop-card {
  box-shadow: 5px 5px 0 var(--zt-pink);
}

.tl-stop.next .stop-card:focus {
  outline: none;
}

.tl-stop.flash .stop-card {
  animation: leg-flash 1.6s ease-out;
}

@keyframes leg-flash {
  0%, 40% {
    outline: 4px solid var(--zt-pink);
    outline-offset: 4px;
  }

  100% {
    outline: 4px solid transparent;
    outline-offset: 4px;
  }
}

.tl-done-toggle,
.tl-done {
  display: flex;
  align-items: center;
  min-height: 34px;
  padding-bottom: 6px;
}

.tl-done {
  opacity: 0.6;
}

.dot.done {
  width: 28px;
  height: 28px;
  left: 5px;
  top: 3px;
  font-size: 0.8rem;
  background: var(--zt-card);
  color: var(--zt-muted);
  border-color: var(--zt-muted);
}

.rain-alert {
  background: #111;
  color: var(--zt-yellow);
  border: var(--zt-bw) solid #111;
  border-radius: 18px;
  box-shadow: 4px 4px 0 var(--zt-yellow);
}

[data-bs-theme='dark'] .rain-alert {
  border-color: var(--zt-yellow);
}

.rain-alert .btn {
  --bs-btn-bg: var(--zt-yellow);
  --bs-btn-color: #111;
  --bs-btn-border-color: var(--zt-yellow);
}

.play-bar {
  position: sticky;
  bottom: calc(var(--zt-nav-h) + 24px);
  z-index: 5;
}
</style>
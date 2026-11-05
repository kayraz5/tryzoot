<!-- EDITOR: KAYRA -->
<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMissionStore } from '../../../model/stores/mission.js'
import { useTripStore } from '../../../model/stores/trip.js'
import { STYLES } from '../../../model/data/origins.js'
import TimeToGate from './TimeToGate.vue'

/**
 * Top of the mission page: style / planner pills and the countdown share the first row so the
 * title gets the full width, then the "Edit order & times" and "New itinerary" buttons, and the
 * undo strip after a new itinerary.
 */
const editingSchedule = defineModel('editingSchedule', { type: Boolean, default: false })
const emit = defineEmits(['regenerate'])

const store = useMissionStore()
const trip = useTripStore()
const router = useRouter()
const m = computed(() => store.mission)
const style = computed(() => STYLES[m.value.style] || STYLES.budget)
const hasPending = computed(() => store.visitLegs.some((l) => l.status === 'pending'))

function newLayover() {
  trip.startNewLayover()
  router.push({ name: 'plan', query: { fresh: '1' } })
}
</script>

<template>
  <header class="mhead mb-3">
    <div class="mhead-top">
      <div class="pills">
        <span class="zt-pill"><i class="bi" :class="style.icon"></i> {{ style.label }}</span>
        <span v-if="m.source === 'groq'" class="zt-pill ink" :title="m.groq_model"
          ><i class="bi bi-stars"></i> Groq</span
        >
        <span v-else class="zt-pill paper" :title="m.fallback_reason || ''"
          ><i class="bi bi-cpu"></i> Offline</span
        >
        <span v-if="m.replans" class="zt-pill pale">Replanned ×{{ m.replans }}</span>
      </div>
      <TimeToGate :must-return-ms="store.mustReturnMs" :start-ms="Date.parse(m.start_iso)" />
    </div>
    <h1 class="title">{{ m.title }}</h1>
    <div class="meta">
      <span><i class="bi bi-geo-alt"></i> From {{ m.origin.label }}</span>
      <span
        ><i class="bi bi-patch-check"></i> {{ store.stampedCount }}/{{
          store.visitLegs.length
        }}
        stamped</span
      >
    </div>
    <div class="mt-2 d-flex flex-wrap gap-2">
      <button
        v-if="hasPending"
        type="button"
        class="btn btn-sm btn-soft"
        :class="{ active: editingSchedule }"
        :aria-expanded="editingSchedule"
        @click="editingSchedule = !editingSchedule"
      >
        <i class="bi" :class="editingSchedule ? 'bi-check-lg' : 'bi-arrow-down-up'"></i>
        {{ editingSchedule ? 'Done editing' : 'Edit order & times' }}
      </button>
      <button
        v-if="hasPending && !editingSchedule"
        type="button"
        class="btn btn-sm btn-soft"
        :disabled="store.status === 'planning'"
        @click="emit('regenerate')"
      >
        <i
          class="bi"
          :class="store.status === 'planning' ? 'bi-hourglass-split' : 'bi-shuffle'"
        ></i>
        {{ store.status === 'planning' ? 'Finding new stops…' : 'New itinerary' }}
      </button>
      <button v-if="!m.completed" type="button" class="btn btn-sm btn-primary" @click="newLayover">
        <i class="bi bi-plus-lg"></i> Plan a new layover
      </button>
    </div>
    <div v-if="store.previousPlan" class="undo-strip mt-2" role="status">
      <span class="small">New stops picked. Liked the old plan better?</span>
      <button
        type="button"
        class="btn btn-sm btn-link p-0 fw-800"
        @click="store.restorePreviousPlan()"
      >
        Bring it back
      </button>
      <button
        type="button"
        class="btn-close btn-sm ms-auto"
        aria-label="Keep the new plan"
        @click="store.previousPlan = null"
      ></button>
    </div>
  </header>
</template>

<style scoped>
.mhead-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.pills .zt-pill {
  white-space: nowrap;
}

.title {
  font-size: clamp(1.6rem, 6.5vw, 2.3rem);
  line-height: 1.05;
  margin: 12px 0 6px;
  text-wrap: balance;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  column-gap: 14px;
  row-gap: 2px;
  font-size: 0.84rem;
  color: var(--zt-muted);
}

.meta > span {
  white-space: nowrap;
}

.meta .bi {
  margin-right: 3px;
}

.undo-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 2px solid var(--zt-line);
  border-radius: 14px;
  background: var(--zt-yellow-pale);
  color: #111;
}

.undo-strip .btn-link {
  color: #111;
  white-space: nowrap;
}
</style>

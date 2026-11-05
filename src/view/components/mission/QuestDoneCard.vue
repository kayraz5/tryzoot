<!-- EDITOR: KAYRA -->
<script setup>
import { useRouter } from 'vue-router'
import { useMissionStore } from '../../../model/stores/mission.js'
import { useTripStore } from '../../../model/stores/trip.js'

/** Checked in back at the airport: a summary and a fresh layover instead of the edit tools. */
const store = useMissionStore()
const trip = useTripStore()
const router = useRouter()

function newLayover() {
  trip.startNewLayover()
  router.push('/plan')
}
</script>

<template>
  <section class="zt-card p-3 mb-3 done-card">
    <div class="d-flex align-items-center gap-3">
      <i class="bi bi-trophy-fill done-icon" aria-hidden="true"></i>
      <div class="flex-grow-1">
        <div class="zt-label">Quest complete</div>
        <div class="fw-800">
          {{ store.stampedCount }} of {{ store.visitLegs.length }} stops stamped<span v-if="store.mission.ended_early"> · finished early</span>
        </div>
      </div>
    </div>
    <div class="d-flex gap-2 mt-3">
      <button type="button" class="btn btn-primary flex-grow-1" @click="newLayover"><i class="bi bi-plus-lg"></i> Plan a new layover</button>
      <RouterLink to="/passport" class="btn btn-soft"><i class="bi bi-journal-bookmark-fill"></i> Passport</RouterLink>
    </div>
  </section>
</template>

<style scoped>
.done-card { 
  background: var(--zt-yellow-pale); 
  color: #111; }
.done-icon { 
  font-size: 2rem; 
  color: #b45309; }
</style>

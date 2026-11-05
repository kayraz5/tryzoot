<script setup>
import { useTripStore } from '../../../model/stores/trip.js'
import { TRANSPORT } from '../../../model/services/travel.js'

/**
 * "Getting around": public transport (MRT & bus) or car (taxi / Grab), under "How do you travel?".
 * The planner times the trips between stops with it: car is quicker, bus slower.
 * It can be switched later from the map card.
 */
defineProps({ wide: { type: Boolean, default: false } })
const trip = useTripStore()
const d = trip.draft
if (!d.transport) d.transport = 'transit' // drafts saved before this option existed
</script>

<template>
  <section :class="{ 'zt-card p-3': wide }">
    <component :is="wide ? 'div' : 'h2'" :class="wide ? 'plan-label' : 'plan-step-h'"
      >Getting around</component
    >
    <div class="transport-grid mt-2" role="radiogroup" aria-label="Getting around">
      <button
        v-for="(t, id) in TRANSPORT"
        :key="id"
        type="button"
        role="radio"
        class="plan-pick"
        :class="{ active: d.transport === id }"
        :aria-checked="d.transport === id"
        @click="d.transport = id"
      >
        <i class="bi" :class="t.icon"></i>
        <b>{{ t.label }}</b>
        <span class="tiny sub">{{ t.sub }}</span>
        <i v-if="d.transport === id" class="bi bi-check-circle-fill plan-check"></i>
      </button>
    </div>
    <p class="tiny text-muted mb-0 mt-2">
      Short hops are always on foot. You can switch later on the map.
    </p>
  </section>
</template>

<style scoped>
.transport-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
b {
  text-transform: uppercase;
  font-size: 0.78rem;
}
.sub {
  font-weight: 600;
  color: inherit;
  opacity: 0.8;
}
</style>

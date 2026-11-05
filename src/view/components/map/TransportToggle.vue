<script setup>
import { computed, ref } from 'vue'
import { useMissionStore } from '../../../model/stores/mission.js'
import { TRANSPORT } from '../../../model/services/travel.js'

/**
 * "Public transport | Car" switch on the map card. Switching re-times the stops still ahead
 * with the new travel times; the route line and directions follow (roads for car / bus,
 * train lines for MRT). Plans made before this choice existed show neither as selected.
 */
const store = useMissionStore()
const current = computed(() => store.mission?.prefs?.transport || null)
const busy = ref(false)

async function choose(mode) {
  if (busy.value || mode === current.value) return
  busy.value = true
  try { await store.setTransport(mode) } finally { busy.value = false }
}
</script>

<template>
  <div v-if="store.mission" class="transport-toggle" role="radiogroup" aria-label="How are you getting around?">
    <button v-for="(t, id) in TRANSPORT" :key="id" type="button" role="radio" :aria-checked="current === id"
      class="opt" :class="{ on: current === id }" :disabled="busy" @click="choose(id)">
      <i class="bi" :class="t.icon" aria-hidden="true"></i> {{ t.short }}
    </button>
  </div>
</template>

<style scoped>
/* Segmented pill matching the card's other controls. cqi resolves against
   .mission-card, so this scales with the card rather than the viewport. */
.transport-toggle {
  display: flex;
  padding: calc(var(--gap) * 0.35);
  gap: calc(var(--gap) * 0.35);
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 244, 194, 0.16);
}
.opt {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: calc(var(--pad-sm) * 0.8) calc(var(--pad) * 1.1);
  border: 0;
  border-radius: 99px;
  background: none;
  color: var(--zt-yellow-pale);
  opacity: 0.65;
  font-size: var(--t-sm);
  font-weight: 800;
  white-space: nowrap;
  cursor: pointer;
}
.opt.on { background: var(--zt-yellow); color: #111; opacity: 1; }
.opt:disabled { cursor: wait; }
</style>

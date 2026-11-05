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
.transport-toggle { display: flex; padding: 3px; gap: 3px; border-radius: 99px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 244, 194, 0.25); }
.opt { flex: 1; padding: 4px 10px; border: 0; border-radius: 99px; background: none; color: var(--zt-yellow-pale); opacity: 0.7; font-size: 0.75rem; font-weight: 800; white-space: nowrap; }
.opt.on { background: var(--zt-yellow); color: #111; opacity: 1; }
.opt:disabled { cursor: wait; }
</style>

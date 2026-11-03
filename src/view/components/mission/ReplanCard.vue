<script setup>
import { computed, ref } from 'vue'
import { useMissionStore } from '../../../model/stores/mission.js'
import { useUiStore } from '../../../model/stores/ui.js'

/** "Plans change": rewrite the rest of the mission, or finish early and head back (asks first, inline). */
const emit = defineEmits(['finished'])
const store = useMissionStore()
const ui = useUiStore()

const replans = [
  { mode: 'behind', label: "I'm behind", icon: 'bi-hourglass-bottom' },
  { mode: 'less-walking', label: 'Less walking', icon: 'bi-train-front' },
  { mode: 'swap', label: 'Swap next stop', icon: 'bi-arrow-left-right' },
  { mode: 'rain', label: 'Rain plan', icon: 'bi-umbrella' }
]

const left = computed(() => store.visitLegs.filter((l) => l.status === 'pending').length)
const home = computed(() => (store.mission?.return_to || store.mission?.origin)?.label || 'the airport')
const confirmFinish = ref(false)
const busy = ref(false)
async function finishEarly() {
  confirmFinish.value = false
  busy.value = true
  try {
    const skipped = await store.finishEarly()
    ui.toast(`${skipped} stop${skipped === 1 ? '' : 's'} skipped. Head back to ${home.value}, then tap "I'm back" on the map.`, 'success', 5000)
    emit('finished')
  } catch (err) {
    ui.toast(err.message, 'danger')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="zt-card p-3 mb-3">
    <div class="small fw-800 mb-2"><i class="bi bi-arrow-repeat"></i> Plans change. Rewrite the rest:</div>
    <div class="d-flex flex-wrap gap-2">
      <button v-for="r in replans" :key="r.mode" class="btn btn-soft btn-sm" :disabled="store.status === 'planning'" @click="store.replan(r.mode)">
        <i class="bi" :class="r.icon"></i> {{ r.label }}
      </button>
    </div>
    <p class="tiny text-muted mb-0 mt-2">Stamped stops stay. Only future legs are replaced, from where you are now.</p>
    <div v-if="left" class="finish mt-3">
      <button v-if="!confirmFinish" type="button" class="btn btn-sm btn-link text-danger p-0" @click="confirmFinish = true">
        <i class="bi bi-flag-fill"></i> Finish early and head back
      </button>
      <template v-else>
        <div class="small fw-800 mb-2">
          Skip the {{ left }} stop{{ left === 1 ? '' : 's' }} left and head back to {{ home }} now?
        </div>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-sm btn-primary" :disabled="busy" @click="finishEarly">Head back now</button>
          <button type="button" class="btn btn-sm btn-soft" @click="confirmFinish = false">Keep exploring</button>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.finish { border-top: 2px dashed var(--zt-soft-line); padding-top: 12px; }
</style>

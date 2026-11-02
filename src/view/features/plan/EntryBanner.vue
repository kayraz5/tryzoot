<script setup>
import { computed, ref } from 'vue'
import { usePassportStore } from '../../../model/stores/passport.js'
import { useTripStore } from '../../../model/stores/trip.js'
import EntryCheck from '../profile/EntryCheck.vue'

/**
 * Entry check from the profile (passport.canLeaveAirport), as a dropdown on the plan page:
 * the header says where they stand, tapping it opens the full passport checker in place.
 * Warns, never blocks: the traveller may already hold a visa.
 *   'no'  → needs a visa to leave the airport
 *   'ask' → may qualify for the 96 h transit scheme, not answered yet
 *   null  → no passport country set yet (gentle prompt)
 * Hidden for 'yes' unless they opened it here (so a fresh answer stays on screen).
 */
const passport = usePassportStore()
const d = useTripStore().draft

const MESSAGES = {
	no: { tone: 'warn', icon: 'bi-exclamation-triangle-fill', text: 'Your passport may need a Singapore visa to leave the airport.' },
	ask: { tone: 'warn', icon: 'bi-question-circle-fill', text: 'One question to check you can leave the airport.' },
	none: { tone: 'info', icon: 'bi-passport', text: 'Add your passport to check you can leave the airport.' },
	yes: { tone: 'ok', icon: 'bi-check-circle-fill', text: 'Your passport can leave the airport.' }
}
const open = ref(false)
const touched = ref(false) // opened on this page: keep showing it after the answer turns 'yes'
const message = computed(() => {
	const status = passport.canLeaveAirport
	if (status === undefined || (status === 'yes' && !touched.value)) return null
	return MESSAGES[status ?? 'none'] || null
})
function toggle() {
	open.value = !open.value
	touched.value = true
}
</script>

<template>
	<div v-if="message && !d.entryDismissed" class="entry-drop" :class="message.tone" role="note">
		<div class="entry-head">
			<button type="button" class="entry-toggle" :aria-expanded="open" aria-controls="entry-check" @click="toggle">
				<i class="bi" :class="message.icon" aria-hidden="true"></i>
				<span class="flex-grow-1">{{ message.text }}</span>
				<span class="fw-800 nowrap">{{ open ? 'Hide' : 'Check' }} <i class="bi" :class="open ? 'bi-chevron-up' : 'bi-chevron-down'"></i></span>
			</button>
			<button type="button" class="btn-close" aria-label="Dismiss" @click="d.entryDismissed = true"></button>
		</div>
		<div v-if="open" id="entry-check" class="entry-body">
			<EntryCheck embedded />
		</div>
	</div>
</template>

<style scoped>
.entry-drop { border: var(--zt-bw) solid var(--zt-line); border-radius: 16px; font-size: 0.86rem; color: #111; overflow: hidden; }
.entry-drop.warn { background: var(--zt-warn-bg); }
.entry-drop.warn .entry-toggle > .bi { color: #b45309; }
.entry-drop.info { background: var(--zt-yellow-pale); }
.entry-drop.ok { background: var(--zt-ok-bg); }
.entry-drop.ok .entry-toggle > .bi { color: #15803d; }
.entry-head { display: flex; align-items: center; gap: 4px; padding-right: 10px; }
.entry-toggle {
	display: flex; align-items: flex-start; gap: 10px; flex: 1; min-width: 0; text-align: left;
	padding: 12px 6px 12px 14px; border: 0; background: none; color: inherit; font: inherit;
}
.entry-toggle > .bi { font-size: 1.1rem; flex: none; margin-top: 1px; }
.nowrap { white-space: nowrap; }
.entry-drop .btn-close { flex: none; transform: scale(0.8); }
.entry-body { background: var(--zt-card); color: var(--zt-ink); border-top: 2px solid var(--zt-line); padding: 12px 14px; }
</style>

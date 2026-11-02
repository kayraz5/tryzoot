<script setup>
import { computed, ref } from 'vue'
import { useTripStore } from '../../../model/stores/trip.js'
import { formatTime } from '../../../model/services/hours.js'
import { FOOD } from './planUi.js'
import MoreOptionsFields from './MoreOptionsFields.vue'

/** "More options" row with a one-line summary: expands inline on wide screens, opens a bottom sheet on phones. */
const props = defineProps({ wide: { type: Boolean, default: false } })
const trip = useTripStore()
const d = trip.draft
const open = ref(false)

const summary = computed(() => {
	const parts = [`Walk ≤ ${d.maxWalk} min`, `${d.partySize} ${d.partySize === 1 ? 'person' : 'people'}`]
	if (d.foodNeeds !== 'none') parts.push(FOOD.find((f) => f.id === d.foodNeeds)?.label)
	if (!d.startAtLanding) parts.push(`out at ${formatTime(trip.startMs)}`)
	return parts.join(' · ')
})
const chevron = computed(() => (props.wide ? (open.value ? 'bi-chevron-up' : 'bi-chevron-down') : 'bi-chevron-right'))
</script>

<template>
	<section class="zt-card options">
		<button type="button" class="options-row" :aria-expanded="open" @click="open = !open">
			<span class="plan-label mb-0">More options</span>
			<span class="tiny flex-grow-1 text-start ms-2">{{ summary }}</span>
			<i class="bi" :class="chevron"></i>
		</button>
		<MoreOptionsFields v-if="wide && open" class="px-3 pb-3" />
	</section>

	<div v-if="!wide && open" class="zt-sheet-backdrop" @click.self="open = false">
		<div class="zt-sheet zt-card" role="dialog" aria-modal="true" aria-labelledby="opts-h">
			<div class="zt-grabber"></div>
			<div class="d-flex justify-content-between align-items-center mb-2">
				<h2 id="opts-h" class="plan-step-h sheet-h">More options</h2>
				<button type="button" class="btn-close" aria-label="Close" @click="open = false"></button>
			</div>
			<MoreOptionsFields />
			<button type="button" class="btn btn-primary btn-lg w-100 mt-3" @click="open = false">Done</button>
		</div>
	</div>
</template>

<style scoped>
.options { padding: 0; overflow: hidden; }
.options-row { display: flex; align-items: center; width: 100%; padding: 14px 16px; border: 0; background: none; color: var(--zt-ink); }
.sheet-h { font-size: 1.6rem; }
</style>

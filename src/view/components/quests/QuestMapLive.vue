<!-- EDITOR: EUDALE -->
<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMissionStore } from '../../../model/stores/mission.js'
import { usePartyStore } from '../../../model/stores/party.js'
import * as social from '../../../model/services/social.js'
import { tick } from '../../../model/services/clock.js'
import { syncMemberMarkers, clearMemberMarkers, meetingMarker } from './memberMarkers.js'
import { useActiveQuest } from './useActiveQuest.js'

/**
 * The social-quest side of the map, with no UI of its own (the chip is QuestCoopChip):
 *  - draws the other members as pins (the locations themselves are kept by QuestLiveHost, app-wide);
 *  - when my joined stops are over, puts me back on my own plan;
 *  - shows a "Meet here" pin when opened from a quest's meeting point (/map?lat=&lng=&meet=);
 *  - shows co-op stamps as they land ("Mei arrived after you: co-op stamp!").
 * (The quest chat is followed app-wide by QuestChatHost.)
 * Mounted once by the map view and always on, even when the next-stop card is hidden.
 * getMap: () => the MapLibre map, or null before it has loaded.
 */
const props = defineProps({ getMap: { type: Function, required: true } })

const store = useMissionStore()
const party = usePartyStore()
const { joined } = useActiveQuest()
const route = useRoute()

// Hosts: find my open window so "Hosting Lina until …" and the pins work too.
let unwatchCoop = null
onMounted(async () => {
  if (store.mission) party.loadHosted(store.mission).catch(() => {}) // guest mode / offline: nothing to host
  // Co-op stamps can land while I'm elsewhere (my partner stamps after me): show any I missed, then listen.
  party.checkCoop()
  try { unwatchCoop = await social.watchMyCoop(() => party.checkCoop()) } catch { /* guest mode */ }
})
onUnmounted(() => unwatchCoop?.())


// My joined stops are over > back to my own plan
// immediate: also when the map opens after they already ended.
watch(() => joined.value && tick.value >= joined.value.endMs, (over) => { if (over) store.finishEndedQuests() }, { immediate: true })

// Other members as pins (QuestLiveHost keeps party.liveOthers up to date). Not a deep watch:
// the map is a huge object, and walking it every second freezes the page.
const markers = new Map()
watch([() => party.liveOthers, () => props.getMap()], ([others, map]) => {
  if (map) syncMemberMarkers(map, markers, others)
}, { immediate: true })
onUnmounted(() => clearMemberMarkers(markers))

// Meeting point pin (the map view flies there itself)
let meetPin = null
watch([() => props.getMap(), () => route?.query.meet], ([map]) => {
  meetPin?.remove()
  meetPin = null
  const { lat, lng, meet } = route?.query || {}
  if (map && lat && lng && meet) meetPin = meetingMarker(map, { lat: Number(lat), lng: Number(lng), label: meet })
}, { immediate: true })
onUnmounted(() => meetPin?.remove())
</script>

<template>
  <!-- No UI: the chip (QuestCoopChip) shows the quest; this draws pins on the map. -->
</template>

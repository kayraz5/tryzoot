<script setup>
import { onUnmounted, ref, watch } from 'vue'
import { usePartyStore } from '../../../model/stores/party.js'
import { useUserStore } from '../../../model/stores/user.js'
import * as social from '../../../model/services/social.js'
import { tick } from '../../../model/services/clock.js'
import { geo, hasFix, startGps } from '../../../model/services/geo.js'
import { distanceM } from '../../../model/services/travel.js'
import { useActiveQuest } from './useActiveQuest.js'

/**
 * Live locations for the whole app (mounted once in App.vue, next to QuestChatHost):
 * from the moment someone joins until the quest ends, shares my position with the other
 * members and keeps theirs in party.liveOthers, on every page, so I don't fade off their
 * map when I open my plan. The pins themselves are drawn by QuestMapLive on the map.
 */
const party = usePartyStore()
const user = useUserStore()
const { active, live } = useActiveQuest()

const SEND_EVERY_MS = 15000
const DEMO_SEND_EVERY_MS = 2000 // Demo-Walk covers ground fast (up to 20×): send often so the pin glides
const STALE_MS = 2 * 60000

const roster = ref([])
const locations = ref([])
let unwatch = null
let poll = null
let lastSent = { ms: 0, lat: null, lng: null }
let livePartyId = null

async function refreshLocations() {
  if (!livePartyId) return
  try { locations.value = await social.listLocations(livePartyId) } catch { /* offline: keep the last ones */ }
}
async function startLive(id) {
  livePartyId = id
  // Location already allowed (the map asked)? Follow it here too, without a new prompt.
  navigator.permissions?.query({ name: 'geolocation' }).then((p) => p.state === 'granted' && !geo.fake && startGps(), () => {})
  try { roster.value = (await social.getQuest(id))?.roster || [] } catch { roster.value = [] }
  await refreshLocations()
  try { unwatch = await social.watchLocations(id, refreshLocations) } catch { unwatch = null }
  poll = setInterval(refreshLocations, 20000) // in case Realtime drops
  sendMine(true)
}
async function stopLive({ forget = false } = {}) {
  const id = livePartyId
  livePartyId = null
  clearInterval(poll)
  unwatch?.()
  unwatch = null
  locations.value = []
  party.liveOthers = []
  lastSent = { ms: 0, lat: null, lng: null }
  // The window ended or I left: take my dot off the others' maps (leaving already does this server-side).
  if (forget && id) social.stopSharing(id).catch(() => {})
}
watch(() => (live.value ? active.value.id : null), async (id, old) => {
  if (old) await stopLive({ forget: true })
  if (id) await startLive(id)
}, { immediate: true })
onUnmounted(() => stopLive())

// Someone joined or left (or the demo moved people): re-read the roster and locations now.
watch(() => [party.liveRefresh, party.hosted?.roster?.length], async () => {
  if (!livePartyId) return
  try { roster.value = (await social.getQuest(livePartyId))?.roster || roster.value } catch {}
  refreshLocations()
})

function sendMine(force = false) {
  if (!livePartyId || !hasFix()) return
  const moved = lastSent.lat == null ? Infinity : distanceM({ lat: lastSent.lat, lng: lastSent.lng }, geo)
  const every = geo.fake ? DEMO_SEND_EVERY_MS : SEND_EVERY_MS
  if (!force && (Date.now() - lastSent.ms < every || moved < 10)) return
  lastSent = { ms: Date.now(), lat: geo.lat, lng: geo.lng }
  social.shareLocation(livePartyId, { lat: geo.lat, lng: geo.lng, accuracy: geo.accuracy }).catch(() => {})
}
watch(() => [geo.lat, geo.lng], () => sendMine())

// Everyone but me, with names and colours from the roster.
watch([locations, roster, tick], ([list, people]) => {
  party.liveOthers = list
    .filter((l) => l.user_id !== user.userId)
    .map((l) => {
      const p = people.find((r) => r.user_id === l.user_id)
      // updated_at is server time, so compare with the real clock, not the dev clock.
      return { ...l, display_name: p?.display_name, cover_color: p?.cover_color, stale: Date.now() - Date.parse(l.updated_at) > STALE_MS }
    })
})
</script>

<template>
  <!-- No UI: QuestMapLive draws the pins, QuestCoopChip lists the people. -->
</template>

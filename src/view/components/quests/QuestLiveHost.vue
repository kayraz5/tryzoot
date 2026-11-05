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

const SEND_EVERY_MS = 3000 // at walking pace, about one update every 10 m
const DEMO_SEND_EVERY_MS = 2000 // Demo-Walk covers ground fast (up to 20x): send often so the pin glides
const HEARTBEAT_MS = 60000 // standing still: still say "I'm here" so I don't fade to stale
const STALE_MS = 2 * 60000

const roster = ref([])
const locations = ref([])
let unwatch = null
let poll = null
let lastSent = { ms: 0, lat: null, lng: null }
let livePartyId = null

async function refreshLocations() {
  if (!livePartyId) return
  try {
    locations.value = await social.listLocations(livePartyId)
  } catch {
    /* offline: keep the last ones */
  }
}
/**
 * Apply one Realtime change straight to the list, instead of re-reading every location:
 * the pin moves as soon as the change lands, with no extra round trip per update.
 * DELETE events can't be filtered by party server-side, so check the party here.
 */
function applyChange(payload) {
  if (!livePartyId) return
  if (payload?.eventType === 'DELETE') {
    const gone = payload.old
    if (!gone?.user_id || (gone.party_id && gone.party_id !== livePartyId)) return
    locations.value = locations.value.filter((l) => l.user_id !== gone.user_id)
    return
  }
  const row = payload?.new
  if (!row?.user_id || row.party_id !== livePartyId) return refreshLocations()
  const next = { user_id: row.user_id, lat: row.lat, lng: row.lng, updated_at: row.updated_at }
  const known = locations.value.some((l) => l.user_id === row.user_id)
  locations.value = known
    ? locations.value.map((l) => (l.user_id === row.user_id ? next : l))
    : [...locations.value, next]
  // Someone new is sharing: fetch the roster so their pin gets a name and colour.
  if (!roster.value.some((r) => r.user_id === row.user_id)) refreshRoster()
}
async function refreshRoster() {
  if (!livePartyId) return
  try {
    roster.value = (await social.getQuest(livePartyId))?.roster || roster.value
  } catch {
    /* offline: keep the last one */
  }
}
async function startLive(id) {
  livePartyId = id
  // Location already allowed (the map asked)? Follow it here too, without a new prompt.
  navigator.permissions?.query({ name: 'geolocation' }).then(
    (p) => p.state === 'granted' && !geo.fake && startGps(),
    () => {}
  )
  try {
    roster.value = (await social.getQuest(id))?.roster || []
  } catch {
    roster.value = []
  }
  await refreshLocations()
  try {
    unwatch = await social.watchLocations(id, applyChange)
  } catch {
    unwatch = null
  }
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
  lastKey = ''
  lastSent = { ms: 0, lat: null, lng: null }
  // The window ended or I left: take my dot off the others' maps (leaving already does this server-side).
  if (forget && id) social.stopSharing(id).catch(() => {})
}
watch(
  () => (live.value ? active.value.id : null),
  async (id, old) => {
    if (old) await stopLive({ forget: true })
    if (id) await startLive(id)
  },
  { immediate: true }
)
onUnmounted(() => stopLive())

// Someone joined or left (or the demo moved people): re-read the roster and locations now.
watch(
  () => [party.liveRefresh, party.hosted?.roster?.length],
  async () => {
    if (!livePartyId) return
    await refreshRoster()
    refreshLocations()
  }
)

function sendMine(force = false) {
  if (!livePartyId || !hasFix()) return
  const moved =
    lastSent.lat == null ? Infinity : distanceM({ lat: lastSent.lat, lng: lastSent.lng }, geo)
  const every = geo.fake ? DEMO_SEND_EVERY_MS : SEND_EVERY_MS
  const since = Date.now() - lastSent.ms
  if (!force && since < HEARTBEAT_MS && (since < every || moved < 10)) return
  lastSent = { ms: Date.now(), lat: geo.lat, lng: geo.lng }
  social
    .shareLocation(livePartyId, { lat: geo.lat, lng: geo.lng, accuracy: geo.accuracy })
    .catch(() => {})
}
watch(
  () => [geo.lat, geo.lng],
  () => sendMine()
)
// GPS goes quiet when person stand still, so the clock drives the heartbeat.
watch(tick, () => sendMine())

// Everyone but me, with names and colours from the roster. The clock re-checks who is stale,
// but the list is only replaced when something changed, so the map isn't redrawn every second.
let lastKey = ''
watch([locations, roster, tick], ([list, people]) => {
  const others = list
    .filter((l) => l.user_id !== user.userId)
    .map((l) => {
      const p = people.find((r) => r.user_id === l.user_id)
      // updated_at is server time, so compare with the real clock, not the dev clock.
      return {
        ...l,
        display_name: p?.display_name,
        cover_color: p?.cover_color,
        stale: Date.now() - Date.parse(l.updated_at) > STALE_MS
      }
    })
  const key = JSON.stringify(others)
  if (key === lastKey) return
  lastKey = key
  party.liveOthers = others
})
</script>

<template>
  <!-- No UI: QuestMapLive draws the pins, QuestCoopChip lists the people. -->
</template>

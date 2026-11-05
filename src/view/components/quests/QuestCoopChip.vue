<!-- EDITOR: EUDALE -->
<script setup>
import { useRouter } from 'vue-router'
import { usePartyStore } from '../../../model/stores/party.js'
import { useUiStore } from '../../../model/stores/ui.js'
import { formatTime } from '../../../model/services/hours.js'
import { DEV_PANEL } from '../../../model/services/config.js'
import { DEFAULT_COVER, onColor } from '../../../model/services/brand.js'
import { useActiveQuest } from './useActiveQuest.js'

/**
 * One line at the top of the map card while I'm in a social quest:
 * "Meet Mei at Maxwell Food Centre, 13:30", then "With Mei until 15:40"; hosts see "Hosting Lina until 15:40".
 * Tapping it opens my plan. Chat and Go solo are QuestChatButton / QuestGoSolo lower in the card;
 * live locations and the automatic return are QuestMapLive.
 * Below it, one chip per member sharing their location: tap to see them on the map (or everyone).
 */
const party = usePartyStore()
const ui = useUiStore()
const router = useRouter()
const { joined, active, started, live, guestNames } = useActiveQuest()

const initial = (p) => (p.display_name || '?').trim().charAt(0).toUpperCase()
const faceStyle = (p) => ({ background: p.cover_color || DEFAULT_COVER, color: onColor(p.cover_color || DEFAULT_COVER) })

async function demoLocate() {
  try {
    ui.toast(`Demo: ${await party.simulate(active.value.id, 'locate')}.`, 'success')
    party.liveRefresh++
  } catch (err) {
    ui.toast(err.message, 'danger', 5000)
  }
}
</script>

<template>
  <div v-if="active">
    <div class="coop-chip" role="button" tabindex="0" aria-label="Open my plan"
      @click="router.push('/mission')" @keydown.enter="router.push('/mission')">
      <i class="bi bi-people-fill" aria-hidden="true"></i>
      <span class="coop-main flex-grow-1 min-w-0">
        <template v-if="active.role === 'host'">Hosting {{ guestNames.join(', ') }} until {{ formatTime(active.endMs) }}</template>
        <template v-else-if="started">With {{ joined.host_name }} until {{ formatTime(active.endMs) }}</template>
        <template v-else>Meet {{ joined.host_name }} at {{ joined.blocks[0].name }}, {{ formatTime(active.startMs) }}</template>
        <template v-if="party.liveOthers.length"> · {{ party.liveOthers.length }} live</template>
      </span>
      <button v-if="DEV_PANEL && live" type="button" class="coop-btn" title="Demo: put the others on the map" aria-label="Demo: put the others on the map" @click.stop="demoLocate"><i class="bi bi-robot"></i></button>
    </div>
    <div v-if="party.liveOthers.length" class="live-people" aria-label="People on the map">
      <button v-if="party.liveOthers.length > 1" type="button" class="person" @click="party.focusLive()">
        <i class="bi bi-people-fill" aria-hidden="true"></i> Everyone
      </button>
      <button v-for="p in party.liveOthers" :key="p.user_id" type="button" class="person" :class="{ stale: p.stale }"
        :title="p.stale ? `${p.display_name || 'Traveller'}: last seen a few minutes ago` : `Show ${p.display_name || 'Traveller'} on the map`"
        @click="party.focusLive(p.user_id)">
        <span class="face" :style="faceStyle(p)" aria-hidden="true">{{ initial(p) }}</span>{{ p.display_name || 'Traveller' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.coop-chip { cursor: pointer; display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding: 6px 10px; border-radius: 12px; background: var(--zt-pink); color: #111; border: 2px solid #111; }
.coop-main { font-weight: 800; font-size: 0.85rem; line-height: 1.25; }
.coop-btn { flex: none; display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 99px; border: 2px solid #111; background: #fff4c2; color: #111; font-size: 0.75rem; }
.min-w-0 { min-width: 0; }
.live-people { display: flex; gap: 6px; overflow-x: auto; margin: -2px 0 8px; scrollbar-width: none; }
.person { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px 3px 3px; border-radius: 99px; border: 2px solid #111; background: #fff; color: #111; font-weight: 800; font-size: 0.78rem; }
.person:has(.bi) { padding-left: 10px; }
.person .face { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 32%; border: 2px solid #111; font-size: 0.7rem; }
.person.stale { opacity: 0.55; }
/* Phones: the quest chip and the person pills sit above the stop name, so they
   stay quiet. At 0.85rem "Hosting <name> until <time> · N live" wrapped onto a
   second line and became the loudest thing in the card; 0.72rem fits one line. */
@media (max-width: 575.98px) {
  .coop-chip { gap: 6px; margin-bottom: 6px; padding: 4px 8px; border-radius: 10px; }
  .coop-main { font-size: 0.72rem; line-height: 1.2; }
  .coop-btn { width: 24px; height: 24px; font-size: 0.68rem; }
  .live-people { gap: 5px; margin: -1px 0 6px; }
  .person { font-size: 0.7rem; padding: 2px 8px 2px 2px; }
  .person:has(.bi) { padding-left: 8px; }
  .person .face { width: 18px; height: 18px; font-size: 0.62rem; }
}
</style>

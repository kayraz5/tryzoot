<!-- EDITOR: MATTHEW -->
<script setup>
import { computed } from 'vue'
import { placeStampUrl } from '../../../model/services/stampArt.js'
import QuestCoopChip from '../quests/QuestCoopChip.vue'
import QuestChatButton from '../quests/QuestChatButton.vue' // "Chat with Mei" (only while in a social quest)
import QuestGoSolo from '../quests/QuestGoSolo.vue'         // "Go solo" link (only after joining someone's quest)
import TransitSteps from './transit/TransitSteps.vue'               // MRT/bus step-by-step for the current leg

/*
 * Next-stop card ("center console") at the bottom of the map. Presentational only:
 * MapView owns navigation and map state.
 *
 * The close button is the only way to dismiss the card - MapView hides the nav-bar
 * toggle while it is open, so without it there is no route back to the flag button.
 */
const props = defineProps({
  mission: { type: Object, default: null },       // the active mission, or null if none
  next: { type: Object, default: null },           // the stop you're heading to, or null if the quest is done
  stopNumber: { type: String, default: '' },       // e.g. "2/5"
  liveTravel: { type: Object, default: null },     // { mode, minutes, detail }
  distance: { type: Number, default: null },       // metres to `next`
  lateBy: { type: Number, default: null },         // minutes behind plan (negative = early)
  guidance: { type: Object, default: null },       // { icon, text }
  steps: { type: Array, default: () => [] },       // transit steps for this leg (empty when walking/taxi)
  stepIndex: { type: Number, default: 0 },         // which of `steps` the traveller is on
  busAlternative: { type: Object, default: null },         // a bus that replaces a taxi leg, if any
  check: { type: Object, default: null },          // { ok, message } — can you stamp right now?
  stamping: { type: Boolean, default: false },     // a stamp request is in flight
  stampedCount: { type: Number, default: 0 },
  totalVisits: { type: Number, default: 0 },
  modeIcon: { type: Object, required: true },      // { walk, mrt, taxi } -> bootstrap-icon class
  formatDistance: { type: Function, required: true } // metres -> "120 m" / "1.2 km"
})

defineEmits(['plan', 'open-passport', 'stamp', 'change-map-style', 'need-help', 'close'])

const stampArt = computed(() => placeStampUrl(props.next?.name))
</script>

<template>
  <div class="mission-card rounded-4">
    <button type="button" class="card-close" aria-label="Hide next-stop card" @click="$emit('close')">
      <i class="bi bi-x-lg" aria-hidden="true"></i>
    </button>

    <QuestCoopChip class="card-chip" />

    <div v-if="!mission" class="row align-items-center">
      <div class="col-12">
        <div class="stop-meta">No active quest</div>
        <div class="stop-title">Plan a layover first</div>
        <div class="stop-near">Your stops, route and stamps show up here once you build a quest.</div>
        <button class="btn btn-warning btn-sm mt-3" @click="$emit('plan')"><i class="bi bi-magic"></i> Plan a layover</button>
      </div>
    </div>

    <div v-else-if="!next" class="row align-items-center">
      <div class="col-12">
        <div class="stop-meta">Quest complete &middot; {{ stampedCount }}/{{ totalVisits }} stamped</div>
        <div class="stop-title">{{ mission.title }}</div>
        <div class="stop-near">Nice run. Your chops are in the passport.</div>
        <button class="btn btn-warning btn-sm mt-3" @click="$emit('open-passport')"><i class="bi bi-book"></i> Open passport</button>
      </div>
    </div>

    <div v-else class="row align-items-center">
      <div class="col-8">
        <div class="stop-meta">
          <template v-if="next.kind !== 'visit'">Head home &middot; </template>
          <span class="bi" :class="modeIcon[liveTravel?.mode || next.travel_mode]"></span> {{ liveTravel?.minutes ?? next.travel_min }} min
          <template v-if="next.kind === 'visit'"> &middot; Stay {{ next.stay_min }} min</template>
        </div>
        <div class="stop-title">{{ next.name }}</div>
        <div class="stop-dist">
          <template v-if="distance != null">{{ formatDistance(distance) }} &middot; </template>
          <span v-if="lateBy == null" class="muted">locating you…</span>
          <span v-else-if="lateBy > 0" class="behind">{{ lateBy }} min behind plan</span>
          <span v-else class="ontime">on time</span>
        </div>
        <div v-if="guidance && !steps.length" class="stop-guide"><i class="bi" :class="guidance.icon"></i> {{ guidance.text }}</div>
<!-- 'far' reads "868 m away. Get within 80 m", restating the distance above. -->
        <div v-if="check?.code !== 'far'" class="stop-near">{{ check?.message }}</div>
      </div>
      <div class="col-4 d-flex justify-content-end">
        <button class="stamp-btn" :class="{ ready: check?.ok }" :disabled="stamping" @click="$emit('stamp')"
          :aria-label="next.kind === 'return' ? 'Check in back home' : `Stamp ${next.name}`">
          <span class="stamp-circle" :class="{ 'has-art': stampArt }">
            <img v-if="stampArt" :src="stampArt" alt="" class="stamp-art" />
            <i v-else class="bi" :class="next.kind === 'return' ? 'bi-house-check-fill' : 'bi-patch-check-fill'"></i>
          </span>
          <span class="stamp-label">{{ stamping ? '…' : next.kind === 'return' ? "I'm back" : 'Stamp' }}</span>
        </button>
      </div>

      <div v-if="steps.length || busAlternative" class="col-12">
        <TransitSteps :steps="steps" :index="stepIndex" :bus-alternative="busAlternative" />
      </div>

      <div class="col-12">
        <QuestChatButton class="mt-2" />
        <div class="card-links">
          <QuestGoSolo />
          <button type="button" class="card-link card-link--map" @click="$emit('change-map-style')">Map style</button>
          <button type="button" class="card-link card-link--help" @click="$emit('need-help')">Need help?</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Sizes use container queries (cqw), not vw: on a 320-430px phone a vw clamp stays
   pinned to its floor, so the card looked identical on every device. */
.mission-card {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: var(--zt-nav-dock);
  max-width: 600px;
  width: 90%;
  z-index: 1;
  text-align: left;
  background: var(--zt-black);
  border: clamp(2px, 1vw, 4px) solid var(--zt-yellow);
  box-shadow: var(--zt-shadow);
  padding: clamp(12px, 4vw, 18px) clamp(14px, 4.6vw, 20px);
  container-type: inline-size;

/* Declared here but never used here: cqw resolves against the using element's
   container, which for a descendant is this card - an element cannot query itself. */
  --close-size: clamp(34px, 8cqw, 42px);
  --close-inset: clamp(6px, 1.6cqw, 10px);
}

/* Opaque rather than `none`: the stamp dial's top-right arc runs under this corner,
   and a bare glyph sat on the dashed ring and vanished. */
.card-close {
  position: absolute;
  top: var(--close-inset);
  right: var(--close-inset);
  z-index: 2;
  width: var(--close-size);
  height: var(--close-size);
  border-radius: 50%;
  border: none;
  background: var(--zt-black);
  color: var(--zt-yellow-pale);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(0.85rem, 2.8cqw, 1.1rem);
  cursor: pointer;
}
/* Dimmed on the glyph, not the button, so the disc stays fully opaque. */
.card-close .bi { opacity: 0.7; }
.card-close:hover .bi,
.card-close:active .bi { opacity: 1; }

.card-chip { margin-right: calc(var(--close-size) + var(--close-inset)); }

.stop-meta {
  color: var(--zt-yellow-pale);
  opacity: 0.7;
  font-size: clamp(0.65rem, 3.5cqw, 0.9rem);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stop-title {
  color: var(--zt-yellow-pale);
  font-size: clamp(1.15rem, 6.1cqw, 1.6rem);
  font-weight: 800;
  margin: 2px 0;
}

.stop-dist {
  font-size: clamp(0.75rem, 4cqw, 1.05rem);
  color: var(--zt-yellow-pale);
}

.stop-dist .behind {
  color: var(--zt-orange);
  font-weight: 700;
}

.stop-dist .ontime { color: #5fd38d; font-weight: 700; }
.stop-dist .muted { opacity: 0.7; }

.stop-near {
  font-size: clamp(0.7rem, 3.7cqw, 1rem);
  color: var(--zt-yellow-pale);
  opacity: 0.7;
  margin-top: 6px;
}

.stop-guide {
  margin-top: 6px;
  color: var(--zt-yellow);
  font-size: clamp(0.78rem, 4.2cqw, 1.1rem);
  font-weight: 700;
}
.stop-guide .bi { margin-right: 4px; }

.stamp-btn {
  width: clamp(72px, 24cqw, 100px);
  height: clamp(72px, 24cqw, 100px);
  border-radius: 50%;
  border: clamp(2px, 1vw, 4px) solid var(--zt-yellow);
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
}

.stamp-btn:disabled { cursor: wait; }
.stamp-btn:not(.ready) { opacity: 0.55; border-style: dashed; }
.stamp-btn.ready { background: var(--zt-yellow); animation: stamp-ready 1.4s infinite; }
.stamp-btn.ready .stamp-label { color: var(--zt-black); }
.stamp-btn.ready .stamp-circle { background: var(--zt-black); color: var(--zt-yellow); }
@keyframes stamp-ready { 0% { box-shadow: 0 0 0 0 rgba(255, 204, 0, 0.7); } 70%, 100% { box-shadow: 0 0 0 18px rgba(255, 204, 0, 0); } }

.stamp-circle {
  width: clamp(32px, 10cqw, 42px);
  height: clamp(32px, 10cqw, 42px);
  border-radius: 50%;
  background: var(--zt-yellow-pale);
  color: var(--zt-black);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(16px, 4.8cqw, 20px);
}

.stamp-circle.has-art,
.stamp-btn.ready .stamp-circle.has-art { background: transparent; }
.stamp-circle .stamp-art { width: 100%; height: 100%; object-fit: contain; }

.stamp-label {
  color: var(--zt-yellow-pale);
  font-size: clamp(0.6rem, 3.2cqw, 0.85rem);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.card-links {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}
.card-link {
  padding: 0;
  border: 0;
  background: none;
  font-weight: 800;
  font-size: 0.85rem;
  text-decoration: underline;
  text-underline-offset: 3px;
  white-space: nowrap;
}
.card-link--map { color: var(--zt-yellow-pale); opacity: 0.7; }
.card-link--help { color: #ff6b6b; }

/* Phones: three type levels only - title 0.95, body 0.72, supporting 0.66. */
@media (max-width: 575.98px) {
  .mission-card { padding: 9px 11px; }
  .stop-title { font-size: 0.95rem; margin: 0; line-height: 1.15; }
  .stop-meta { font-size: 0.58rem; }
  .stop-dist, .stop-guide { font-size: 0.72rem; }
  .stop-guide, .stop-near { margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .stop-near { font-size: 0.66rem; }
/* The stamp is the card's one call to action, so it keeps its size. */
  .stamp-btn { width: 64px; height: 64px; gap: 2px; }
  .stamp-circle { width: 28px; height: 28px; font-size: 15px; }
  .stamp-label { font-size: 0.58rem; }
  .card-links { margin-top: 6px; }
  .card-link { font-size: 0.72rem; }
}
</style>

<!-- EDITOR: MATTHEW -->
<script setup>
import { computed, ref } from 'vue'
import { placeStampUrl } from '../../../model/services/stampArt.js'
import QuestCoopChip from '../quests/QuestCoopChip.vue'
import QuestChatButton from '../quests/QuestChatButton.vue' // "Chat with Mei" (only while in a social quest)
import QuestGoSolo from '../quests/QuestGoSolo.vue'         // "Go solo" link (only after joining someone's quest)
import TransportToggle from './TransportToggle.vue'                 // Public transport | Car (re-times + reroutes)
import TransitSteps from './transit/TransitSteps.vue'               // MRT/bus step-by-step for the current leg

/*
 * Next-stop card ("center console") at the bottom of the map. Presentational only:
 * MapView owns navigation and map state.
 *
 * Reading order matches the journey: who you're heading to (header), the numbers
 * (stats), what to do right now (the yellow "now" block), then the controls.
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

/* The step panels are opened from the bottom row, next to the transport toggle,
   so the card owns their state and TransitSteps just renders what is open. */
const showAllSteps = ref(false)
const showTips = ref(false)
const stepsOpen = computed(() => showAllSteps.value || showTips.value)
const hasSteps = computed(() => props.steps.length > 0)
const usesTransit = computed(() => props.steps.some((x) => x.mode !== 'walk'))
const toggleAllSteps = () => { showAllSteps.value = !showAllSteps.value; showTips.value = false }
const toggleTips = () => { showTips.value = !showTips.value; showAllSteps.value = false }

/*
 * Travel / Distance / Stay are reference numbers, not something you act on, so
 * they stay folded away by default and the map keeps the room. The choice is
 * remembered, like the card's own open/closed state in MapView.
 */
const STATS_KEY = 'zoot.mapCardStats'
const showStats = ref(readStatsFlag())
function readStatsFlag() {
  try { return localStorage.getItem(STATS_KEY) === '1' } catch { return false }
}
function toggleStats() {
  showStats.value = !showStats.value
  try { localStorage.setItem(STATS_KEY, showStats.value ? '1' : '0') } catch { /* just won't persist */ }
}
const travelMin = computed(() => props.liveTravel?.minutes ?? props.next?.travel_min ?? null)
const isVisit = computed(() => props.next?.kind === 'visit')

/** The pill on the right of the stats row: behind, on time, or still locating. */
const planStatus = computed(() => {
  if (props.lateBy == null) return { tone: 'wait', text: 'locating you…' }
  if (props.lateBy > 0) return { tone: 'behind', text: `${props.lateBy} min behind plan` }
  return { tone: 'ontime', text: 'on time' }
})

/* Value over label, as in the design. `say` is what a screen reader hears: the two
   halves are split for layout, so each stat also carries them as one phrase. */
const stats = computed(() => [
  { label: 'Travel', value: travelMin.value != null ? `${travelMin.value} min` : '—' },
  { label: 'Distance', value: props.distance != null ? props.formatDistance(props.distance) : '—' },
  isVisit.value
    ? { label: 'Stay', value: `${props.next.stay_min} min` }
    : { label: 'Heading back', value: 'Home', say: 'Heading back home' }
])

// 'far' reads "868 m away. Get within 80 m", restating the Distance stat above it.
const checkNote = computed(() => (props.check?.code !== 'far' ? props.check?.message : ''))

const statsLabel = computed(() => {
  if (showStats.value) return 'Hide trip numbers'
  // Folded away, the button still has to say what it is hiding.
  return `Show trip numbers: ${stats.value.map((x) => x.say || `${x.label} ${x.value}`).join(', ')}`
})
</script>

<template>
  <div class="mission-card" :class="{ 'is-expanded': stepsOpen }">
    <div v-if="!mission" class="empty">
      <div class="eyebrow">No active quest</div>
      <h2 class="empty-title">Plan a layover first</h2>
      <p class="empty-note">Your stops, route and stamps show up here once you build a quest.</p>
      <button type="button" class="pill pill--go" @click="$emit('plan')"><i class="bi bi-magic"></i> Plan a layover</button>
      <button type="button" class="head-btn card-close" aria-label="Hide next-stop card" @click="$emit('close')">
        <i class="bi bi-x-lg" aria-hidden="true"></i>
      </button>
    </div>

    <div v-else-if="!next" class="empty">
      <div class="eyebrow">Quest complete &middot; {{ stampedCount }}/{{ totalVisits }} stamped</div>
      <h2 class="empty-title">{{ mission.title }}</h2>
      <p class="empty-note">Nice run. Your chops are in the passport.</p>
      <button type="button" class="pill pill--go" @click="$emit('open-passport')"><i class="bi bi-book"></i> Open passport</button>
      <button type="button" class="head-btn card-close" aria-label="Hide next-stop card" @click="$emit('close')">
        <i class="bi bi-x-lg" aria-hidden="true"></i>
      </button>
    </div>

    <template v-else>
      <header class="card-head">
        <!-- The stamp is still the card's one call to action: dashed while you're too
             far, filled yellow and pulsing the moment you're in range. -->
        <button type="button" class="stamp-btn" :class="{ ready: check?.ok }" :disabled="stamping" @click="$emit('stamp')"
          :aria-label="next.kind === 'return' ? 'Check in back home' : `Stamp ${next.name}`">
          <img v-if="stampArt" :src="stampArt" alt="" class="stamp-art" />
          <i v-else class="bi" :class="next.kind === 'return' ? 'bi-house-check-fill' : 'bi-patch-check-fill'"></i>
        </button>

        <h2 class="head-title">{{ next.name }}</h2>

        <div class="head-actions">
          <button type="button" class="head-btn stats-toggle" :class="{ on: showStats, [planStatus.tone]: !showStats }"
            :aria-expanded="showStats" aria-controls="zt-card-stats" :aria-label="statsLabel" :title="statsLabel"
            @click="toggleStats">
            <i class="bi" :class="showStats ? 'bi-chevron-up' : 'bi-sliders2'" aria-hidden="true"></i>
            <!-- Behind plan is the one number worth seeing without opening the strip. -->
            <span v-if="!showStats && planStatus.tone === 'behind'" class="warn-dot" aria-hidden="true"></span>
          </button>

          <button type="button" class="head-btn" aria-label="Map style" title="Map style" @click="$emit('change-map-style')">
            <i class="bi bi-layers-fill" aria-hidden="true"></i>
          </button>

          <button type="button" class="head-btn head-btn--help" aria-label="Need help?" title="Need help?" @click="$emit('need-help')">
            <i class="bi bi-question-lg" aria-hidden="true"></i>
          </button>

          <button type="button" class="head-btn card-close" aria-label="Hide next-stop card" @click="$emit('close')">
            <i class="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </div>
      </header>

      <QuestCoopChip class="card-chip" />

      <div v-if="showStats" id="zt-card-stats" class="stats">
        <div v-for="s in stats" :key="s.label" class="stat">
          <b aria-hidden="true">{{ s.value }}</b>
          <span aria-hidden="true">{{ s.label }}</span>
          <span class="visually-hidden">{{ s.say || `${s.label} ${s.value}` }}</span>
        </div>
        <div class="plan-pill" :class="planStatus.tone"><span class="dot" aria-hidden="true"></span>{{ planStatus.text }}</div>
      </div>

      <p v-if="checkNote" class="check-note">{{ checkNote }}</p>

      <TransitSteps :steps="steps" :index="stepIndex" :bus-alternative="busAlternative"
        :fallback="guidance" :fallback-minutes="travelMin" :fallback-mode="liveTravel?.mode || next.travel_mode"
        :mode-icon="modeIcon" :show-all="showAllSteps" :show-tips="showTips" />

      <QuestChatButton class="chat-btn" />

      <div class="card-actions">
        <TransportToggle />
        <div class="action-links">
          <button v-if="hasSteps" type="button" class="link" :aria-expanded="showAllSteps" @click="toggleAllSteps">
            {{ showAllSteps ? 'Hide steps' : `All ${steps.length} steps` }}
          </button>
          <!-- The full phrase does not fit beside the transport toggle on a phone, so a
               short form takes over there. The accessible name stays the full one. -->
          <button v-if="usesTransit" type="button" class="link link--tips" :aria-expanded="showTips"
            aria-label="First time on public transport?" title="First time on public transport?" @click="toggleTips">
            <span class="tips-full" aria-hidden="true">First time on public transport?</span>
            <span class="tips-short" aria-hidden="true">First time?</span>
          </button>
          <QuestGoSolo />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Sizes use container queries (cqi), not vw: on a 320-430px phone a vw clamp stays
   pinned to its floor, so the card looked identical on every device. */
.mission-card {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: var(--zt-nav-dock);
  max-width: 600px;
  width: 92%;
  z-index: 1;
  text-align: left;
  background: #0d0d0d;
  border: 1px solid rgba(255, 244, 194, 0.14);
  border-radius: clamp(18px, 5cqi, 26px);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.55);
  padding: var(--pad);
  container-type: inline-size;
  display: grid;
  /* minmax(0,...) not the default `auto`: an auto track floors at the widest
     child's min-content, so one long un-wrappable line (a bus name in the NEXT
     row) would force the whole card wider than the phone. */
  grid-template-columns: minmax(0, 1fr);
  gap: var(--gap);

  /* This card is a HUD sitting on the map, so it must never take the view. The
     cap is the hard rule; --s below shrinks the content so it rarely has to use
     it. svh (not vh) is the viewport at its shortest, with the browser chrome
     showing, which is when the card is most at risk of swallowing the map. */
  max-height: 48vh;
  max-height: min(48svh, 560px);
  overflow-y: auto;
  overscroll-behavior: contain;
  transition: max-height 0.18s ease-out;

  /* One scale for every size in the card and its children (custom properties
     inherit, so TransitSteps and TransportToggle read these too).

     Two independent axes, multiplied: --sh for how short the screen is, --sw for
     how wide the card itself got (at 600px the cqi type is physically large, so
     a desktop card is much taller than a phone one). max(...) floors every step
     so shrinking to fit can never make text unreadable or a tap target too small. */
  --sh: 1;
  --sw: 1;
  --s: calc(var(--sh) * var(--sw));
  --t-xs: max(0.56rem, calc(clamp(0.58rem, 2.7cqi, 0.8rem) * var(--s)));   /* eyebrows, stat labels */
  --t-sm: max(0.62rem, calc(clamp(0.66rem, 3.1cqi, 0.95rem) * var(--s)));  /* detail text, buttons */
  --t-md: max(0.72rem, calc(clamp(0.8rem, 3.8cqi, 1.15rem) * var(--s)));   /* next-step title */
  --t-lg: max(0.8rem, calc(clamp(0.92rem, 4.8cqi, 1.5rem) * var(--s)));    /* now-step title */
  --t-xl: max(0.86rem, calc(clamp(1rem, 5.4cqi, 1.75rem) * var(--s)));     /* the stop name */
  --t-stat: max(0.72rem, calc(clamp(0.82rem, 4.2cqi, 1.3rem) * var(--s))); /* stat values */
  --t-big: max(0.9rem, calc(clamp(1rem, 5.6cqi, 1.85rem) * var(--s)));     /* the big duration */
  --pad: max(8px, calc(clamp(10px, 3cqi, 18px) * var(--s)));
  --gap: max(5px, calc(clamp(7px, 2.2cqi, 12px) * var(--s)));
  --pad-sm: max(6px, calc(clamp(8px, 2.6cqi, 14px) * var(--s)));
  --radius: max(10px, calc(clamp(12px, 3.4cqi, 18px) * var(--s)));
  --badge: max(26px, calc(clamp(30px, 9cqi, 48px) * var(--s)));
  --stamp: max(38px, calc(clamp(44px, 13cqi, 68px) * var(--s)));
  --close: max(32px, calc(clamp(30px, 8.4cqi, 44px) * var(--s))); /* stays a tap target */
}

/* Opening "All steps" or the tips is an explicit ask for more, so the card may
   take more of the screen until it is closed again. */
.mission-card.is-expanded {
  max-height: 74vh;
  max-height: min(74svh, 760px);
}

/* Short screens shrink the card rather than letting it climb the map. Ordered
   tallest-first so the narrowest matching step wins. */
@media (max-height: 960px) { .mission-card { --sh: 0.92; } }
@media (max-height: 780px) { .mission-card { --sh: 0.86; } }
@media (max-height: 690px) { .mission-card { --sh: 0.8; } }
@media (max-height: 600px) { .mission-card { --sh: 0.74; } }
/* Wide viewports: the card is at its 600px cap, where the width-driven type is
   at its largest and the card is tallest in absolute terms. */
@media (min-width: 992px) { .mission-card { --sw: 0.9; } }

/* ---- header: stamp, name, close ---- */
.card-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--gap);
}

/* Map style and Need help? live here as icons rather than as pills in the bottom
   row: they are occasional, and two labelled buttons took a whole band of map. */
.head-actions { display: flex; align-items: center; gap: calc(var(--gap) * 0.5); }

.head-title {
  margin: 0;
  color: var(--zt-yellow-pale);
  font-family: var(--bs-body-font-family);
  font-weight: 800;
  line-height: 1.12;
  font-size: var(--t-xl);
  overflow-wrap: anywhere;
}

.head-btn {
  position: relative;
  width: var(--close);
  height: var(--close);
  border-radius: 50%;
  border: 1px solid rgba(255, 244, 194, 0.22);
  background: transparent;
  color: var(--zt-yellow-pale);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--t-sm);
  cursor: pointer;
  flex: none;
}
.head-btn .bi { opacity: 0.75; }
.head-btn:hover .bi, .head-btn:active .bi { opacity: 1; }
.stats-toggle.on { background: rgba(255, 244, 194, 0.12); border-color: rgba(255, 244, 194, 0.4); }
.stats-toggle.on .bi { opacity: 1; }
.head-btn--help { border-color: rgba(255, 107, 107, 0.5); color: #ff6b6b; }
.head-btn--help .bi { opacity: 0.9; }

/* Collapsed and behind plan: a dot on the button instead of the whole strip. */
.warn-dot {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #ff7a3d;
  border: 2px solid #0d0d0d;
}

/* Dashed until you're in range, then solid yellow and pulsing. */
.stamp-btn {
  width: var(--stamp);
  height: var(--stamp);
  flex: none;
  border-radius: 50%;
  border: 2px dashed var(--zt-yellow);
  background: transparent;
  color: var(--zt-yellow);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(var(--pad) * 0.42);
  font-size: var(--t-lg);
  cursor: pointer;
}
.stamp-btn:disabled { cursor: wait; }
.stamp-btn.ready {
  border-style: solid;
  background: var(--zt-yellow);
  color: var(--zt-black);
  animation: stamp-ready 1.4s infinite;
}
@keyframes stamp-ready {
  0% { box-shadow: 0 0 0 0 rgba(255, 204, 0, 0.7); }
  70%, 100% { box-shadow: 0 0 0 14px rgba(255, 204, 0, 0); }
}
.stamp-art { width: 100%; height: 100%; object-fit: contain; }

.card-chip { align-self: start; }

/* ---- stats strip ---- */
.stats {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: calc(var(--gap) * 0.8);
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--radius);
  padding: var(--pad-sm) var(--pad);
}

.stat {
  flex: 1 1 auto;
  min-width: 0;
}
.stat + .stat {
  padding-left: var(--gap);
  border-left: 1px solid rgba(255, 244, 194, 0.16);
}
.stat b {
  display: block;
  color: var(--zt-yellow-pale);
  font-weight: 800;
  line-height: 1.1;
  font-size: var(--t-stat);
  white-space: nowrap;
}
.stat span {
  display: block;
  color: var(--zt-yellow-pale);
  opacity: 0.6;
  font-weight: 600;
  font-size: var(--t-xs);
  white-space: nowrap;
}

.plan-pill {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: 99px;
  padding: calc(var(--pad-sm) * 0.7) var(--pad);
  font-weight: 800;
  white-space: nowrap;
  font-size: var(--t-sm);
}
.plan-pill .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex: none; }
.plan-pill.behind { background: rgba(255, 77, 0, 0.18); color: #ff7a3d; }
.plan-pill.ontime { background: rgba(95, 211, 141, 0.16); color: #5fd38d; }
.plan-pill.wait { background: rgba(255, 244, 194, 0.1); color: var(--zt-yellow-pale); opacity: 0.75; }

.check-note {
  margin: 0;
  color: var(--zt-yellow-pale);
  opacity: 0.68;
  font-size: var(--t-sm);
  line-height: 1.3;
}

.chat-btn { display: block; }

/* ---- bottom controls ---- */
.card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap;
  gap: var(--gap);
}
.action-links {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: calc(var(--gap) * 1.4);
  flex-wrap: nowrap;
  min-width: 0;
}

/* Small underlined text, like the old card: secondary to the step itself. The
   vertical padding keeps a tappable height without the visual bulk. */
.link {
  padding: 4px 0;
  border: 0;
  background: none;
  color: var(--zt-yellow-pale);
  opacity: 0.8;
  font-weight: 800;
  font-size: var(--t-sm);
  text-align: left;
  text-decoration: underline;
  text-underline-offset: 3px;
  white-space: nowrap;
  cursor: pointer;
  flex: 0 0 auto;
}
/* The one that gives way when the row is tight; the ellipsis is only a backstop,
   the short label below is what normally does the work. */
.link--tips { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.tips-short { display: none; }
@container (max-width: 430px) {
  .tips-full { display: none; }
  .tips-short { display: inline; }
}
.link:hover,
.link[aria-expanded='true'] { opacity: 1; color: var(--zt-yellow); }

/* One pill recipe for every button on the card, so they line up at any width. */
.pill {
  border: 1px solid transparent;
  border-radius: 99px;
  padding: calc(var(--pad-sm) * 0.8) calc(var(--pad) * 1.15);
  font-weight: 800;
  font-size: var(--t-sm);
  white-space: nowrap;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.06);
  color: var(--zt-yellow-pale);
}
.pill--go { background: var(--zt-yellow); color: var(--zt-black); justify-self: start; }

/* ---- empty / finished states ---- */
.empty { position: relative; padding-right: calc(var(--close) + var(--gap)); display: grid; gap: 4px; justify-items: start; }
.empty .head-btn { position: absolute; top: 0; right: 0; }
.eyebrow {
  color: var(--zt-yellow-pale);
  opacity: 0.65;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: var(--t-xs);
}
.empty-title {
  margin: 0;
  color: var(--zt-yellow-pale);
  font-family: var(--bs-body-font-family);
  font-weight: 800;
  font-size: var(--t-xl);
}
.empty-note { margin: 0; color: var(--zt-yellow-pale); opacity: 0.7; font-size: var(--t-sm); }
.empty .pill--go { margin-top: 6px; }

/* Phones: the map matters more than the card, so everything tightens a notch.
   Container queries already scale type; this trims the boxes around it. */
@media (max-width: 575.98px) {
  .mission-card { width: 94%; border-radius: 16px; }
  .check-note { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
}
</style>

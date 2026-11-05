<!-- EDITOR: KAYRA -->
<script setup>
import { computed } from 'vue'

/**
 * Step-by-step directions inside the next-stop card, for travellers who have never used
 * Singapore's trains or buses: the step you're on, what comes next, every step on tap,
 * and a short "how it works" for first-timers.
 *
 * Walking and taxi legs have no transit steps, so the same block falls back to the
 * map's one-line guidance - the card keeps its shape whatever the leg is.
 */
const props = defineProps({
  steps: { type: Array, default: () => [] },  // transitSteps(): { icon, colour, badge, title, detail, mode, minutes }
  index: { type: Number, default: 0 },        // the step the traveller is on
  busAlternative: { type: Object, default: null },    // { service, stop, minutes } when a taxi leg has a bus option
  fallback: { type: Object, default: null },          // { icon, text } shown when there are no transit steps
  fallbackMinutes: { type: Number, default: null },   // whole-leg travel time, for that same case
  fallbackMode: { type: String, default: 'walk' },
  modeIcon: { type: Object, default: () => ({}) },
  // Which panel is open. The card owns this, because its triggers sit down in the
  // bottom row next to the transport toggle rather than inside this block.
  showAll: { type: Boolean, default: false },
  showTips: { type: Boolean, default: false }
})

const MODE_LABEL = { walk: 'on foot', mrt: 'by train', bus: 'by bus', taxi: 'by car' }
const WALK_PINK = '#ff1dce'

const current = computed(() => props.steps[props.index])
const upNext = computed(() => props.steps[props.index + 1])

/** transitSteps() appends "· 4 min" to walking titles; the minutes get their own column here. */
const titleOf = (step) => step.title.replace(/\s*·\s*\d+\s*min$/, '')
const labelOf = (mode) => MODE_LABEL[mode] || ''

// What the "now" block shows: a real transit step, or the plain guidance line.
const now = computed(() => {
  if (current.value) {
    return {
      colour: current.value.colour,
      icon: current.value.icon,
      badge: current.value.badge,
      title: titleOf(current.value),
      detail: current.value.detail,
      minutes: current.value.minutes,
      label: labelOf(current.value.mode)
    }
  }
  if (!props.fallback) return null
  return {
    colour: WALK_PINK,
    icon: props.fallback.icon || props.modeIcon[props.fallbackMode],
    badge: '',
    title: props.fallback.text,
    detail: '',
    minutes: props.fallbackMinutes,
    label: labelOf(props.fallbackMode)
  }
})
</script>

<template>
  <div v-if="now" class="transit">
    <div class="now-card">
      <div class="now-grid">
        <span class="eyebrow now-label">Now</span>

        <span class="mode-badge" :style="{ background: now.colour }">
          <template v-if="now.badge">{{ now.badge }}</template>
          <i v-else class="bi" :class="now.icon" aria-hidden="true"></i>
        </span>

        <div class="now-title">{{ now.title }}</div>
        <div v-if="now.detail" class="now-detail">{{ now.detail }}</div>

        <div v-if="now.minutes != null" class="now-time">
          <b>{{ now.minutes }} min</b>
          <span v-if="now.label">{{ now.label }}</span>
        </div>
      </div>

      <div v-if="upNext && !showAll" class="next-row">
        <span class="eyebrow">Next</span>
        <span class="mode-badge sm" :style="{ background: upNext.colour }">
          <template v-if="upNext.badge">{{ upNext.badge }}</template>
          <i v-else class="bi" :class="upNext.icon" aria-hidden="true"></i>
        </span>
        <span class="next-title">{{ titleOf(upNext) }}</span>
      </div>

      <ol v-if="showAll" class="all">
        <li v-for="(s, i) in steps" :key="i" class="step" :class="{ done: i < index, now: i === index }">
          <span class="mode-badge sm" :style="{ background: s.colour }">
            <template v-if="s.badge">{{ s.badge }}</template>
            <i v-else class="bi" :class="s.icon" aria-hidden="true"></i>
          </span>
          <div class="min-w-0">
            <div class="step-title">{{ s.title }}</div>
            <div v-if="s.detail" class="step-detail">{{ s.detail }}</div>
          </div>
        </li>
      </ol>
    </div>

    <div v-if="busAlternative && !current" class="bus-alt">
      <i class="bi bi-bus-front-fill"></i> Or take bus {{ busAlternative.service }} from {{ busAlternative.stop }} · about {{ busAlternative.minutes }} min
    </div>

    <ul v-if="showTips" class="tips">
      <li><b>Paying:</b> tap a contactless Visa or Mastercard (or your phone) on the gate or the bus reader. No ticket needed. Use the same card all day.</li>
      <li><b>Tap out too:</b> at the station gate, and on the bus reader at the back door when you get off.</li>
      <li><b>Which platform:</b> follow the line colour, then the sign with the end station ("towards …").</li>
      <li><b>On the bus:</b> board at the front, press the red bell before your stop.</li>
      <li><b>Hours:</b> trains and most buses run about 5:30 am to midnight, every few minutes.</li>
      <li><b>Rules:</b> no eating or drinking on trains or in stations. Fines are real.</li>
    </ul>
  </div>

  <div v-else-if="busAlternative" class="transit">
    <div class="bus-alt">
      <i class="bi bi-bus-front-fill"></i> Or take bus {{ busAlternative.service }} from {{ busAlternative.stop }} · about {{ busAlternative.minutes }} min
    </div>
  </div>
</template>

<style scoped>
/* cqi resolves against .mission-card, which declares container-type. */
.transit { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--gap); color: var(--zt-yellow-pale); }

/* The one thing to do right now, so it carries the card's only yellow outline. */
.now-card {
  border: 2px solid var(--zt-yellow);
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.03);
  padding: var(--pad);
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--gap);
}

.eyebrow {
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: var(--t-xs);
  opacity: 0.7;
}

/* NOW sits above the title, the badge beside it, the time in its own ruled column. */
.now-grid {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  column-gap: var(--gap);
  row-gap: 2px;
  align-items: start;
}
.now-label { grid-column: 2; grid-row: 1; color: var(--zt-yellow); opacity: 1; }
.mode-badge { grid-column: 1; grid-row: 2 / span 2; align-self: start; }
.now-title { grid-column: 2; grid-row: 2; }
.now-detail { grid-column: 2; grid-row: 3; }
.now-time { grid-column: 3; grid-row: 1 / span 3; align-self: center; }

.mode-badge {
  min-width: var(--badge);
  height: var(--badge);
  padding: 0 calc(var(--pad) * 0.4);
  border-radius: calc(var(--radius) * 0.62);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 900;
  font-size: var(--t-sm);
  flex: none;
}
.mode-badge.sm {
  min-width: calc(var(--badge) * 0.78);
  height: calc(var(--badge) * 0.78);
  border-radius: calc(var(--radius) * 0.48);
  font-size: var(--t-xs);
}

.now-title {
  color: var(--zt-yellow-pale);
  font-weight: 800;
  line-height: 1.15;
  font-size: var(--t-lg);
  overflow-wrap: anywhere;
}
.now-detail {
  opacity: 0.72;
  line-height: 1.3;
  margin-top: 3px;
  font-size: var(--t-sm);
}

.now-time {
  text-align: center;
  padding-left: var(--pad);
  border-left: 1px solid rgba(255, 244, 194, 0.18);
}
.now-time b {
  display: block;
  color: var(--zt-yellow);
  font-weight: 800;
  line-height: 1.05;
  font-size: var(--t-big);
  white-space: nowrap;
}
.now-time span {
  display: block;
  opacity: 0.65;
  font-weight: 600;
  white-space: nowrap;
  font-size: var(--t-xs);
}

.next-row {
  display: flex;
  align-items: center;
  gap: var(--gap);
  padding-top: var(--gap);
  border-top: 1px solid rgba(255, 244, 194, 0.14);
}
.next-row .mode-badge { background: rgba(255, 255, 255, 0.1) !important; }
.next-title {
  min-width: 0;
  color: var(--zt-yellow-pale);
  font-weight: 800;
  font-size: var(--t-md);
  overflow-wrap: anywhere;
}

/* The full list replaces the "next" row rather than stacking under it. */
.all {
  list-style: none;
  padding: var(--gap) 0 0;
  margin: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: calc(var(--gap) * 0.8);
  border-top: 1px solid rgba(255, 244, 194, 0.14);
  /* The expanded list scrolls, not the card, so the transport toggle and the
     Map style / Need help? buttons never scroll out from under your thumb. */
  max-height: clamp(76px, 15svh, 230px);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.step { display: flex; gap: var(--gap); align-items: flex-start; }
.min-w-0 { min-width: 0; }
.step-title {
  font-weight: 800;
  line-height: 1.22;
  font-size: var(--t-sm);
  color: var(--zt-yellow-pale);
}
.step-detail { font-size: var(--t-xs); opacity: 0.75; line-height: 1.3; margin-top: 1px; }
.all .now .step-title { color: var(--zt-yellow); }
.all .done { opacity: 0.45; }

.bus-alt { font-size: var(--t-sm); opacity: 0.78; }

.tips {
  margin: 0;
  padding: var(--pad-sm) var(--pad) var(--pad-sm) calc(var(--pad) * 1.9);
  border-radius: var(--radius);
  background: rgba(255, 244, 194, 0.08);
  font-size: var(--t-xs);
  line-height: 1.4;
  display: grid;
  gap: 4px;
  max-height: clamp(76px, 15svh, 230px);
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* Phones: the step block is the tallest thing in the card, so it tightens most, and
   the full list is capped shorter so opening it scrolls instead of eating the map. */
@media (max-width: 575.98px) {
  .now-detail { margin-top: 1px; }
  .next-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
}
</style>

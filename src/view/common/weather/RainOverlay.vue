<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useUiStore } from '../../../model/stores/ui.js'
import { rainLevel } from '../../../model/services/weather.js'

const DEV_RAIN_MM = 10;
const MAX_DROPS = 220;

const LOOK = {
  light: { drops: 35, speed: 1.4, opacityScale: 0.7 },
  moderate: { drops: 100, speed: 1, opacityScale: 1 },
  heavy: { drops: 220, speed: 0.6, opacityScale: 1.2 }
}
const RAIN_PAGES = ['map']

const ui = useUiStore();
const route = useRoute();
const onRainPage = computed(() => RAIN_PAGES.includes(route.name));

const level = computed(() => rainLevel(ui.forceRain ? DEV_RAIN_MM : (ui.weather?.current?.mm ?? 0)));
const isRaining = computed(() => onRainPage.value && level.value !== 'dry');

const allDrops = Array.from({ length: MAX_DROPS }, () => {
  return {
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 0.6 + Math.random() * 0.6,
    opacity: 0.3 + Math.random() * 0.4
  };
})

const drops = computed(() => {
  const look = LOOK[level.value] ?? LOOK.moderate
  return allDrops.slice(0, look.drops).map((d) => ({
    left: d.left,
    delay: d.delay,
    duration: d.duration * look.speed,
    opacity: Math.min(d.opacity * look.opacityScale, 1)
  }))
})
</script>

<template>
  <div v-if="isRaining" class="rain" :class="`rain-${level}`" aria-hidden="true">
    <span
      v-for="(drop, i) in drops"
      :key="i"
      class="drop"
      :style="{
        left: drop.left + '%',
        animationDelay: drop.delay + 's',
        animationDuration: drop.duration + 's',
        opacity: drop.opacity
      }"
    ></span>
  </div>
</template>

<style scoped>
.rain {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 50;
}

.drop {
  position: absolute;
  top: -20px;
  width: 4px;
  height: 20px;
  background: linear-gradient(to bottom, transparent, #8ecbff);
  animation-name: fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

.rain-light .drop {
  width: 2px;
  height: 12px;
}
.rain-heavy .drop {
  width: 5px;
  height: 32px;
}

@keyframes fall {
  to {
    transform: translateY(110vh);
  }
}

@media (prefers-reduced-motion: reduce) {
  .rain {
    display: none;
  }
}
</style>

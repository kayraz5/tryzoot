<script setup>
import { computed } from 'vue'
import { useUiStore } from '../../../model/stores/ui.js'
import { describeCode, describePsi, rainLevel, RAIN_LEVELS } from '../../../model/services/weather.js'
import { tick } from '../../../model/services/clock.js'
import { CITY } from '../../../model/services/config.js'

const ONE_HOUR_MS = 60 * 60 * 1000;
const DEV_RAIN_CHANCE = 90;
const DEV_RAIN_MM = 10;
const MASK_ABOVE_PSI = 100;
const RAINY_ICON = /rain|drizzle/
const NIGHT_ICON = { 'bi-sun': 'bi-moon-stars', 'bi-cloud-sun': 'bi-cloud-moon' }

const ui = useUiStore()

const haze = computed(() => {
    if (!ui.shownHaze) return null
    const psi = ui.shownHaze.psi
    return { psi, mask: psi > MASK_ABOVE_PSI, ...describePsi(psi) }
})
const lightningNearby = computed(() => ui.shownLightning?.nearby === true)

const currentHour = computed(() => {
    const hours = ui.weather?.hours;
    if (!hours) return undefined;

    return hours.find((h) => {
        const startsBeforeNow = tick.value >= h.ms;
        const endsAfterNow = tick.value < h.ms + ONE_HOUR_MS;
        return startsBeforeNow && endsAfterNow;
    });
})

const isNight = computed(() => {
    const hour = new Date(tick.value + CITY.utcOffsetMin * 60000).getUTCHours()
    return hour >= 19 || hour < 7
})

const info = computed(() => {
    const forced = ui.forceRain
    if (!ui.weather && !forced) return null

    const current = ui.weather?.current
    const mm = forced ? DEV_RAIN_MM : (current.mm ?? 0)
    const level = rainLevel(mm)
    const raining = level !== 'dry'

    let base = raining ? RAIN_LEVELS[level] : describeCode(current.code)
    if (!raining && RAINY_ICON.test(base.icon)) base = { label: 'Cloudy', icon: 'bi-cloud' }
    if (forced) base = { label: `${base.label} (dev)`, icon: base.icon }

    let icon = isNight.value ? (NIGHT_ICON[base.icon] ?? base.icon) : base.icon
    if (lightningNearby.value) icon = raining ? 'bi-cloud-lightning-rain' : 'bi-cloud-lightning'

    return {
        icon,
        label: lightningNearby.value
            ? `${base.label}, lightning ${ui.shownLightning.nearestKm} km away`
            : base.label,
        prob: forced ? DEV_RAIN_CHANCE : (currentHour.value?.prob ?? 0),
        temp: current ? Math.round(current.temp) : null,
        mm
    };
});

</script>

<template>
    <div v-if="info" class="wx" :title="info.label">
        <span v-if="info.temp != null" class="item mono">
            <i class="bi bi-thermometer-half"></i>{{ info.temp }}°C
        </span>

        <span class="item mono">
            <i class="bi" :class="info.icon"></i>{{ info.mm }} mm
        </span>

        <span v-if="haze" class="item mono" :title="`PSI ${haze.psi} (${haze.label})`">
            <svg class="face" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                 stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="8" cy="8" r="7.4" />
                <template v-if="haze.mask">
                    <path d="M4.6 6.3q1 .8 2 0M9.4 6.3q1 .8 2 0" />
                    <rect x="3.2" y="8.1" width="9.6" height="4.4" rx="1.6" />
                    <path d="M5.2 9.6h5.6M5.8 11.1h4.4" />
                </template>
                <template v-else>
                    <path d="M4.5 7.2q1.1-1.5 2.2 0M9.3 7.2q1.1-1.5 2.2 0" />
                    <path d="M4.3 9.6q3.7 4 7.4 0" />
                </template>
            </svg>PSI {{ haze.psi }}
        </span>
    </div>
</template>


<style scoped>
.wx {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    padding: 4px 11px;
    border-radius: 999px;
    background: var(--zt-card);
    color: var(--zt-ink);
    border: var(--zt-bw) solid var(--zt-line);
    font-weight: 800;
    font-size: 0.8rem;
    box-shadow: var(--zt-shadow-sm);
}

.item .bi {
    font-size: 1rem;
}

.item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.8rem;
}

.item .face { width: 1.15rem; height: 1.15rem; font-size: 1.15rem; }
</style>

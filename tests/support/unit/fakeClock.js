import { ref } from 'vue'

/**
 * Lightweight clock replacement for tests that mock
 * `src/model/services/clock.js` without starting its real interval.
 *
 * Usage from a migrated unit spec:
 * vi.mock('../../../src/model/services/clock.js', () => import('../../support/unit/fakeClock.js'))
 * setNow(T('12:00'))
 * tick.value = T('12:00')
 */
export const tick = ref(Date.now())
export const now = () => Date.now()
export const clockOffsetMin = () => 0
export const skipMinutes = () => {}
export const resetClock = () => {}

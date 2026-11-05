// EDITOR: HULBERT
import { defineStore } from 'pinia'
import { fetchForecast, fetchHaze, fetchLightning } from '../services/weather.js'

/** Theme, toasts, celebrations, weather and dev flags (Matthew + Hulbert lanes). */
const DEV_PSI = 160 // "Unhealthy" level, used when haze is forced on
const TOAST_LIMIT = 3 // most toasts on screen at once, so they can never cover the page
const TOAST_GAP_MS = 600 // once a toast goes, the same message waits this long before it can return

export const useUiStore = defineStore('ui', {
  state: () => ({
    theme: document.documentElement.getAttribute('data-bs-theme') || 'light',
    toasts: [],
    toastSeen: {}, // message key -> when it was last dismissed, so a spammed button can't re-stack it
    celebration: null,
    weather: null, // latest real weather reading from Open-Meteo (current conditions + hourly rain chance)
    haze: null, // latest real PSI reading from NEA
    lightning: null, // latest real lightning reading from NEA
    weatherError: null, // error message if Open-Meteo request failed
    hazeError: null, // error message if NEA PSI request failed
    lightningError: null, // error message if NEA lightning request failed
    forceRain: readFlag('zoot.forceRain'), // dev toggle #1
    forceHaze: readFlag('zoot.forceHaze'), // dev toggle #2
    forceLightning: readFlag('zoot.forceLightning'), // dev toggle #3
    navHidden: false // set by focused flows (first-time planning) to hide the bottom nav
  }),
  getters: {
    // Haze to display: fake "Unhealthy" reading when forced, otherwise the real one
    shownHaze(state) {
      if (state.forceHaze) return { region: 'dev', psi: DEV_PSI, pm25: 80 }
      return state.haze
    },
    // Lightning to display: a fake close strike when forced, otherwise the real one
    shownLightning(state) {
      if (state.forceLightning) return { count: 12, nearestKm: 3, nearby: true }
      return state.lightning
    }
  },
  actions: {
    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-bs-theme', this.theme)
      try {
        localStorage.setItem('zoot.theme', this.theme)
      } catch {}
    },
    setForceRain(on) {
      this.forceRain = on
      try {
        localStorage.setItem('zoot.forceRain', on ? '1' : '0')
      } catch {}
    },
    setForceHaze(on) {
      this.forceHaze = on
      try {
        localStorage.setItem('zoot.forceHaze', on ? '1' : '0')
      } catch {}
    },
    setForceLightning(on) {
      this.forceLightning = on
      try {
        localStorage.setItem('zoot.forceLightning', on ? '1' : '0')
      } catch {}
    },
    /**
     * Show a toast. Repeats are folded into the one already on screen instead of
     * stacking, so holding or spamming a button can't pile up a wall of toasts.
     * Returns the toast id, or null when the repeat was ignored.
     */
    toast(message, variant = 'dark', ms = 3200) {
      const key = `${variant}|${message}`
      const now = Date.now()

      // Same message still up: restart its countdown rather than adding a copy.
      const live = this.toasts.find((t) => t.key === key)
      if (live) {
        clearTimeout(live.timer)
        live.timer = setTimeout(() => this.dismissToast(live.id), ms)
        return live.id
      }

      // It only just went, so ignore the repeat instead of flickering it back in.
      for (const seen in this.toastSeen) {
        if (now - this.toastSeen[seen] >= TOAST_GAP_MS) delete this.toastSeen[seen] // keep the map small
      }
      if (this.toastSeen[key]) return null

      const id = Math.random().toString(36).slice(2)
      const timer = setTimeout(() => this.dismissToast(id), ms)
      this.toasts.push({ id, key, message, variant, timer })
      // Different messages can still arrive together (a toggle flipped fast), so cap the stack.
      while (this.toasts.length > TOAST_LIMIT) this.dismissToast(this.toasts[0].id)
      return id
    },
    dismissToast(id) {
      const found = this.toasts.find((t) => t.id === id)
      if (!found) return
      clearTimeout(found.timer)
      this.toastSeen[found.key] = Date.now()
      this.toasts = this.toasts.filter((t) => t.id !== id)
    },
    celebrate(payload) {
      this.celebration = payload
    },
    async loadWeather(lat, lng) {
      // allSettled: one failed request doesn't stop the others
      const [forecast, haze, lightning] = await Promise.allSettled([
        fetchForecast(lat, lng),
        fetchHaze(lat, lng),
        fetchLightning(lat, lng)
      ])

      if (forecast.status === 'fulfilled') {
        this.weather = forecast.value
        this.weatherError = null
      } else {
        this.weatherError = forecast.reason.message
      }
      if (haze.status === 'fulfilled') {
        this.haze = haze.value
        this.hazeError = null
      } else {
        this.hazeError = haze.reason.message
      }
      if (lightning.status === 'fulfilled') {
        this.lightning = lightning.value
        this.lightningError = null
      } else {
        this.lightningError = lightning.reason.message
      }

      return this.weather
    }
  }
})

function readFlag(key) {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

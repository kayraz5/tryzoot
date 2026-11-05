// EDITOR: MATTHEW
import { onScopeDispose, ref } from 'vue'

/**
 * Keeps a tap handler from running again while it is still working, plus a short
 * cooldown after it settles. Bind `cooling` to the button's `disabled` so a fast
 * double-tap can't repeat the action (or the toast it raises).
 */
export function useCooldown(ms = 700) {
  const cooling = ref(false)
  let timer = null

  /** Runs `fn` unless we're still cooling down; returns its result, or undefined if skipped. */
  async function run(fn) {
    if (cooling.value) return
    cooling.value = true
    try {
      return await fn()
    } finally {
      clearTimeout(timer)
      timer = setTimeout(() => {
        cooling.value = false
      }, ms)
    }
  }

  onScopeDispose(() => clearTimeout(timer))

  return { cooling, run }
}

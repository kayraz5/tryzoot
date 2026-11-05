import { ref } from 'vue'

/**
 * Places the traveller has saved, by id.
 *
 * Lives on the device rather than the account: saving is a quick "come back to
 * this" gesture that has to work in guest mode, before anyone has signed in.
 *
 * Exported as one shared ref so every screen reads the same list — save a place
 * on its own page and the Saved view on Explore already knows about it, with no
 * reload and no second copy of the parsing.
 */
const KEY = 'zoot.bookmarks'

function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    // Anything hand-edited or left by an older build is dropped rather than
    // trusted: a non-string id would break every lookup that consumes this.
    return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : []
  } catch {
    return [] // private mode, or junk in the key
  }
}

/** Saved place ids, oldest first. */
export const savedIds = ref(read())

export function isSaved(id) {
  return savedIds.value.includes(id)
}

/** Save or unsave a place. Returns whether it is saved afterwards. */
export function toggleSaved(id) {
  savedIds.value = isSaved(id) ? savedIds.value.filter((x) => x !== id) : [...savedIds.value, id]
  try {
    localStorage.setItem(KEY, JSON.stringify(savedIds.value))
  } catch {
    /* storage blocked or full: the change still applies for this session */
  }
  return isSaved(id)
}

/** Tests only: re-read storage, as a fresh page load would. */
export function reloadSaved() {
  savedIds.value = read()
}

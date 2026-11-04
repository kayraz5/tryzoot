// pnpm sync:place-images -> looks up photos for every place once and saves them to
// src/model/data/placeImages.json, so Explore and the mission page show real photos at once
// instead of searching Wikimedia live (which is slow and rate-limited) for each card.
// Same lookup as the app (placeImages.js): Commons photos geotagged near the place, plus the
// Wikipedia lead image. Keeps earlier results; pass --refresh to look everything up again.
import { readFileSync, writeFileSync } from 'node:fs'
import { fetchImages } from '../src/model/services/placeImages.js'

const PLACES_FILE = new URL('../src/model/data/places.synced.json', import.meta.url)
const OUT_FILE = new URL('../src/model/data/placeImages.json', import.meta.url)
const WORKERS = 1 // Wikimedia rate-limits bursts; more workers just means more refusals
const GAP_MS = 1000 // between places
const refresh = process.argv.includes('--refresh')

// Wikimedia asks scripts to identify themselves; browsers send their own User-Agent.
const plainFetch = globalThis.fetch
globalThis.fetch = (url, opts = {}) => plainFetch(url, { ...opts, headers: { 'User-Agent': 'ZootLayoverApp/1.0 (place photo sync)', ...opts.headers } })

const places = JSON.parse(readFileSync(PLACES_FILE, 'utf8')).filter((p) => p.active !== false)
const saved = refresh ? {} : JSON.parse(readFileSync(OUT_FILE, 'utf8'))
const todo = places.filter((p) => !saved[p.id]?.length)
console.log(`[place-images] ${places.length} places, ${todo.length} to look up`)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// Commons adds ?utm_… tracking to thumbnail links; the image is the same without it.
const plain = (url) => url?.split('?')[0]
const untracked = (img) => ({ ...img, src: plain(img.src), full: plain(img.full) })
async function lookUp(place) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return (await fetchImages(place)).map(untracked) } catch { await sleep(5000 * 2 ** attempt) } // rate-limited: back off
  }
  return []
}

let done = 0
const queue = [...todo]
await Promise.all(Array.from({ length: WORKERS }, async () => {
  for (let place; (place = queue.shift()); ) {
    const images = await lookUp(place)
    if (images.length) saved[place.id] = images
    if (++done % 25 === 0) console.log(`[place-images] ${done}/${todo.length}`)
    await sleep(GAP_MS)
  }
}))

// Sorted by id so re-runs give small diffs
const out = Object.fromEntries(Object.keys(saved).sort().map((id) => [id, saved[id]]))
writeFileSync(OUT_FILE, JSON.stringify(out, null, 1) + '\n')
const have = places.filter((p) => out[p.id]?.length).length
console.log(`[place-images] photos for ${have}/${places.length} places`)
console.log('[place-images] none for:', places.filter((p) => !out[p.id]?.length).map((p) => p.id).join(', '))

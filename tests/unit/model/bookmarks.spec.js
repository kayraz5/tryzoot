import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCleanSlate } from '../../support/unit/index.js'

useCleanSlate()

const load = () => import('../../../src/model/services/bookmarks.js')

const KEY = 'zoot.bookmarks'

beforeEach(() => {
  vi.resetModules() // the shared ref is module state, so each test needs a fresh copy
})

describe('bookmarks: places kept for later', () => {
  it('starts empty when nothing is stored', async () => {
    const { savedIds } = await load()
    expect(savedIds.value).toEqual([])
  })

  it('saves a place and writes it through to storage', async () => {
    const { toggleSaved, isSaved, savedIds } = await load()

    expect(toggleSaved('merlion-park')).toBe(true)

    expect(isSaved('merlion-park')).toBe(true)
    expect(savedIds.value).toEqual(['merlion-park'])
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual(['merlion-park'])
  })

  it('unsaves on a second toggle', async () => {
    const { toggleSaved, isSaved } = await load()
    toggleSaved('merlion-park')

    expect(toggleSaved('merlion-park')).toBe(false)

    expect(isSaved('merlion-park')).toBe(false)
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual([])
  })

  it('keeps saves in the order they were made', async () => {
    const { toggleSaved, savedIds } = await load()
    toggleSaved('a')
    toggleSaved('b')
    toggleSaved('c')
    expect(savedIds.value).toEqual(['a', 'b', 'c'])
  })

  it('reads an existing list back on the next visit', async () => {
    localStorage.setItem(KEY, JSON.stringify(['chinatown', 'sentosa-island']))
    const { savedIds, isSaved } = await load()
    expect(savedIds.value).toEqual(['chinatown', 'sentosa-island'])
    expect(isSaved('sentosa-island')).toBe(true)
  })

  it('drops entries that are not ids, rather than trusting them', async () => {
    localStorage.setItem(KEY, JSON.stringify(['chinatown', 42, null, { id: 'x' }]))
    const { savedIds } = await load()
    expect(savedIds.value).toEqual(['chinatown'])
  })

  it('survives junk, and a value that is not an array', async () => {
    localStorage.setItem(KEY, 'not json{')
    const { savedIds } = await load()
    expect(savedIds.value).toEqual([])

    vi.resetModules()
    localStorage.setItem(KEY, JSON.stringify({ merlion: true }))
    const second = await load()
    expect(second.savedIds.value).toEqual([])
  })

  it('reloadSaved re-reads storage, as a reload would', async () => {
    const { savedIds, reloadSaved } = await load()
    expect(savedIds.value).toEqual([])

    localStorage.setItem(KEY, JSON.stringify(['lau-pa-sat']))
    reloadSaved()

    expect(savedIds.value).toEqual(['lau-pa-sat'])
  })

  it('shares one list, so saving on one screen shows on another', async () => {
    const first = await load()
    const second = await load() // a second importer, same module instance

    first.toggleSaved('kampong-glam')

    expect(second.savedIds.value).toEqual(['kampong-glam'])
    expect(second.isSaved('kampong-glam')).toBe(true)
  })
})

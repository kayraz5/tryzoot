import { test, expect } from '../fixtures/harness.js'

test.use({ auth: 'onboarded' })

test('stamp art loads from /stamps after the move', async ({ page }) => {
  test.slow()
  const stampRequests = []
  page.on('response', (r) => { if (r.url().includes('/stamps/')) stampRequests.push(`${r.status()} ${r.url().split('/').pop()}`) })

  await page.goto('/codex', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  const imgs = await page.evaluate(() => [...document.querySelectorAll('img')]
    .filter((i) => i.currentSrc.includes('/stamps/'))
    .map((i) => ({ src: i.currentSrc.split('/').pop(), painted: i.naturalWidth > 0 })))

  console.log('\nstamp responses:', stampRequests.slice(0, 5).join(' | '), `(${stampRequests.length} total)`)
  console.log('stamp <img> painted:', JSON.stringify(imgs.slice(0, 5), null, 1), `(${imgs.length} total)`)

  // direct fetch of a known stamp
  const direct = await page.evaluate(async () => {
    const r = await fetch('/stamps/merlion-park.png')
    return { status: r.status, type: r.headers.get('content-type'), bytes: (await r.blob()).size }
  })
  console.log('direct /stamps/merlion-park.png:', JSON.stringify(direct))

  // and one that must NOT exist, so the null fallback still works
  const missing = await page.evaluate(async () => (await fetch('/stamps/not-a-real-place.png')).status)
  console.log('missing stamp status:', missing)

  expect(imgs.length).toBeGreaterThan(0)
  expect(imgs.every((i) => i.painted)).toBe(true)
  expect(stampRequests.every((s) => s.startsWith('200'))).toBe(true)
})

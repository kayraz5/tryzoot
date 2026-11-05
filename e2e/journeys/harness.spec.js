// EDITOR: STEVEN
/** Confirm the guest harness blocks unexpected external network access. */
import { APP_HOSTS, EXTERNAL_FIXTURES, expect, test } from '../fixtures/harness.js'

const FIXED_NOW = new Date('2030-01-15T09:00:00+08:00')

const isHttp = (url) => /^https?:/.test(url)
const isExternal = (url) => isHttp(url) && !APP_HOSTS.has(new URL(url).hostname)
const isFixture = (url) => EXTERNAL_FIXTURES.some(([pattern]) => pattern.test(url))
const isSupabase = (url) => /\.supabase\.(co|in)$/.test(new URL(url).hostname)

test.describe('guest harness network boundary', () => {
  test.use({ auth: 'onboarded' })

  test('keeps every request on localhost except fulfilled fixtures', async ({ page }) => {
    test.slow() // Three-page journey.
    const external = []          // Non-localhost requests.
    const intercepted = new Set() // Requests seen by the harness.
    const finished = new Set()
    const failed = new Set()
    let externalSockets = 0

    // Observe requests before handing them to the harness.
    await page.route((url) => isExternal(url.href), (route) => {
      intercepted.add(route.request())
      return route.fallback()
    })
    page.on('request', (request) => { if (isExternal(request.url())) external.push(request) })
    page.on('requestfinished', (request) => { if (isExternal(request.url())) finished.add(request) })
    page.on('requestfailed', (request) => { if (isExternal(request.url())) failed.add(request) })
    page.on('websocket', (socket) => { if (isExternal(socket.url())) externalSockets += 1 })

    // Visit plan, map, and quests.
    await page.clock.install({ time: FIXED_NOW })
    await page.goto('/plan')
    await page.getByLabel('Lands at Changi').fill('2030-01-15T09:30')
    await page.getByLabel('Next flight leaves').fill('2030-01-15T17:30')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Build my quest' }).click()
    // Allow extra time for Firefox to build the plan.
    await expect(page).toHaveURL(/\/mission\/[^/]+$/, { timeout: 30_000 })
    // Map tiles can delay load, so wait for DOMContentLoaded.
    await page.goto('/map', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('timer')).toBeVisible()
    await page.goto('/quests', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Sign in to quest with others' })).toBeVisible()

    // Wait for unhandled external requests to settle.
    const unsettled = () => external.filter((r) => !intercepted.has(r) && !finished.has(r) && !failed.has(r)).length
    await expect.poll(unsettled, { timeout: 15_000, message: 'external requests still in flight' }).toBe(0)

    const notRouted = external.filter((r) => !intercepted.has(r))
    // Browser-aborted requests without responses are not bypasses.
    const notRoutedResponses = await Promise.all(notRouted.map((r) => r.response().catch(() => null)))
    const isBrowserAborted = (r, i) => failed.has(r) && !finished.has(r) && notRoutedResponses[i] === null
    const bypassedRequests = notRouted.filter((r, i) => !isBrowserAborted(r, i))
    const abortedBeforeRouting = notRouted.length - bypassedRequests.length
    const bypassed = bypassedRequests.length
    const finishedNonFixture = [...finished].filter((r) => !isFixture(r.url())).length
    const supabaseAnswered = [...finished].filter((r) => isSupabase(r.url())).length

    expect(external.length, 'the journey made no external request, so the check is vacuous').toBeGreaterThan(0)
    // Keep diagnostics free of URLs.
    const bypassSummary = bypassedRequests
      .map((r) => `${r.resourceType()}:${finished.has(r) ? 'answered' : r.failure()?.errorText ?? 'pending'}`)
      .join(', ')
    // Record browser-aborted requests without failing.
    test.info().annotations.push({
      type: 'aborted by the browser before routing',
      description: String(abortedBeforeRouting),
    })
    expect(bypassed, `external requests that bypassed the harness routing (${bypassSummary})`).toBe(0)
    expect(finishedNonFixture, 'external requests answered by something other than a fixture').toBe(0)
    expect(supabaseAnswered, 'Supabase requests that received a response').toBe(0)
    expect(externalSockets, 'websockets opened to a non-localhost host').toBe(0)
  })
})

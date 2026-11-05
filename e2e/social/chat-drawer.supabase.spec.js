
import {
  cleanupSocial, ensureOnboarded, expect, installSupabaseHarness, requireSeed, requireSupabase, simulate, test
} from '../fixtures/supabase.js'
import { layoverTimes, openMapCard, openToCompany, planLayover, SOCIAL_TIMEOUT_MS, TIMEZONE } from '../fixtures/social.js'

const TITLE = 'E2E chat quest'

test.describe('quest chat drawer', () => {
  requireSupabase(test, ['seed'])
  test.use({ timezoneId: TIMEZONE })

  test.beforeEach(async ({ testAccount }) => { await cleanupSocial(testAccount) })
  test.afterEach(async ({ testAccount }) => { await cleanupSocial(testAccount) })

  /** Host a window with one demo guest, then open the map card. */
  async function hostWithDemoGuest(page, testAccount) {
    test.setTimeout(SOCIAL_TIMEOUT_MS)
    await requireSeed(testAccount)
    await ensureOnboarded(testAccount, 'E2E Host')
    await installSupabaseHarness(page, testAccount)
    await planLayover(page, layoverTimes())
    const quest = await openToCompany(page, testAccount, TITLE)
    await simulate(testAccount.client, quest.id, 'guest_joins')
    await openMapCard(page)
    return quest
  }

  test('opens the chat drawer from the map', async ({ page, testAccount }) => {
    await hostWithDemoGuest(page, testAccount)

    await page.getByRole('button', { name: /^Chat with / }).click()
    const drawer = page.getByRole('dialog', { name: TITLE })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByRole('heading', { name: TITLE })).toBeVisible()
  })

  test('posts a quick reply message in the quest chat', async ({ page, testAccount }) => {
    await hostWithDemoGuest(page, testAccount)
    await page.getByRole('button', { name: /^Chat with / }).click()
    const drawer = page.getByRole('dialog', { name: TITLE })

    await drawer.getByRole('group', { name: 'Quick replies' }).getByRole('button', { name: 'Running 5 min late' }).click()

    // The sent message, not the quick-reply chip itself.
    await expect(drawer.locator('.msg.me .bubble', { hasText: 'Running 5 min late' })).toBeVisible()
  })
})

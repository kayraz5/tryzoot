// EDITOR: STEVEN
/**
 * Journey — Feature: route guards.
 * Runs in the guest harness (zoot.guest='1', external hosts aborted); see e2e/fixtures/harness.js.
 */
import { expect, test } from '../fixtures/harness.js'

test('redirects a signed-out visitor from the plan to authentication', async ({ page }) => {
  await page.goto('/plan')
  await expect(page).toHaveURL(/\/auth\?next=\/plan$/)
})

test.describe('guest route guards', () => {
  test.use({ auth: 'needs-onboarding' })

  test('redirects a guest without a travel style from the plan to onboarding', async ({ page }) => {
    await page.goto('/plan')
    await expect(page).toHaveURL(/\/onboard\?next=\/plan$/)
  })
})

test('redirects an unknown path to the landing page', async ({ page }) => {
  await page.goto('/not-a-real-zoot-route')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('[data-zt-copy="hero"]').getByRole('button', { name: 'Sign up' })).toBeVisible()
})

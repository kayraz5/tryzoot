// EDITOR: STEVEN
import { test, expect } from './fixtures/harness.js'

test('shows the landing page entry points', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('img', { name: 'Zoot' })).toBeVisible()
  await expect(page.locator('[data-zt-copy="hero"]').getByRole('button', { name: 'Sign up' })).toBeVisible()
})

import { test, expect } from '../fixtures'
import { ADMIN } from '../env'

/** §6.2 — the full account lifecycle, driven through the UI. */
test.describe('register, login, logout', () => {
  /** Distinct per run so repeated runs don't collide on the phone unique index. */
  function newPhone(): string {
    return `0912${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`
  }

  test('a new visitor can register and lands signed in', async ({ page }) => {
    const phone = newPhone()

    await page.goto('/register')
    await page.getByLabel('شماره موبایل').fill(phone)
    await page.getByLabel('رمز عبور', { exact: true }).fill('password123')
    await page.getByRole('button', { name: 'ثبت‌نام' }).click()

    // Signed in: the header stops offering "ورود".
    await expect(page.getByRole('link', { name: 'ورود' })).toHaveCount(0)
    // ...and a protected route is reachable.
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/profile/)
  })

  test('a registered account can log out and log back in', async ({ page }) => {
    const phone = newPhone()

    await page.goto('/register')
    await page.getByLabel('شماره موبایل').fill(phone)
    await page.getByLabel('رمز عبور', { exact: true }).fill('password123')
    await page.getByRole('button', { name: 'ثبت‌نام' }).click()
    await expect(page.getByRole('link', { name: 'ورود' })).toHaveCount(0)

    // Log out by clearing the session the way the app stores it, then reload.
    await page.evaluate(() => window.localStorage.removeItem('token'))
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'ورود' }).first()).toBeVisible()

    await page.goto('/login')
    await page.getByLabel('شماره موبایل').fill(phone)
    await page.getByLabel('رمز عبور').fill('password123')
    await page.getByRole('button', { name: 'ورود' }).click()

    // Wait for the session to actually settle before navigating: a `goto`
    // fired mid-login reloads the page before the token is stored, and the
    // protected route then bounces straight back to /login.
    await expect(page.getByRole('link', { name: 'ورود' })).toHaveCount(0)

    await page.goto('/profile')
    await expect(page).toHaveURL(/\/profile/)
  })

  test('login with a wrong password shows the server error and does not sign in', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.getByLabel('شماره موبایل').fill(ADMIN.phone)
    await page.getByLabel('رمز عبور').fill('definitely-wrong')
    await page.getByRole('button', { name: 'ورود' }).click()

    // The real Persian server message must reach the user — this is the
    // regression guarded by the ApiError envelope fix.
    await expect(page.getByText('ایمیل/موبایل یا رمز عبور اشتباه است')).toBeVisible()
    await expect(page.getByRole('link', { name: 'ورود' }).first()).toBeVisible()
  })

  test('client-side validation blocks a short password before any request', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('شماره موبایل').fill('09120000000')
    await page.getByLabel('رمز عبور').fill('123')
    await page.getByRole('button', { name: 'ورود' }).click()

    await expect(page.getByText('رمز عبور باید حداقل ۶ کاراکتر باشد')).toBeVisible()
  })

  test('registering with an already-used phone surfaces the conflict', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('شماره موبایل').fill(ADMIN.phone)
    await page.getByLabel('رمز عبور', { exact: true }).fill('password123')
    await page.getByRole('button', { name: 'ثبت‌نام' }).click()

    await expect(page.getByText(/قبلا|قبلاً|تکرار|ثبت شده/).first()).toBeVisible()
    // Still signed out — the duplicate registration did not create a session.
    await expect(page.getByRole('link', { name: 'ورود' }).first()).toBeVisible()
  })
})

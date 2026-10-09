import { test, expect } from '@playwright/test'

/**
 * End-to-End Smoke Test Flow:
 * 1. Landing & Navigation: Verify landing page renders and public links work.
 * 2. Auth & Login Experience: Test form validation and error handling on login.
 * 3. Registration Flow: Test legal terms consent requirement, availability check, and validation.
 * 4. Protected Route Guards: Ensure middleware correctly redirects unauthenticated visitors to /login.
 * 5. Direct Message / Inbox Deep-link: Ensure direct navigation to /inbox routes to /login when unauthenticated.
 */

test.describe('Private Voices — Production Smoke & Auth Loop Tests', () => {

  test('1. Landing Page renders branding, hero text, and action buttons', async ({ page }) => {
    await page.goto('/')
    
    // Check main branding header
    const brandHeading = page.locator('header').getByText('Private Voices')
    await expect(brandHeading).toBeVisible()

    // Check Hero title
    const heroTitle = page.getByRole('heading', { level: 1 })
    await expect(heroTitle).toContainText('Express yourself')

    // Check entry buttons
    const getStartedBtn = page.getByRole('link', { name: /Get Started|Create Your Account/i }).first()
    await expect(getStartedBtn).toBeVisible()

    const signInBtn = page.getByRole('link', { name: /Sign In/i }).first()
    await expect(signInBtn).toBeVisible()
  })

  test('2. Login page renders form fields and validates invalid login attempts', async ({ page }) => {
    await page.goto('/login')

    // Ensure login heading
    await expect(page.getByText('Welcome back')).toBeVisible()

    // Fill invalid credentials
    await page.locator('#email').fill('nonexistent_user@example.com')
    await page.locator('#password').fill('wrongpassword123')

    // Submit form
    await page.getByRole('button', { name: /Sign in|Login/i }).click()

    // Wait for Supabase Auth error message or loading state change
    const errorMessage = page.locator('p.bg-red-50, p.text-red-600').first()
    await expect(errorMessage).toBeVisible({ timeout: 15000 })
  })

  test('3. Registration enforces Terms Consent and field validation', async ({ page }) => {
    await page.goto('/register')

    // Verify registration heading
    await expect(page.getByRole('heading', { name: /Create your account/i })).toBeVisible()

    // Fill form fields
    await page.locator('input[name="displayName"]').fill('Smoke Tester')
    await page.locator('input[name="username"]').fill('smoketest_usr')
    await page.locator('input[name="email"]').fill('smoketest@example.com')
    await page.locator('input[name="password"]').fill('Password@1234')

    // Verify the submit button is disabled before consent
    const submitBtn = page.getByRole('button', { name: /Get Started|Creating account/i })
    await expect(submitBtn).toBeDisabled()

    // Check the terms and privacy consent checkbox
    const consentCheckbox = page.locator('input[type="checkbox"]')
    await consentCheckbox.check()

    // Submit button should now be enabled
    await expect(submitBtn).toBeEnabled()
  })

  test('4. Route Guard: Unauthenticated access to /feed redirects to /login', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForURL('**/login**')
    await expect(page.getByText('Welcome back')).toBeVisible()
  })

  test('5. Route Guard: Unauthenticated access to /create redirects to /login', async ({ page }) => {
    await page.goto('/create')
    await page.waitForURL('**/login**')
    await expect(page.getByText('Welcome back')).toBeVisible()
  })

  test('6. Route Guard: Unauthenticated access to /inbox redirects to /login', async ({ page }) => {
    await page.goto('/inbox')
    await page.waitForURL('**/login**')
    await expect(page.getByText('Welcome back')).toBeVisible()
  })

})

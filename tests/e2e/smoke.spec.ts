import { expect, test } from '@playwright/test';

test('unauthenticated visitors are sent to the Microsoft-only sign-in page', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();

  await expect(page).toHaveURL(/\/signin/);
  await expect(page.getByRole('button', { name: 'Sign in with Microsoft' })).toBeVisible();
  // No password field or other sign-in methods.
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.getByRole('button')).toHaveCount(1);
});

test('responses include basic security headers', async ({ request }) => {
  const response = await request.get('/signin');
  const headers = response.headers();
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['x-powered-by']).toBeUndefined();
});

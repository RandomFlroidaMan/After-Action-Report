import { test, expect } from '@playwright/test';
test('first hosted deployment shows a safe setup page and refuses data operations', async ({
  browser,
}) => {
  test.skip(
    Boolean(process.env.AAR_TEST_URL) && !process.env.AAR_HOSTED_TEST_URL,
    'Provide AAR_HOSTED_TEST_URL for the isolated unconfigured-hosted test',
  );
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const root = process.env.AAR_HOSTED_TEST_URL ?? 'http://127.0.0.1:3001';
  await page.goto(root);
  await expect(page.getByRole('heading', { name: 'Finish your private setup' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Adventure!2026');
  await expect(page.locator('body')).not.toContainText('dm@aar.local');
  const health = await page.request.get(root + '/api/health');
  expect(health.status()).toBe(503);
  expect((await health.json()).status).toBe('setup_required');
  const registration = await page.request.post(root + '/api/auth/register', {
    data: {
      name: 'Uninvited',
      email: 'uninvited@example.test',
      password: 'NotAnInvitedAccount123!',
    },
  });
  expect(registration.status()).toBe(503);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.close();
});

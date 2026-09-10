import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test } from '@playwright/test';

const API = 'http://127.0.0.1:8787';
const STOREFRONT = 'http://127.0.0.1:5173';
const RESET_TOKEN = 'qa-reset-token';

async function resetHealthy() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.post('/api/v1/demo/reset', {
    headers: { 'x-demo-reset-token': RESET_TOKEN },
    data: { scenario: 'healthy' },
  });
  expect(response.ok()).toBeTruthy();
  await api.dispose();
}

test.describe('BeeUI account verification inputs with canonical customer identity', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('PasswordInput masks by default and exposes an accessible show/hide toggle', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/account-verification`);
    await expect(page.getByTestId('verification-account-identity')).toContainText('Ava Nguyen');
    await expect(page.getByTestId('verification-account-identity')).toContainText('ava@example.test');

    const password = page.getByLabel('Account password');
    await expect(password).toHaveAttribute('type', 'password');
    await expect(page.getByTestId('password-visibility-state')).toHaveText('Password hidden');

    const show = page.getByRole('button', { name: 'Show password' });
    await expect(show).toBeVisible();
    await show.click();
    await expect(password).toHaveJSProperty('type', 'text');
    await expect(page.getByTestId('password-visibility-state')).toHaveText('Password visible');

    const hide = page.getByRole('button', { name: 'Hide password' });
    await hide.click();
    await expect(password).toHaveJSProperty('type', 'password');
    await expect(page.getByTestId('password-visibility-state')).toHaveText('Password hidden');
  });

  test('OTPInput exposes numeric one-time-code attributes and completes at six digits', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/account-verification`);
    await expect(page.getByTestId('verification-account-identity')).toContainText('Ava Nguyen');

    const otp = page.getByLabel('Six digit verification code');
    await expect(otp).toHaveAttribute('inputmode', 'numeric');
    await expect(otp).toHaveAttribute('maxlength', '6');
    await expect(otp).toHaveAttribute('autocomplete', 'one-time-code');

    await otp.fill('12345');
    await expect(page.getByTestId('otp-value-state')).toHaveText('5 of 6 digits entered');
    await expect(page.getByTestId('verification-complete')).toHaveCount(0);

    await otp.fill('123456');
    await expect(page.getByTestId('otp-value-state')).toHaveText('6 of 6 digits entered');
    await expect(page.getByTestId('verification-complete')).toContainText('Identity verified');
    await expect(page.getByTestId('verification-complete')).toContainText('Ava Nguyen');
  });

  test('account verification reflows at 360px without serious or critical axe findings', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`${STOREFRONT}/conformance/account-verification`);
    await expect(page.getByTestId('verification-account-identity')).toContainText('Ava Nguyen');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  });
});

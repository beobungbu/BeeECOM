import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test, type Page, type TestInfo } from '@playwright/test';

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

async function getCustomer() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.get('/api/v1/customers/cust-ava');
  expect(response.ok()).toBeTruthy();
  const body = await response.json() as {
    ok: true;
    data: {
      displayName: string;
      email: string;
      addresses: Array<{
        id: string;
        line1: string;
        city: string;
        isDefault: boolean;
      }>;
    };
  };
  await api.dispose();
  return body.data;
}

async function attachFullPage(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' }),
    contentType: 'image/png',
  });
}

test.describe('Profile and delivery settings product flow', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('SettingsItem navigation exposes real list ownership and profile details persist across reload', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/account-settings`);
    await expect(page.getByRole('heading', { name: 'Account settings' })).toBeVisible();

    const list = page.getByRole('list', { name: 'Account settings sections' });
    await expect(list).toBeVisible();
    await expect(list.locator('[role="listitem"]')).toHaveCount(2);

    const profileItem = page.getByTestId('settings-profile-item');
    await expect(profileItem).toHaveAttribute('role', 'button');
    await expect(page.getByTestId('profile-settings-panel')).toBeVisible();

    const nameInput = page.getByRole('textbox', { name: /Full name/ });
    const emailInput = page.getByRole('textbox', { name: /Email/ });
    await nameInput.fill('Ava N.');
    await emailInput.fill('ava+shop@example.test');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByTestId('account-settings-notice')).toHaveText('Profile details saved.');

    const persisted = await getCustomer();
    expect(persisted.displayName).toBe('Ava N.');
    expect(persisted.email).toBe('ava+shop@example.test');

    await page.reload();
    await expect(page.getByRole('textbox', { name: /Full name/ })).toHaveValue('Ava N.');
    await expect(page.getByRole('textbox', { name: /Email/ })).toHaveValue('ava+shop@example.test');
  });

  test('delivery editor uses direct Label-to-Switch naming and persists the address across reload', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/account-settings`);
    await expect(page.getByTestId('settings-delivery-item')).toBeVisible();
    await page.getByTestId('settings-delivery-item').click();
    await expect(page.getByTestId('delivery-settings-panel')).toBeVisible();

    const defaultSwitch = page.getByRole('switch', { name: 'Default delivery address' });
    await expect(defaultSwitch).toBeChecked();
    await expect(defaultSwitch).toBeDisabled();

    const addressInput = page.getByRole('textbox', { name: /Address line/ });
    await addressInput.fill('202 Market Street');
    await page.getByRole('button', { name: 'Save address' }).click();
    await expect(page.getByTestId('account-settings-notice')).toHaveText('Delivery address saved.');

    const persisted = await getCustomer();
    const address = persisted.addresses.find((item) => item.id === 'addr-ava-home');
    expect(address?.line1).toBe('202 Market Street');
    expect(address?.city).toBe('San Francisco');
    expect(address?.isDefault).toBe(true);
    await expect(page.getByTestId('delivery-address-summary')).toContainText('202 Market Street');

    await page.reload();
    await page.getByTestId('settings-delivery-item').click();
    await expect(page.getByRole('textbox', { name: /Address line/ })).toHaveValue('202 Market Street');
    await expect(page.getByTestId('delivery-address-summary')).toContainText('202 Market Street');
  });

  test('customer update endpoint rejects removing the only default delivery address', async () => {
    const api = await playwrightRequest.newContext({ baseURL: API });
    const response = await api.patch('/api/v1/customers/cust-ava', {
      data: { address: { id: 'addr-ava-home', isDefault: false } },
    });
    expect(response.status()).toBe(409);
    const body = await response.json() as { ok: false; error: { code: string } };
    expect(body.error.code).toBe('DEFAULT_ADDRESS_REQUIRED');
    await api.dispose();

    const persisted = await getCustomer();
    expect(persisted.addresses.find((item) => item.id === 'addr-ava-home')?.isDefault).toBe(true);
  });

  test('customer update endpoint rejects another customer email without mutating the profile', async () => {
    const api = await playwrightRequest.newContext({ baseURL: API });
    const response = await api.patch('/api/v1/customers/cust-ava', {
      data: { email: 'minh@example.test' },
    });
    expect(response.status()).toBe(409);
    const body = await response.json() as { ok: false; error: { code: string } };
    expect(body.error.code).toBe('CUSTOMER_EMAIL_IN_USE');
    await api.dispose();

    const persisted = await getCustomer();
    expect(persisted.email).toBe('ava@example.test');
    expect(persisted.displayName).toBe('Ava Nguyen');
  });

  test('settings reflow at 390px, pass serious/critical axe and produce visual evidence', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${STOREFRONT}/conformance/account-settings`);
    await expect(page.getByTestId('profile-settings-panel')).toBeVisible();

    let overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await attachFullPage(page, testInfo, 'account-settings-mobile-profile');

    await page.getByTestId('settings-delivery-item').click();
    await expect(page.getByTestId('delivery-settings-panel')).toBeVisible();
    overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
    await attachFullPage(page, testInfo, 'account-settings-mobile-delivery');
  });

  test('desktop settings produce visual evidence', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${STOREFRONT}/conformance/account-settings`);
    await expect(page.getByTestId('profile-settings-panel')).toBeVisible();
    await attachFullPage(page, testInfo, 'account-settings-desktop');
  });
});

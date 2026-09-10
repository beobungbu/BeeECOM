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

async function attachFullPage(page: Page, testInfo: TestInfo, name: string) {
  const body = await page.screenshot({
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  });
  await testInfo.attach(name, { body, contentType: 'image/png' });
}

test.describe('Account hub product shell', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('renders canonical customer, recent order and saved product in product-grade account sections', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/account`);

    await expect(page.getByRole('heading', { name: 'Your account' })).toBeVisible();
    await expect(page.getByText('Ava Nguyen', { exact: true })).toBeVisible();
    await expect(page.getByText('ava@example.test', { exact: true })).toBeVisible();
    await expect(page.getByText('Order #1001', { exact: true })).toBeVisible();
    await expect(page.getByTestId('account-saved-prod-field-pack')).toContainText('Field Pack');
    await expect(page.getByTestId('account-saved-prod-field-pack')).toContainText('$64.00');

    await expect(page.getByTestId('account-structural-separator')).toHaveAttribute('role', 'separator');
    await expect(page.getByRole('heading', { name: 'Recent orders' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Saved items' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Account settings' })).toBeVisible();
  });

  test('icon back action and account links provide real keyboard navigation', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/account`);
    await expect(page.getByText('Ava Nguyen', { exact: true })).toBeVisible();

    const back = page.getByRole('button', { name: 'Back to shop' });
    await back.focus();
    await expect(back).toBeFocused();
    await back.press('Enter');
    await expect(page).toHaveURL(`${STOREFRONT}/conformance/collections`);

    await page.goto(`${STOREFRONT}/conformance/account`);
    await page.getByRole('link', { name: 'View all' }).click();
    await expect(page).toHaveURL(`${STOREFRONT}/conformance/orders`);

    await page.goto(`${STOREFRONT}/conformance/account`);
    await page.getByRole('link', { name: 'Open security' }).click();
    await expect(page).toHaveURL(`${STOREFRONT}/conformance/account-verification`);
  });

  test('desktop account hub produces visual evidence with intact product hierarchy', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${STOREFRONT}/conformance/account`);
    await expect(page.getByText('Ava Nguyen', { exact: true })).toBeVisible();
    await expect(page.getByText('Order #1001', { exact: true })).toBeVisible();
    await attachFullPage(page, testInfo, 'account-hub-desktop');
  });

  test('mobile account hub reflows at 390px and produces visual evidence without overflow or major a11y issues', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${STOREFRONT}/conformance/account`);
    await expect(page.getByText('Ava Nguyen', { exact: true })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);

    await attachFullPage(page, testInfo, 'account-hub-mobile');
  });
});

import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test, type Page, type TestInfo } from '@playwright/test';

const API = 'http://127.0.0.1:8787';
const ADMIN = 'http://127.0.0.1:5174';
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
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' }),
    contentType: 'image/png',
  });
}

test.describe('Product Admin shell and routes', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('navigates between product-facing Admin surfaces with accessible current state', async ({ page }) => {
    await page.goto(`${ADMIN}/`);
    const primary = page.getByRole('navigation', { name: 'Admin primary navigation' });
    await expect(primary).toBeVisible();
    await expect(primary.getByRole('link', { name: /Operations/ })).toHaveAttribute('aria-current', 'page');

    await primary.getByRole('link', { name: /Catalog & inventory/ }).click();
    await expect(page).toHaveURL(`${ADMIN}/catalog`);
    await expect(page.getByText('Catalog & inventory', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Admin primary navigation' }).getByRole('link', { name: /Catalog & inventory/ })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Catalog & inventory');

    await page.getByRole('navigation', { name: 'Admin primary navigation' }).getByRole('link', { name: /Promotions/ }).click();
    await expect(page).toHaveURL(`${ADMIN}/promotions`);
    await expect(page.getByText('Promotions', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Admin primary navigation' }).getByRole('link', { name: /Promotions/ })).toHaveAttribute('aria-current', 'page');
  });

  test('direct product routes survive reload and keep canonical feature state', async ({ page }) => {
    await page.goto(`${ADMIN}/catalog`);
    await expect(page.getByTestId('catalog-product-editor')).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(`${ADMIN}/catalog`);
    await expect(page.getByTestId('catalog-product-editor')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Admin primary navigation' }).getByRole('link', { name: /Catalog & inventory/ })).toHaveAttribute('aria-current', 'page');

    await page.goto(`${ADMIN}/promotions`);
    await expect(page.getByTestId('promotion-editor')).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(`${ADMIN}/promotions`);
    await expect(page.getByTestId('promotion-editor')).toBeVisible();
  });

  test('preserves isolated conformance aliases without injecting the product shell', async ({ page }) => {
    await page.goto(`${ADMIN}/conformance/catalog-inventory`);
    await expect(page.getByTestId('catalog-product-editor')).toBeVisible();
    await expect(page.getByTestId('admin-shell')).toHaveCount(0);

    await page.goto(`${ADMIN}/conformance/promotions`);
    await expect(page.getByTestId('promotion-editor')).toBeVisible();
    await expect(page.getByTestId('admin-shell')).toHaveCount(0);

    await page.goto(`${ADMIN}/conformance/theme-preference`);
    await expect(page.getByText('Operations workspace', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh dashboard' })).toBeVisible();
    await expect(page.getByTestId('admin-shell')).toHaveCount(0);
  });

  test('keeps product navigation usable and accessible at 390px', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${ADMIN}/catalog`);

    const primary = page.getByRole('navigation', { name: 'Admin primary navigation' });
    await expect(primary.getByRole('link', { name: /Operations/ })).toBeVisible();
    await expect(primary.getByRole('link', { name: /Catalog & inventory/ })).toBeVisible();
    await expect(primary.getByRole('link', { name: /Promotions/ })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);

    await attachFullPage(page, testInfo, 'admin-shell-catalog-mobile');
  });

  test('produces desktop shell evidence', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${ADMIN}/promotions`);
    await expect(page.getByTestId('admin-shell')).toBeVisible();
    await attachFullPage(page, testInfo, 'admin-shell-promotions-desktop');
  });
});

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

test.describe('BeeUI Breadcrumb in a product-grade customer order history flow', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('order history loads canonical customer orders and opens a reusable detail page', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/orders`);

    await expect(page.getByText('Your orders', { exact: true })).toBeVisible();
    const history = page.getByRole('list', { name: 'Order history' });
    await expect(history).toBeVisible();
    await expect(history.getByRole('listitem')).toHaveCount(1);
    await expect(history).toContainText('#1001');
    await expect(history).toContainText('Shipped');
    await expect(history).toContainText('$78.12');

    await page.getByRole('button', { name: 'View order #1001' }).click();
    await expect(page).toHaveURL(`${STOREFRONT}/conformance/orders/order-1001`);
    await expect(page.getByText('Order #1001', { exact: true })).toBeVisible();
    await expect(page.getByTestId('order-detail-items')).toContainText('Field Pack');
    await expect(page.getByTestId('order-detail-summary')).toContainText('$78.12');
    await expect(page.getByText('101 Market Street', { exact: true })).toBeVisible();
  });

  test('Breadcrumb exposes real navigation links while keeping the current order non-interactive', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/orders/order-1001`);
    await expect(page.getByText('Order #1001', { exact: true })).toBeVisible();

    const breadcrumb = page.getByTestId('order-breadcrumb');
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.getByRole('link', { name: 'Shop' })).toBeVisible();
    await expect(breadcrumb.getByRole('link', { name: 'Orders' })).toBeVisible();
    await expect(breadcrumb.getByRole('link', { name: '#1001' })).toHaveCount(0);
    await expect(breadcrumb.getByText('#1001', { exact: true })).toBeVisible();

    await breadcrumb.getByRole('link', { name: 'Orders' }).click();
    await expect(page).toHaveURL(`${STOREFRONT}/conformance/orders`);
    await expect(page.getByText('Your orders', { exact: true })).toBeVisible();
  });

  test('order detail remains readable at 360px without serious or critical axe findings', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`${STOREFRONT}/conformance/orders/order-1001`);
    await expect(page.getByText('Order #1001', { exact: true })).toBeVisible();
    await expect(page.getByTestId('order-breadcrumb')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      violations.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')),
    ).toEqual([]);

    await expect(page.getByText(/BeeUI|D1-backed|acceptance|fixture/i)).toHaveCount(0);
  });
});

import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test } from '@playwright/test';

const API = 'http://127.0.0.1:8787';
const ADMIN = 'http://127.0.0.1:5174';
const RESET_TOKEN = 'qa-reset-token';

async function resetScenario(scenario: 'healthy' | 'empty-catalog') {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.post('/api/v1/demo/reset', {
    headers: { 'x-demo-reset-token': RESET_TOKEN },
    data: { scenario },
  });
  expect(response.ok()).toBeTruthy();
  await api.dispose();
}

test.describe('BeeUI status primitives in a product-grade inventory health dashboard', () => {
  test.beforeEach(async () => {
    await resetScenario('healthy');
  });

  test('healthy catalog renders actionable stock metrics and warning state', async ({ page }) => {
    await page.goto(`${ADMIN}/conformance/inventory-health`);

    await expect(page.getByText('Inventory health', { exact: true })).toBeVisible();
    await expect(page.getByTestId('inventory-health-alert')).toContainText('Replenishment recommended');
    await expect(page.getByTestId('inventory-health-alert')).toContainText('2 low-stock variants');
    await expect(page.getByTestId('inventory-health-alert')).toContainText('1 out-of-stock variant');
    await expect(page.getByTestId('inventory-health-alert')).toHaveAttribute('aria-live', 'polite');

    await expect(page.getByTestId('inventory-products-stat')).toContainText('4');
    await expect(page.getByTestId('inventory-variants-stat')).toContainText('8');
    await expect(page.getByTestId('inventory-variants-stat')).toContainText('5 currently in stock');
    await expect(page.getByTestId('inventory-units-stat')).toContainText('95');
    await expect(page.getByTestId('inventory-attention-stat')).toContainText('3');

    await expect(page.getByText('In stock', { exact: true })).toBeVisible();
    await expect(page.getByText('Low stock', { exact: true })).toBeVisible();
    await expect(page.getByText('Out of stock', { exact: true })).toBeVisible();

    await expect(page.getByText(/BeeUI|D1-backed|acceptance|fixture/i)).toHaveCount(0);
  });

  test('Spinner and Skeleton provide a useful loading state while inventory request is pending', async ({ page }) => {
    let releaseRequest: (() => void) | undefined;
    const requestHeld = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });

    await page.route('**/api/v1/catalog/products**', async (route) => {
      await requestHeld;
      await route.continue();
    });

    await page.goto(`${ADMIN}/conformance/inventory-health`);
    const loading = page.getByTestId('inventory-health-loading');
    await expect(loading).toBeVisible();
    await expect(page.getByLabel('Loading inventory health')).toBeVisible();
    await expect(loading).toContainText('Checking stock levels');
    await expect(loading.locator('[aria-hidden="true"]')).not.toHaveCount(0);

    releaseRequest?.();
    await expect(page.getByTestId('inventory-products-stat')).toContainText('4');
  });

  test('ErrorState offers recovery and reloads healthy inventory after a transient request failure', async ({ page }) => {
    await page.route('**/api/v1/catalog/products**', (route) => route.abort('failed'));
    await page.goto(`${ADMIN}/conformance/inventory-health`);

    const error = page.getByTestId('inventory-health-error');
    await expect(error).toContainText('Inventory health is unavailable');
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();

    await page.unroute('**/api/v1/catalog/products**');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByTestId('inventory-products-stat')).toContainText('4');
    await expect(error).toHaveCount(0);
  });

  test('EmptyState explains the next step when the catalog has no products', async ({ page }) => {
    await resetScenario('empty-catalog');
    await page.goto(`${ADMIN}/conformance/inventory-health`);

    const empty = page.getByTestId('inventory-health-empty');
    await expect(empty).toContainText('No products to monitor');
    await expect(empty).toContainText('Add products to the catalog');
    await expect(page.getByRole('button', { name: 'Refresh inventory' })).toBeVisible();
  });

  test('inventory health keeps its product hierarchy at 360px without serious or critical axe findings', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`${ADMIN}/conformance/inventory-health`);
    await expect(page.getByText('Inventory health', { exact: true })).toBeVisible();
    await expect(page.getByTestId('inventory-health-stats')).toBeVisible();

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
  });
});

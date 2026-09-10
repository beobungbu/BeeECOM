import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test } from '@playwright/test';

const API = 'http://127.0.0.1:8787';
const STOREFRONT = 'http://127.0.0.1:5173';
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

test.describe('BeeUI status and loading contracts in the storefront', () => {
  test.beforeEach(async () => {
    await resetScenario('healthy');
  });

  test('Spinner and Skeleton expose a named loading state while the real catalog request is pending', async ({ page }) => {
    let releaseRequest!: () => void;
    const requestGate = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });

    await page.route('**/api/v1/catalog/products**', async (route) => {
      await requestGate;
      await route.continue();
    });

    await page.goto(`${STOREFRONT}/conformance/status`);
    await expect(page.getByTestId('status-loading')).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Catalog loading' })).toBeVisible();
    await expect(page.getByTestId('catalog-loading-skeleton')).toHaveAttribute('aria-hidden', 'true');

    releaseRequest();
    await expect(page.getByText('Inventory attention')).toBeVisible();
    await expect(page.getByTestId('status-loading')).toHaveCount(0);
  });

  test('AlertBanner and Stat render canonical inventory status without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`${STOREFRONT}/conformance/status`);
    await expect(page.getByText('Inventory attention')).toBeVisible();

    const alert = page.getByTestId('inventory-alert');
    await expect(alert).toHaveAttribute('aria-live', 'polite');
    await expect(alert).toContainText('2 low-stock variants · 1 out-of-stock variants');

    await expect(page.getByTestId('products-stat')).toContainText('Products4Canonical catalog rows');
    await expect(page.getByTestId('variants-stat')).toContainText('Variants8Purchasable SKU records');
    await expect(page.getByTestId('available-units-stat')).toContainText('Available units95Inventory quantity sum');
    await expect(page.getByTestId('attention-stat')).toContainText('Needs attention3Low or out-of-stock variants');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  });

  test('Progress exposes the canonical in-stock variant value range', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/status`);
    await expect(page.getByTestId('inventory-progress-summary')).toHaveText('5 of 8 variants are in stock.');

    const progress = page.getByRole('progressbar', { name: 'In-stock variant coverage' });
    await expect(progress).toHaveAttribute('aria-valuemin', '0');
    await expect(progress).toHaveAttribute('aria-valuenow', '5');
    await expect(progress).toHaveAttribute('aria-valuemax', '8');
  });

  test('EmptyState represents the canonical empty-catalog scenario', async ({ page }) => {
    await resetScenario('empty-catalog');
    await page.goto(`${STOREFRONT}/conformance/status`);

    await expect(page.getByText('No catalog products')).toBeVisible();
    await expect(page.getByText('The canonical catalog currently contains no products.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reload catalog' })).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'In-stock variant coverage' })).toHaveCount(0);
  });

  test('ErrorState exposes a real fetch failure and its action recovers against the canonical API', async ({ page }) => {
    await page.route('**/api/v1/catalog/products**', (route) => route.abort('failed'));
    await page.goto(`${STOREFRONT}/conformance/status`);

    await expect(page.getByText('Catalog unavailable')).toBeVisible();
    const retry = page.getByRole('button', { name: 'Retry catalog' });
    await expect(retry).toBeVisible();

    await page.unroute('**/api/v1/catalog/products**');
    await retry.click();
    await expect(page.getByText('Inventory attention')).toBeVisible();
  });
});

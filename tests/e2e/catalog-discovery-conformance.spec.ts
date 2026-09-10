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

test.describe('BeeUI catalog discovery controls against the canonical Worker + D1 catalog', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('SearchInput submits a real catalog query and renders only matching persisted products', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/catalog-discovery`);
    await expect(page.getByTestId('catalog-result-summary')).toHaveText('4 products');

    const search = page.getByLabel('Search products');
    await expect(search).toBeVisible();
    await search.fill('Cloud');
    await search.press('Enter');

    await expect(page.getByTestId('catalog-result-summary')).toHaveText('1 product');
    await expect(page.getByTestId('catalog-result-prod-cloud-tee')).toContainText('Cloud Tee');
    await expect(page.getByTestId('catalog-result-prod-trail-runner')).toHaveCount(0);
    await expect(page.getByTestId('catalog-result-prod-field-pack')).toHaveCount(0);
    await expect(page.getByTestId('catalog-result-prod-studio-cap')).toHaveCount(0);
  });

  test('SegmentedControl exposes radio state and drives real API sorting', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/catalog-discovery`);
    await expect(page.getByTestId('catalog-result-summary')).toHaveText('4 products');

    const group = page.getByRole('radiogroup', { name: 'Catalog sort' });
    await expect(group).toBeVisible();
    const featured = page.getByRole('radio', { name: 'Featured' });
    const priceLow = page.getByRole('radio', { name: 'Price low' });
    const topRated = page.getByRole('radio', { name: 'Top rated' });
    await expect(featured).toBeChecked();
    await expect(priceLow).not.toBeChecked();
    await expect(topRated).not.toBeChecked();

    await priceLow.click();
    await expect(priceLow).toBeChecked();
    await expect(featured).not.toBeChecked();

    const results = page.getByTestId('catalog-results').locator('[data-testid^="catalog-result-"]');
    await expect(results).toHaveCount(4);
    await expect(results.nth(0)).toContainText('Studio Cap');
    await expect(results.nth(1)).toContainText('Cloud Tee');
    await expect(results.nth(2)).toContainText('Field Pack');
    await expect(results.nth(3)).toContainText('Trail Runner');

    await topRated.click();
    await expect(topRated).toBeChecked();
    await expect(results.nth(0)).toContainText('Field Pack');
    await expect(results.nth(1)).toContainText('Cloud Tee');
  });

  test('Checkbox exposes checked state and filters the canonical new-arrival tag', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/catalog-discovery`);
    await expect(page.getByTestId('catalog-result-summary')).toHaveText('4 products');

    const newOnly = page.getByRole('checkbox', { name: 'New arrivals only' });
    await expect(newOnly).not.toBeChecked();
    await newOnly.click();
    await expect(newOnly).toBeChecked();

    await expect(page.getByTestId('catalog-result-summary')).toHaveText('2 products');
    await expect(page.getByTestId('catalog-result-prod-cloud-tee')).toBeVisible();
    await expect(page.getByTestId('catalog-result-prod-studio-cap')).toBeVisible();
    await expect(page.getByTestId('catalog-result-prod-trail-runner')).toHaveCount(0);
    await expect(page.getByTestId('catalog-result-prod-field-pack')).toHaveCount(0);
  });

  test('discovery controls reflow at 360px without serious or critical axe findings', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`${STOREFRONT}/conformance/catalog-discovery`);
    await expect(page.getByTestId('catalog-result-summary')).toHaveText('4 products');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  });
});

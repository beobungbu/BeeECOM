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

test.describe('BeeUI collection discovery in a product-grade Storefront flow', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('customer Avatar, collection Chips and hidden assistive summary use canonical commerce data', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/collections`);

    await expect(page.getByTestId('collection-customer')).toContainText('Ava Nguyen');
    await expect(page.getByLabel('Ava Nguyen profile')).toBeVisible();
    await expect(page.getByText('AN', { exact: true })).toBeVisible();

    const group = page.getByRole('radiogroup', { name: 'Shop collections' });
    await expect(group).toBeVisible();
    const all = page.getByRole('radio', { name: 'All' });
    const apparel = page.getByRole('radio', { name: 'Apparel' });
    const accessories = page.getByRole('radio', { name: 'Accessories' });
    await expect(all).toBeChecked();
    await expect(apparel).not.toBeChecked();

    await accessories.click();
    await expect(accessories).toBeChecked();
    await expect(all).not.toBeChecked();
    await expect(page.getByTestId('collection-result-count')).toHaveText('2 products');
    await expect(page.getByTestId('collection-product-prod-field-pack')).toBeVisible();
    await expect(page.getByTestId('collection-product-prod-studio-cap')).toBeVisible();
    await expect(page.getByTestId('collection-product-prod-cloud-tee')).toHaveCount(0);

    const a11ySummary = page.getByTestId('collection-a11y-summary');
    await expect(a11ySummary).toContainText('Showing 2 products in Accessories.');
    expect(await a11ySummary.evaluate((node) => node.getBoundingClientRect().right < 0)).toBe(true);

    await apparel.click();
    await expect(apparel).toBeChecked();
    await expect(page.getByTestId('collection-result-count')).toHaveText('1 product');
    await expect(page.getByTestId('collection-product-prod-cloud-tee')).toBeVisible();
  });

  test('product cards remain actionable and account Link navigates to the reusable security screen', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/collections`);
    await expect(page.getByTestId('collection-result-count')).toHaveText('4 products');

    await page.getByRole('button', { name: 'View Cloud Tee' }).click();
    await expect(page.getByTestId('collection-selected-product')).toContainText('Cloud Tee');
    await expect(page.getByTestId('collection-selected-product')).toContainText('$32.00');

    const securityLink = page.getByRole('link', { name: 'Account security' });
    await expect(securityLink).toBeVisible();
    await securityLink.click();
    await expect(page).toHaveURL(`${STOREFRONT}/conformance/account-verification`);
    await expect(page.getByText('Verify it’s you', { exact: true })).toBeVisible();
  });

  test('collection discovery stays usable at 360px without serious or critical axe findings', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`${STOREFRONT}/conformance/collections`);
    await expect(page.getByTestId('collection-result-count')).toHaveText('4 products');

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

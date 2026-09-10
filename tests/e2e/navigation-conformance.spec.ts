import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test } from '@playwright/test';

const API = 'http://127.0.0.1:8787';
const STOREFRONT = 'http://127.0.0.1:5173';
const RESET_TOKEN = 'qa-reset-token';

async function resetLargeCatalog() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.post('/api/v1/demo/reset', {
    headers: { 'x-demo-reset-token': RESET_TOKEN },
    data: { scenario: 'large-catalog' },
  });
  expect(response.ok()).toBeTruthy();
  await api.dispose();
}

test.describe('BeeUI commerce navigation contracts', () => {
  test.beforeEach(async () => {
    await resetLargeCatalog();
  });

  test('Tabs keep state caller-owned and unmount inactive commerce panels', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/navigation`);

    const tablist = page.getByRole('tablist', { name: 'Commerce surfaces' });
    await expect(tablist).toBeVisible();

    const catalogTab = page.getByRole('tab', { name: 'Catalog' });
    const checkoutTab = page.getByRole('tab', { name: 'Checkout progress' });
    await expect(catalogTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('catalog-panel')).toBeVisible();
    await expect(page.getByTestId('checkout-panel')).toHaveCount(0);

    await checkoutTab.click();
    await expect(checkoutTab).toHaveAttribute('aria-selected', 'true');
    await expect(catalogTab).toHaveAttribute('aria-selected', 'false');
    await expect(page.getByTestId('catalog-panel')).toHaveCount(0);
    await expect(page.getByTestId('checkout-panel')).toBeVisible();

    await catalogTab.click();
    await expect(page.getByTestId('catalog-panel')).toBeVisible();
  });

  test('Pagination drives real server pages and Link/Breadcrumb keep routing app-owned', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/navigation`);
    await expect(page.getByText(/Page 1 of \d+ · \d+ products/)).toBeVisible();

    const next = page.getByRole('button', { name: 'Next page' });
    await expect(next).toBeEnabled();
    await next.click();
    await expect(page.getByText(/Page 2 of \d+ · \d+ products/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: 'Previous page' })).toBeEnabled();

    const detailLink = page.getByRole('link', { name: /^View .+ details$/ }).first();
    const detailLabel = await detailLink.getAttribute('aria-label');
    const productTitle = detailLabel?.replace(/^View /, '').replace(/ details$/, '') ?? '';
    expect(productTitle).not.toBe('');
    await detailLink.click();

    await expect(page.getByRole('link', { name: 'Catalog' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to catalog results' })).toBeVisible();
    await expect(page.getByText(productTitle, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: productTitle })).toHaveCount(0);

    await page.getByRole('link', { name: 'Catalog' }).click();
    await expect(page.getByText(/Page 2 of \d+ · \d+ products/)).toBeVisible();
  });

  test('Stepper exposes caller-owned checkout progress and the route has no serious/critical axe violations', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/navigation`);
    await page.getByRole('tab', { name: 'Checkout progress' }).click();

    const cart = page.getByRole('button', { name: 'Cart' });
    const delivery = page.getByRole('button', { name: 'Delivery' });
    const review = page.getByRole('button', { name: 'Review' });

    await expect(cart).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('checkout-step-summary')).toHaveText('Current application-owned step: 1');

    await delivery.click();
    await expect(delivery).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('checkout-step-summary')).toHaveText('Current application-owned step: 2');

    await review.click();
    await expect(review).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('checkout-step-summary')).toHaveText('Current application-owned step: 3');

    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  });
});

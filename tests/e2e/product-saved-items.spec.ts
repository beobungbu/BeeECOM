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

async function wishlist() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.get('/api/v1/wishlist/cust-ava');
  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as { ok: true; data: { productIds: string[] } };
  await api.dispose();
  return payload.data;
}

async function cart() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.get('/api/v1/cart/cart-ava');
  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as {
    ok: true;
    data: { lines: Array<{ productId: string; quantity: number }> };
  };
  await api.dispose();
  return payload.data;
}

async function attachFullPage(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' }),
    contentType: 'image/png',
  });
}

test.describe('Saved items product flow', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('collection selection can save a product and the state persists after reload', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/collections`);
    await page.getByLabel('View Cloud Tee').click();
    await page.getByRole('button', { name: 'Save Cloud Tee for later' }).click();
    await expect(page.getByTestId('collection-saved-notice')).toContainText('Cloud Tee saved for later.');

    const persisted = await wishlist();
    expect(persisted.productIds).toContain('prod-cloud-tee');

    await page.reload();
    await page.getByLabel('View Cloud Tee').click();
    await expect(page.getByRole('button', { name: 'Remove Cloud Tee from saved items' })).toBeVisible();

    await page.getByRole('link', { name: 'View saved items' }).click();
    await expect(page).toHaveURL(`${STOREFRONT}/conformance/saved-items`);
    await expect(page.getByTestId('saved-item-prod-cloud-tee')).toContainText('Cloud Tee');
  });

  test('removing the seeded saved item persists and reaches the empty state', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/saved-items`);
    await expect(page.getByTestId('saved-item-prod-field-pack')).toContainText('Field Pack');
    await page.getByRole('button', { name: 'Remove Field Pack from saved items' }).click();
    await expect(page.getByTestId('saved-items-notice')).toContainText('Field Pack removed from saved items.');
    await expect(page.getByText('Nothing saved yet', { exact: true })).toBeVisible();

    expect((await wishlist()).productIds).not.toContain('prod-field-pack');
    await page.reload();
    await expect(page.getByText('Nothing saved yet', { exact: true })).toBeVisible();
  });

  test('saved product can be added to the canonical cart without leaving saved items', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/saved-items`);
    await page.getByRole('button', { name: 'Add Field Pack to cart' }).click();
    await expect(page.getByTestId('saved-items-notice')).toContainText('Field Pack added to cart.');

    const persistedCart = await cart();
    expect(persistedCart.lines.some((line) => line.productId === 'prod-field-pack' && line.quantity >= 1)).toBe(true);
    expect((await wishlist()).productIds).toContain('prod-field-pack');
  });

  test('Account Hub exposes saved-items management as a real navigation path', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/account`);
    await page.getByRole('link', { name: 'Manage saved' }).click();
    await expect(page).toHaveURL(`${STOREFRONT}/conformance/saved-items`);
    await expect(page.getByText('Saved items', { exact: true }).first()).toBeVisible();
  });

  test('saved items remains accessible at 390px and produces visual evidence', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${STOREFRONT}/conformance/saved-items`);
    await expect(page.getByTestId('saved-item-prod-field-pack')).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
    await attachFullPage(page, testInfo, 'saved-items-mobile');
  });

  test('desktop saved items produces product-quality visual evidence', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${STOREFRONT}/conformance/saved-items`);
    await expect(page.getByTestId('saved-item-prod-field-pack')).toBeVisible();
    await attachFullPage(page, testInfo, 'saved-items-desktop');
  });
});

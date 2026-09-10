import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test } from '@playwright/test';

const API = 'http://127.0.0.1:8787';
const STOREFRONT = 'http://127.0.0.1:5173';
const RESET_TOKEN = 'qa-reset-token';
const PRODUCT_ID = 'prod-cloud-tee';
const VARIANT_ID = 'var-cloud-black-s';

async function resetHealthy() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.post('/api/v1/demo/reset', {
    headers: { 'x-demo-reset-token': RESET_TOKEN },
    data: { scenario: 'healthy' },
  });
  expect(response.ok()).toBeTruthy();
  await api.dispose();
}

async function wishlistProductIds(): Promise<string[]> {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.get('/api/v1/wishlist/cust-ava');
  expect(response.ok()).toBeTruthy();
  const body = await response.json() as { ok: true; data: { productIds: string[] } };
  await api.dispose();
  return body.data.productIds;
}

async function cartVariantQuantity(): Promise<number> {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.get('/api/v1/cart/cart-ava');
  expect(response.ok()).toBeTruthy();
  const body = await response.json() as {
    ok: true;
    data: { lines: Array<{ variantId: string; quantity: number }> };
  };
  await api.dispose();
  return body.data.lines.find((line) => line.variantId === VARIANT_ID)?.quantity ?? 0;
}

test.describe('BeeUI layout and action composition in a real product detail flow', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('AppHeader, Section, structural Separator and BottomActionBar survive a narrow storefront', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`${STOREFRONT}/conformance/layout-actions`);

    await expect(page.getByRole('heading', { name: 'Cloud Tee' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Product details' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Selected variant' })).toBeVisible();
    await expect(page.getByRole('separator')).toHaveCount(1);
    await expect(page.getByTestId('product-bottom-action-bar')).toBeVisible();
    await expect(page.getByText('Black / S')).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  });

  test('IconButton exposes its required accessible name and persists wishlist membership', async ({ page }) => {
    expect(await wishlistProductIds()).not.toContain(PRODUCT_ID);

    await page.goto(`${STOREFRONT}/conformance/layout-actions`);
    const add = page.getByRole('button', { name: 'Add Cloud Tee to wishlist' });
    await expect(add).toBeVisible();
    await add.click();

    const remove = page.getByRole('button', { name: 'Remove Cloud Tee from wishlist' });
    await expect(remove).toBeVisible();
    expect(await wishlistProductIds()).toContain(PRODUCT_ID);

    await remove.click();
    await expect(page.getByRole('button', { name: 'Add Cloud Tee to wishlist' })).toBeVisible();
    expect(await wishlistProductIds()).not.toContain(PRODUCT_ID);
  });

  test('BottomActionBar action persists the selected variant into the canonical cart', async ({ page }) => {
    expect(await cartVariantQuantity()).toBe(1);

    await page.goto(`${STOREFRONT}/conformance/layout-actions`);
    await expect(page.getByTestId('cart-quantity')).toHaveText('Cart quantity: 1');
    await page.getByRole('button', { name: 'Add to cart' }).click();

    await expect(page.getByTestId('cart-quantity')).toHaveText('Cart quantity: 2');
    expect(await cartVariantQuantity()).toBe(2);
  });
});

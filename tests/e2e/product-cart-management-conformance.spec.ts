import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test, type Page, type TestInfo } from '@playwright/test';

const API = 'http://127.0.0.1:8787';
const STOREFRONT = 'http://127.0.0.1:5173';
const RESET_TOKEN = 'qa-reset-token';
const CART_ID = 'cart-ava';
const LINE_ID = 'cartline-ava-1';

async function resetHealthy() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.post('/api/v1/demo/reset', {
    headers: { 'x-demo-reset-token': RESET_TOKEN },
    data: { scenario: 'healthy' },
  });
  expect(response.ok()).toBeTruthy();
  await api.dispose();
}

async function getCart() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.get(`/api/v1/cart/${CART_ID}`);
  expect(response.ok()).toBeTruthy();
  const body = await response.json() as {
    ok: true;
    data: {
      couponCode?: string;
      lines: Array<{ id: string; quantity: number }>;
    };
  };
  await api.dispose();
  return body.data;
}

async function attachFullPage(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' }),
    contentType: 'image/png',
  });
}

test.describe('Customer cart management', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('Storefront cart links to the dedicated management surface', async ({ page }) => {
    await page.goto(STOREFRONT);
    await expect(page.getByText('Cart', { exact: true })).toBeVisible();
    const manage = page.getByRole('button', { name: 'Manage cart' });
    await expect(manage).toBeVisible();
    await manage.click();
    await expect(page).toHaveURL(`${STOREFRONT}/conformance/cart`);
    await expect(page.getByText('Your cart', { exact: true })).toBeVisible();
  });

  test('quantity updates persist through D1 and survive reload', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/cart`);
    const quantity = page.getByTestId(`cart-quantity-${LINE_ID}`);
    await expect(quantity).toHaveText('Quantity 1');

    await page.getByRole('button', { name: 'Increase Cloud Tee quantity' }).click();
    await expect(quantity).toHaveText('Quantity 2');
    await expect(page.getByTestId('cart-notice')).toContainText('Cart quantity updated.');

    expect((await getCart()).lines.find((line) => line.id === LINE_ID)?.quantity).toBe(2);
    await page.reload();
    await expect(page.getByTestId(`cart-quantity-${LINE_ID}`)).toHaveText('Quantity 2');

    await page.getByRole('button', { name: 'Decrease Cloud Tee quantity' }).click();
    await expect(page.getByTestId(`cart-quantity-${LINE_ID}`)).toHaveText('Quantity 1');
    expect((await getCart()).lines.find((line) => line.id === LINE_ID)?.quantity).toBe(1);
  });

  test('API rejects invalid, over-stock and missing-line updates without mutating the cart', async () => {
    const api = await playwrightRequest.newContext({ baseURL: API });

    const invalid = await api.patch(`/api/v1/cart/${CART_ID}/lines/${LINE_ID}`, { data: { quantity: 0 } });
    expect(invalid.status()).toBe(400);
    expect((await invalid.json() as { ok: false; error: { code: string } }).error.code).toBe('INVALID_QUANTITY');

    const overStock = await api.patch(`/api/v1/cart/${CART_ID}/lines/${LINE_ID}`, { data: { quantity: 19 } });
    expect(overStock.status()).toBe(409);
    expect((await overStock.json() as { ok: false; error: { code: string } }).error.code).toBe('INSUFFICIENT_STOCK');

    const missing = await api.patch(`/api/v1/cart/${CART_ID}/lines/missing-line`, { data: { quantity: 2 } });
    expect(missing.status()).toBe(404);
    expect((await missing.json() as { ok: false; error: { code: string } }).error.code).toBe('CART_LINE_NOT_FOUND');
    await api.dispose();

    const persisted = await getCart();
    expect(persisted.lines.find((line) => line.id === LINE_ID)?.quantity).toBe(1);
  });

  test('coupon application recomputes totals and survives reload', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/cart`);
    const totals = page.getByTestId('cart-totals');
    await expect(totals).toContainText('Subtotal$32.00');
    await expect(totals).toContainText('Discount−$0.00');
    await expect(totals).toContainText('Total$43.56');

    const coupon = page.getByRole('textbox', { name: 'Coupon code' });
    await coupon.fill('WELCOME10');
    await page.getByRole('button', { name: 'Apply coupon' }).click();
    await expect(page.getByText('Applied: WELCOME10', { exact: true })).toBeVisible();
    await expect(totals).toContainText('Discount−$3.20');
    await expect(totals).toContainText('Total$40.10');
    expect((await getCart()).couponCode).toBe('WELCOME10');

    await page.reload();
    await expect(page.getByText('Applied: WELCOME10', { exact: true })).toBeVisible();
    await expect(page.getByTestId('cart-totals')).toContainText('Total$40.10');

    await page.getByRole('button', { name: 'Remove coupon' }).click();
    await expect(page.getByText('Applied: WELCOME10', { exact: true })).toHaveCount(0);
    expect((await getCart()).couponCode).toBeUndefined();
  });

  test('removal requires explicit AlertDialog confirmation and persists an empty cart', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/cart`);
    const line = page.getByTestId(`cart-line-${LINE_ID}`);
    await expect(line).toBeVisible();

    const trigger = page.getByRole('button', { name: 'Remove Cloud Tee' });
    await trigger.click();
    const dialog = page.getByRole('dialog').filter({ hasText: 'Remove Cloud Tee from your cart?' });
    await expect(dialog).toBeVisible();
    const cancel = dialog.getByRole('button', { name: 'Keep item' });
    await expect(cancel).toBeFocused();
    await cancel.click();
    await expect(dialog).toBeHidden();
    await expect(line).toBeVisible();
    expect((await getCart()).lines).toHaveLength(1);

    await trigger.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Remove item' }).click();
    await expect(page.getByTestId('cart-empty-state')).toBeVisible();
    await expect(page.getByTestId('cart-notice')).toContainText('Cloud Tee removed from your cart.');
    expect((await getCart()).lines).toHaveLength(0);

    await page.reload();
    await expect(page.getByTestId('cart-empty-state')).toBeVisible();
    await expect(page.getByTestId(`cart-line-${LINE_ID}`)).toHaveCount(0);
  });

  test('cart remains usable at 390px without serious or critical axe findings', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${STOREFRONT}/conformance/cart`);
    await expect(page.getByTestId(`cart-line-${LINE_ID}`)).toBeVisible();
    await expect(page.getByTestId('cart-order-summary')).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
    await attachFullPage(page, testInfo, 'customer-cart-mobile');
  });

  test('desktop cart produces product-quality visual evidence', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${STOREFRONT}/conformance/cart`);
    await expect(page.getByTestId(`cart-line-${LINE_ID}`)).toBeVisible();
    await expect(page.getByTestId('cart-order-summary')).toBeVisible();
    await attachFullPage(page, testInfo, 'customer-cart-desktop');
  });
});

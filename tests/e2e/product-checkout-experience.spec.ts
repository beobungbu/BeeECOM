import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test, type Page, type TestInfo } from '@playwright/test';

const API = 'http://127.0.0.1:8787';
const STOREFRONT = 'http://127.0.0.1:5173';
const RESET_TOKEN = 'qa-reset-token';
const CART_ID = 'cart-ava';

async function resetHealthy() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.post('/api/v1/demo/reset', {
    headers: { 'x-demo-reset-token': RESET_TOKEN },
    data: { scenario: 'healthy' },
  });
  expect(response.ok()).toBeTruthy();
  await api.dispose();
}

async function cart() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.get(`/api/v1/cart/${CART_ID}`);
  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as { ok: true; data: { lines: Array<{ id: string }> } };
  await api.dispose();
  return payload.data;
}

async function customerOrders() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.get('/api/v1/orders?customerId=cust-ava&pageSize=100');
  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as {
    ok: true;
    data: { items: Array<{ id: string; paymentState: string; fulfillmentState: string; shippingMethod?: string; paymentMethod?: string; shipping: { amount: number }; total: { amount: number } }> };
  };
  await api.dispose();
  return payload.data.items;
}

async function attachFullPage(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' }),
    contentType: 'image/png',
  });
}

test.describe('Product checkout experience', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('cart continues into the dedicated checkout experience', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/cart`);
    await page.getByRole('button', { name: 'Continue to checkout' }).click();
    await expect(page).toHaveURL(`${STOREFRONT}/conformance/checkout`);
    await expect(page.getByText('Checkout', { exact: true })).toBeVisible();
    await expect(page.getByTestId('checkout-order-review')).toBeVisible();
  });

  test('shipping choice recomputes the review total and confirmation gates submission', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/checkout`);
    const placeOrder = page.getByRole('button', { name: 'Place order' });
    await expect(placeOrder).toBeDisabled();
    await expect(page.getByTestId('checkout-totals')).toContainText('$9.00');
    await expect(page.getByTestId('checkout-totals')).toContainText('$43.56');

    await page.getByRole('radio', { name: 'Express delivery — $18.00' }).click();
    await expect(page.getByTestId('checkout-totals')).toContainText('$18.00');
    await expect(page.getByTestId('checkout-totals')).toContainText('$52.56');

    await page.getByRole('checkbox', { name: 'I confirm my delivery, payment and order details' }).click();
    await expect(placeOrder).toBeEnabled();
  });

  test('express wallet checkout persists method metadata, empties cart and survives through the orders API', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/checkout`);
    await page.getByRole('radio', { name: 'Express delivery — $18.00' }).click();
    await page.getByRole('radio', { name: 'Wallet' }).click();
    await page.getByRole('checkbox', { name: 'I confirm my delivery, payment and order details' }).click();
    await page.getByRole('button', { name: 'Place order' }).click();

    const success = page.getByTestId('checkout-success');
    await expect(success).toBeVisible();
    await expect(success).toContainText('Express delivery');
    await expect(success).toContainText('Wallet');
    await expect(success).toContainText('$52.56');
    expect((await cart()).lines).toHaveLength(0);

    const created = (await customerOrders()).find((order) => order.shippingMethod === 'express' && order.paymentMethod === 'wallet');
    expect(created).toMatchObject({
      paymentState: 'paid',
      fulfillmentState: 'unfulfilled',
      shippingMethod: 'express',
      paymentMethod: 'wallet',
      shipping: { amount: 1800 },
      total: { amount: 5256 },
    });

    await page.getByRole('button', { name: 'View order' }).click();
    await expect(page).toHaveURL(new RegExp('/conformance/orders/order-'));
    await expect(page.getByText('paid', { exact: true })).toBeVisible();
  });

  test('invalid methods and an unknown delivery address are rejected without mutating the cart', async () => {
    const api = await playwrightRequest.newContext({ baseURL: API });

    const invalidShipping = await api.post('/api/v1/checkout', {
      data: { cartId: CART_ID, addressId: 'addr-ava-home', shippingMethod: 'overnight', paymentMethod: 'card' },
    });
    expect(invalidShipping.status()).toBe(400);
    expect((await invalidShipping.json() as { ok: false; error: { code: string } }).error.code).toBe('INVALID_SHIPPING_METHOD');

    const invalidPayment = await api.post('/api/v1/checkout', {
      data: { cartId: CART_ID, addressId: 'addr-ava-home', shippingMethod: 'standard', paymentMethod: 'crypto' },
    });
    expect(invalidPayment.status()).toBe(400);
    expect((await invalidPayment.json() as { ok: false; error: { code: string } }).error.code).toBe('INVALID_PAYMENT_METHOD');

    const missingAddress = await api.post('/api/v1/checkout', {
      data: { cartId: CART_ID, addressId: 'addr-not-owned', shippingMethod: 'standard', paymentMethod: 'card' },
    });
    expect(missingAddress.status()).toBe(404);
    expect((await missingAddress.json() as { ok: false; error: { code: string } }).error.code).toBe('ADDRESS_NOT_FOUND');
    await api.dispose();

    expect((await cart()).lines).toHaveLength(1);
  });

  test('failed simulated payment persists the selected methods and leaves the cart recoverable', async () => {
    const api = await playwrightRequest.newContext({ baseURL: API });
    const response = await api.post('/api/v1/checkout', {
      data: {
        cartId: CART_ID,
        addressId: 'addr-ava-home',
        shippingMethod: 'express',
        paymentMethod: 'wallet',
        paymentScenario: 'failure',
      },
    });
    expect(response.status()).toBe(201);
    const payload = await response.json() as {
      ok: true;
      data: { id: string; paymentState: string; fulfillmentState: string; shippingMethod: string; paymentMethod: string; shipping: { amount: number } };
    };
    expect(payload.data).toMatchObject({
      paymentState: 'failed',
      fulfillmentState: 'unfulfilled',
      shippingMethod: 'express',
      paymentMethod: 'wallet',
      shipping: { amount: 1800 },
    });
    await api.dispose();
    expect((await cart()).lines).toHaveLength(1);
  });

  test('checkout remains usable and accessible at 390px', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${STOREFRONT}/conformance/checkout`);
    await expect(page.getByTestId('checkout-order-review')).toBeVisible();
    await page.getByRole('radio', { name: 'Express delivery — $18.00' }).click();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
    await attachFullPage(page, testInfo, 'checkout-mobile');
  });

  test('desktop checkout produces product-quality visual evidence', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${STOREFRONT}/conformance/checkout`);
    await expect(page.getByTestId('checkout-order-review')).toBeVisible();
    await attachFullPage(page, testInfo, 'checkout-desktop');
  });
});

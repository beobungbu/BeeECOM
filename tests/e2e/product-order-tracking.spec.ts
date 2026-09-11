import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test, type Page, type TestInfo } from '@playwright/test';

const API = 'http://127.0.0.1:8787';
const STOREFRONT = 'http://127.0.0.1:5173';
const RESET_TOKEN = 'qa-reset-token';
const ORDER_ID = 'order-1001';

async function resetScenario(scenario: string) {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.post('/api/v1/demo/reset', {
    headers: { 'x-demo-reset-token': RESET_TOKEN },
    data: { scenario },
  });
  expect(response.ok()).toBeTruthy();
  await api.dispose();
}

async function deliverOrder(orderId = ORDER_ID) {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.patch(`/api/v1/admin/orders/${orderId}`, {
    data: { action: 'deliver' },
  });
  expect(response.ok()).toBeTruthy();
  await api.dispose();
}

async function checkoutExpressWallet() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.post('/api/v1/checkout', {
    data: {
      cartId: 'cart-ava',
      addressId: 'addr-ava-home',
      shippingMethod: 'express',
      paymentMethod: 'wallet',
    },
  });
  expect(response.status()).toBe(201);
  const payload = await response.json() as {
    ok: true;
    data: { id: string; number: string };
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

test.describe('Product order tracking', () => {
  test.beforeEach(async () => {
    await resetScenario('healthy');
  });

  test('shipped order presents a truthful persisted timeline and withholds post-delivery actions', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/orders/${ORDER_ID}`);

    const timeline = page.getByTestId('order-progress-timeline');
    await expect(timeline).toBeVisible();
    await expect(timeline).toContainText('Order placed');
    await expect(timeline).toContainText('Payment confirmed');
    await expect(timeline).toContainText('On the way');
    await expect(timeline).toContainText('Payment status: paid');

    const summary = page.getByTestId('order-detail-summary');
    await expect(summary).toContainText('Delivery method');
    await expect(summary).toContainText('Payment method');
    await expect(summary).toContainText('Not recorded');

    await expect(page.getByRole('button', { name: 'Review Field Pack' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Start a return for order #1001' })).toHaveCount(0);
  });

  test('checkout-created order carries Express and Wallet metadata into the order detail timeline', async ({ page }) => {
    const created = await checkoutExpressWallet();
    await page.goto(`${STOREFRONT}/conformance/orders/${encodeURIComponent(created.id)}`);

    await expect(page.getByText(`Order ${created.number}`, { exact: true })).toBeVisible();
    await expect(page.getByTestId('order-detail-summary')).toContainText('Express delivery');
    await expect(page.getByTestId('order-detail-summary')).toContainText('Wallet');
    await expect(page.getByTestId('order-progress-timeline')).toContainText('Payment confirmed');
    await expect(page.getByTestId('order-progress-timeline')).toContainText('Fulfillment pending');
    await expect(page.getByTestId('order-progress-timeline')).toContainText('Wallet');
  });

  test('delivered transition unlocks review and return actions and updates the timeline', async ({ page }) => {
    await deliverOrder();
    await page.goto(`${STOREFRONT}/conformance/orders/${ORDER_ID}`);

    await expect(page.getByTestId('order-progress-timeline')).toContainText('Delivered');
    await expect(page.getByTestId('order-progress-timeline')).toContainText('Delivered to San Francisco, CA.');
    await expect(page.getByRole('button', { name: 'Review Field Pack' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start a return for order #1001' })).toBeVisible();
  });

  test('processing scenario renders preparation state without inventing carrier or ETA data', async ({ page }) => {
    await resetScenario('delayed-shipment');
    await page.goto(`${STOREFRONT}/conformance/orders/${ORDER_ID}`);

    const timeline = page.getByTestId('order-progress-timeline');
    await expect(timeline).toContainText('Preparing your order');
    await expect(timeline).toContainText('Your items are being prepared for shipment.');
    await expect(timeline).not.toContainText(/tracking number|carrier|estimated delivery/i);
    await expect(page.getByRole('button', { name: 'Review Field Pack' })).toHaveCount(0);
  });

  test('order tracking remains readable at 390px with no serious or critical axe findings', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${STOREFRONT}/conformance/orders/${ORDER_ID}`);
    await expect(page.getByTestId('order-progress-card')).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);

    await attachFullPage(page, testInfo, 'order-tracking-mobile');
  });

  test('delivered desktop order detail produces product-quality visual evidence', async ({ page }, testInfo) => {
    await deliverOrder();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${STOREFRONT}/conformance/orders/${ORDER_ID}`);
    await expect(page.getByTestId('order-progress-timeline')).toContainText('Delivered');
    await attachFullPage(page, testInfo, 'order-tracking-desktop-delivered');
  });
});

import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test, type Page, type TestInfo } from '@playwright/test';

const API = 'http://127.0.0.1:8787';
const STOREFRONT = 'http://127.0.0.1:5173';
const RESET_TOKEN = 'qa-reset-token';
const ORDER_ID = 'order-1001';

async function reset(scenario: 'healthy' | 'payment-failed') {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.post('/api/v1/demo/reset', {
    headers: { 'x-demo-reset-token': RESET_TOKEN },
    data: { scenario },
  });
  expect(response.ok()).toBeTruthy();
  await api.dispose();
}

async function getOrder() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.get(`/api/v1/orders/${ORDER_ID}`);
  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as {
    ok: true;
    data: {
      id: string;
      state: string;
      paymentState: string;
      fulfillmentState: string;
      customerId: string;
    };
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

test.describe('Customer failed payment recovery', () => {
  test.beforeEach(async () => {
    await reset('payment-failed');
  });

  test('payment-failed scenario exposes the retryable order state', async () => {
    expect(await getOrder()).toMatchObject({
      id: ORDER_ID,
      customerId: 'cust-ava',
      state: 'placed',
      paymentState: 'failed',
      fulfillmentState: 'unfulfilled',
    });
  });

  test('API enforces ownership and retry state without mutating rejected requests', async () => {
    const api = await playwrightRequest.newContext({ baseURL: API });

    const wrongOwner = await api.post(`/api/v1/orders/${ORDER_ID}/retry-payment`, {
      data: { customerId: 'cust-minh', outcome: 'success' },
    });
    expect(wrongOwner.status()).toBe(403);
    expect((await wrongOwner.json() as { ok: false; error: { code: string } }).error.code).toBe('ORDER_OWNERSHIP_REQUIRED');
    expect(await getOrder()).toMatchObject({ paymentState: 'failed', fulfillmentState: 'unfulfilled' });

    const invalidOutcome = await api.post(`/api/v1/orders/${ORDER_ID}/retry-payment`, {
      data: { customerId: 'cust-ava', outcome: 'unsupported' },
    });
    expect(invalidOutcome.status()).toBe(400);
    expect((await invalidOutcome.json() as { ok: false; error: { code: string } }).error.code).toBe('INVALID_PAYMENT_RETRY');
    expect(await getOrder()).toMatchObject({ paymentState: 'failed', fulfillmentState: 'unfulfilled' });
    await api.dispose();

    await reset('healthy');
    const healthyApi = await playwrightRequest.newContext({ baseURL: API });
    const alreadyPaid = await healthyApi.post(`/api/v1/orders/${ORDER_ID}/retry-payment`, {
      data: { customerId: 'cust-ava', outcome: 'success' },
    });
    expect(alreadyPaid.status()).toBe(409);
    expect((await alreadyPaid.json() as { ok: false; error: { code: string } }).error.code).toBe('ORDER_PAYMENT_CANNOT_RETRY');
    expect(await getOrder()).toMatchObject({ paymentState: 'paid', fulfillmentState: 'shipped' });
    await healthyApi.dispose();
  });

  test('a failed simulated retry remains retryable and persists failed state', async () => {
    const api = await playwrightRequest.newContext({ baseURL: API });
    const retry = await api.post(`/api/v1/orders/${ORDER_ID}/retry-payment`, {
      data: { customerId: 'cust-ava', outcome: 'failure' },
    });
    expect(retry.ok()).toBeTruthy();
    const payload = await retry.json() as { ok: true; data: { paymentState: string; fulfillmentState: string } };
    expect(payload.data).toMatchObject({ paymentState: 'failed', fulfillmentState: 'unfulfilled' });
    await api.dispose();

    expect(await getOrder()).toMatchObject({ paymentState: 'failed', fulfillmentState: 'unfulfilled' });
  });

  test('customer retries payment successfully and recovered state survives reload', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/orders/${ORDER_ID}`);

    await expect(page.getByText('failed', { exact: true })).toBeVisible();
    const recovery = page.getByTestId('order-payment-recovery');
    await expect(recovery).toBeVisible();
    await expect(page.getByTestId('order-cancel-action')).toHaveCount(0);

    const retry = page.getByRole('button', { name: 'Retry payment for order #1001' });
    await retry.click();

    await expect(page.getByTestId('order-notice')).toContainText('Payment confirmed for order #1001.');
    await expect(page.getByText('paid', { exact: true })).toBeVisible();
    await expect(page.getByTestId('order-payment-recovery')).toHaveCount(0);
    await expect(page.getByTestId('order-cancel-action')).toBeVisible();
    expect(await getOrder()).toMatchObject({ state: 'placed', paymentState: 'paid', fulfillmentState: 'unfulfilled' });

    await page.reload();
    await expect(page.getByText('paid', { exact: true })).toBeVisible();
    await expect(page.getByTestId('order-payment-recovery')).toHaveCount(0);
    await expect(page.getByTestId('order-cancel-action')).toBeVisible();
  });

  test('payment recovery remains usable at 390px without serious or critical axe findings', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${STOREFRONT}/conformance/orders/${ORDER_ID}`);
    await expect(page.getByTestId('order-payment-recovery')).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
    await attachFullPage(page, testInfo, 'customer-payment-recovery-mobile');
  });

  test('desktop payment recovery produces product-quality visual evidence', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${STOREFRONT}/conformance/orders/${ORDER_ID}`);
    await expect(page.getByTestId('order-payment-recovery')).toBeVisible();
    await attachFullPage(page, testInfo, 'customer-payment-recovery-desktop');
  });
});

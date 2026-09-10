import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test, type Page, type TestInfo } from '@playwright/test';

const API = 'http://127.0.0.1:8787';
const STOREFRONT = 'http://127.0.0.1:5173';
const RESET_TOKEN = 'qa-reset-token';
const ORDER_ID = 'order-1001';

async function reset(scenario: 'healthy' | 'cancellation-eligible') {
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

test.describe('Customer order cancellation', () => {
  test('named scenario exposes a paid placed order before fulfillment', async () => {
    await reset('cancellation-eligible');
    expect(await getOrder()).toMatchObject({
      id: ORDER_ID,
      customerId: 'cust-ava',
      state: 'placed',
      paymentState: 'paid',
      fulfillmentState: 'unfulfilled',
    });

    const api = await playwrightRequest.newContext({ baseURL: API });
    const scenarios = await api.get('/api/v1/demo/scenarios');
    expect(scenarios.ok()).toBeTruthy();
    const payload = await scenarios.json() as { ok: true; data: string[] };
    expect(payload.data).toContain('cancellation-eligible');
    await api.dispose();
  });

  test('API enforces ownership and cancellation window without mutating rejected orders', async () => {
    await reset('cancellation-eligible');
    const api = await playwrightRequest.newContext({ baseURL: API });

    const wrongOwner = await api.post(`/api/v1/orders/${ORDER_ID}/cancel`, {
      data: { customerId: 'cust-minh', reason: 'Ordered by mistake' },
    });
    expect(wrongOwner.status()).toBe(403);
    expect((await wrongOwner.json() as { ok: false; error: { code: string } }).error.code).toBe('ORDER_OWNERSHIP_REQUIRED');
    expect(await getOrder()).toMatchObject({ state: 'placed', paymentState: 'paid', fulfillmentState: 'unfulfilled' });

    const shortReason = await api.post(`/api/v1/orders/${ORDER_ID}/cancel`, {
      data: { customerId: 'cust-ava', reason: 'no' },
    });
    expect(shortReason.status()).toBe(400);
    expect((await shortReason.json() as { ok: false; error: { code: string } }).error.code).toBe('INVALID_CANCELLATION_REASON');
    expect(await getOrder()).toMatchObject({ state: 'placed', paymentState: 'paid', fulfillmentState: 'unfulfilled' });
    await api.dispose();

    await reset('healthy');
    const healthyApi = await playwrightRequest.newContext({ baseURL: API });
    const shipped = await healthyApi.post(`/api/v1/orders/${ORDER_ID}/cancel`, {
      data: { customerId: 'cust-ava', reason: 'Ordered by mistake' },
    });
    expect(shipped.status()).toBe(409);
    expect((await shipped.json() as { ok: false; error: { code: string } }).error.code).toBe('ORDER_CANNOT_CANCEL');
    expect(await getOrder()).toMatchObject({ state: 'placed', paymentState: 'paid', fulfillmentState: 'shipped' });
    await healthyApi.dispose();
  });

  test('customer cancellation persists cancelled fulfillment and refunded payment', async ({ page }) => {
    await reset('cancellation-eligible');
    await page.goto(`${STOREFRONT}/conformance/orders/${ORDER_ID}`);

    const cancellation = page.getByTestId('order-cancel-action');
    await expect(cancellation).toBeVisible();
    const reason = page.getByRole('textbox', { name: 'Cancellation reason' });
    await reason.fill('No longer needed for this trip');

    const trigger = page.getByRole('button', { name: 'Cancel order #1001' });
    await trigger.click();
    const dialog = page.getByRole('dialog').filter({ hasText: 'Cancel order #1001?' });
    await expect(dialog).toBeVisible();
    const keep = dialog.getByRole('button', { name: 'Keep order' });
    await expect(keep).toBeFocused();
    await keep.click();
    await expect(dialog).toBeHidden();
    expect(await getOrder()).toMatchObject({ state: 'placed', paymentState: 'paid', fulfillmentState: 'unfulfilled' });

    await trigger.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Confirm cancellation' }).click();
    await expect(page.getByTestId('order-notice')).toContainText('Order #1001 cancelled.');
    await expect(page.getByText('refunded', { exact: true })).toBeVisible();
    await expect(page.getByText('cancelled', { exact: true })).toBeVisible();
    await expect(page.getByTestId('order-cancel-action')).toHaveCount(0);

    expect(await getOrder()).toMatchObject({
      state: 'cancelled',
      paymentState: 'refunded',
      fulfillmentState: 'cancelled',
    });

    await page.reload();
    await expect(page.getByText('refunded', { exact: true })).toBeVisible();
    await expect(page.getByText('cancelled', { exact: true })).toBeVisible();
    await expect(page.getByTestId('order-cancel-action')).toHaveCount(0);
  });

  test('cancellation UI is absent once fulfillment has shipped', async ({ page }) => {
    await reset('healthy');
    await page.goto(`${STOREFRONT}/conformance/orders/${ORDER_ID}`);
    await expect(page.getByText('shipped', { exact: true })).toBeVisible();
    await expect(page.getByTestId('order-cancel-action')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cancel order #1001' })).toHaveCount(0);
  });

  test('cancellation detail remains usable at 390px without serious or critical axe findings', async ({ page }, testInfo) => {
    await reset('cancellation-eligible');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${STOREFRONT}/conformance/orders/${ORDER_ID}`);
    await expect(page.getByTestId('order-cancel-action')).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
    await attachFullPage(page, testInfo, 'customer-order-cancellation-mobile');
  });

  test('desktop cancellation detail produces product-quality visual evidence', async ({ page }, testInfo) => {
    await reset('cancellation-eligible');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${STOREFRONT}/conformance/orders/${ORDER_ID}`);
    await expect(page.getByTestId('order-cancel-action')).toBeVisible();
    await attachFullPage(page, testInfo, 'customer-order-cancellation-desktop');
  });
});

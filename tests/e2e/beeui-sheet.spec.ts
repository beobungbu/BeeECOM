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

async function expectFocusInsideSheet(page: import('@playwright/test').Page) {
  await expect.poll(async () => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true);
}

test.describe('BeeUI Sheet external-consumer contract', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('controlled cart Sheet traps focus, dismisses implicitly and restores trigger focus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 720 });
    await page.goto(`${STOREFRONT}/conformance/cart-sheet`);
    await expect(page.getByText('Cart Sheet acceptance')).toBeVisible();

    const trigger = page.getByRole('button', { name: 'Review cart in Sheet' });
    await trigger.click();

    const sheet = page.getByRole('dialog').filter({ hasText: 'Cart summary' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Cart summary', { exact: true })).toBeVisible();
    await expect(sheet.getByText('Total', { exact: false }).last()).toBeVisible();
    await expectFocusInsideSheet(page);

    for (let index = 0; index < 5; index += 1) {
      await page.keyboard.press('Tab');
      await expectFocusInsideSheet(page);
    }

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(sheet).toBeVisible();
    await page.getByTestId('cart-sheet-backdrop').click({ position: { x: 4, y: 4 } });
    await expect(sheet).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('checkout from the Sheet closes controlled state and persists the order in D1', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/cart-sheet`);
    const trigger = page.getByRole('button', { name: 'Review cart in Sheet' });
    await trigger.click();

    const sheet = page.getByRole('dialog').filter({ hasText: 'Cart summary' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'Checkout from Sheet' }).click();
    await expect(sheet).toBeHidden();

    const completion = page.getByText(/Sheet checkout complete:/);
    await expect(completion).toBeVisible();
    const completionText = await completion.textContent();
    const orderNumber = completionText?.match(/#\d+/)?.[0];
    expect(orderNumber).toBeTruthy();

    const api = await playwrightRequest.newContext({ baseURL: API });
    const ordersResponse = await api.get('/api/v1/orders?customerId=cust-ava&pageSize=100');
    expect(ordersResponse.ok()).toBeTruthy();
    const orders = await ordersResponse.json() as {
      ok: true;
      data: { items: Array<{ number: string; paymentState: string }> };
    };
    expect(orders.data.items.some((item) => item.number === orderNumber && item.paymentState === 'paid')).toBeTruthy();

    const cartResponse = await api.get('/api/v1/cart/cart-ava');
    expect(cartResponse.ok()).toBeTruthy();
    const cart = await cartResponse.json() as { ok: true; data: { lines: unknown[] } };
    expect(cart.data.lines).toHaveLength(0);
    await api.dispose();
  });
});

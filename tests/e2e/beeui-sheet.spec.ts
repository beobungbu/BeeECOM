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
    const backdrop = page.getByTestId('cart-sheet-backdrop');
    await expect(backdrop).toBeVisible();

    const geometry = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]') as HTMLElement | null;
      const backdropNode = document.querySelector('[data-testid="cart-sheet-backdrop"]') as HTMLElement | null;
      const host = document.querySelector('[data-testid="beeui-overlay-host"]') as HTMLElement | null;
      const rect = (node: HTMLElement | null) => {
        if (!node) return null;
        const value = node.getBoundingClientRect();
        return {
          x: value.x,
          y: value.y,
          width: value.width,
          height: value.height,
          top: value.top,
          right: value.right,
          bottom: value.bottom,
          left: value.left,
          clientHeight: node.clientHeight,
          scrollHeight: node.scrollHeight,
          computedMaxHeight: getComputedStyle(node).maxHeight,
          computedPosition: getComputedStyle(node).position,
          overflowY: getComputedStyle(node).overflowY,
        };
      };
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight, scrollY: window.scrollY },
        dialog: rect(dialog),
        backdrop: rect(backdropNode),
        host: rect(host),
      };
    });

    console.log('BEEUI_SHEET_GEOMETRY', JSON.stringify(geometry));
    expect(geometry.dialog).not.toBeNull();
    expect(geometry.backdrop).not.toBeNull();
    expect(geometry.host).not.toBeNull();

    // A 55% bottom-sheet snap point must leave a real, pointer-accessible
    // backdrop region inside the current viewport. If this fails, report the
    // host/backdrop/dialog geometry rather than guessing a click coordinate.
    const visibleBackdropAbovePanel = Math.max(
      0,
      Math.min(geometry.viewport.height, geometry.dialog!.top) - Math.max(0, geometry.backdrop!.top),
    );
    expect(visibleBackdropAbovePanel, JSON.stringify(geometry)).toBeGreaterThan(8);

    const clickY = Math.max(4, Math.min(geometry.viewport.height - 4, geometry.dialog!.top / 2));
    await page.mouse.click(8, clickY);
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
    expect(completionText).toBeTruthy();

    const api = await playwrightRequest.newContext({ baseURL: API });
    const ordersResponse = await api.get('/api/v1/orders?customerId=cust-ava&pageSize=100');
    expect(ordersResponse.ok()).toBeTruthy();
    const orders = await ordersResponse.json() as {
      ok: true;
      data: { items: Array<{ id: string; number: string; paymentState: string }> };
    };
    const persistedOrder = orders.data.items.find(
      (item) => item.paymentState === 'paid' && completionText!.includes(item.number),
    );
    expect(persistedOrder).toBeTruthy();

    const orderResponse = await api.get(`/api/v1/orders/${persistedOrder!.id}`);
    expect(orderResponse.ok()).toBeTruthy();
    const order = await orderResponse.json() as { ok: true; data: { number: string; paymentState: string } };
    expect(order.data.number).toBe(persistedOrder!.number);
    expect(order.data.paymentState).toBe('paid');

    const cartResponse = await api.get('/api/v1/cart/cart-ava');
    expect(cartResponse.ok()).toBeTruthy();
    const cart = await cartResponse.json() as { ok: true; data: { lines: unknown[] } };
    expect(cart.data.lines).toHaveLength(0);
    await api.dispose();
  });
});

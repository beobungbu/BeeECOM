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

async function collectSheetGeometry(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement | null;
    const backdrop = document.querySelector('[data-testid="cart-sheet-backdrop"]') as HTMLElement | null;
    const rootOverlayHost = document.querySelector('[data-testid="beeui-overlay-host"]') as HTMLElement | null;

    const describe = (node: HTMLElement | null) => {
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        tag: node.tagName,
        id: node.id,
        testID: node.getAttribute('data-testid'),
        role: node.getAttribute('role'),
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left,
        },
        clientHeight: node.clientHeight,
        scrollHeight: node.scrollHeight,
        offsetTop: node.offsetTop,
        position: style.position,
        display: style.display,
        height: style.height,
        minHeight: style.minHeight,
        maxHeight: style.maxHeight,
        overflow: style.overflow,
        overflowY: style.overflowY,
        flex: style.flex,
        flexGrow: style.flexGrow,
        flexBasis: style.flexBasis,
        justifyContent: style.justifyContent,
        transform: style.transform,
        translate: style.translate,
        animationName: style.animationName,
        animationDuration: style.animationDuration,
        animationPlayState: style.animationPlayState,
        transitionDuration: style.transitionDuration,
      };
    };

    const ancestors = (start: HTMLElement | null) => {
      const values = [];
      let node: HTMLElement | null = start;
      for (let depth = 0; node && depth < 10; depth += 1) {
        values.push(describe(node));
        node = node.parentElement;
      }
      return values;
    };

    const html = document.documentElement;
    const root = document.getElementById('root');
    return {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        documentClientHeight: html.clientHeight,
        visualViewportHeight: window.visualViewport?.height ?? null,
      },
      document: {
        html: describe(html),
        body: describe(document.body),
        root: describe(root),
      },
      dialog: describe(dialog),
      backdrop: describe(backdrop),
      rootOverlayHost: describe(rootOverlayHost),
      dialogAncestors: ancestors(dialog),
      backdropAncestors: ancestors(backdrop),
    };
  });
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

    const immediateGeometry = await collectSheetGeometry(page);
    console.log('BEEUI_SHEET_GEOMETRY_IMMEDIATE', JSON.stringify(immediateGeometry));

    // RN Web Modal uses a CSS slide animation. Capture both the immediately-visible
    // frame and a settled frame so an animation transform cannot be mistaken for a
    // persistent Sheet layout defect.
    await page.waitForTimeout(700);
    const geometry = await collectSheetGeometry(page);
    console.log('BEEUI_SHEET_GEOMETRY_SETTLED', JSON.stringify(geometry));

    expect(geometry.dialog).not.toBeNull();
    expect(geometry.backdrop).not.toBeNull();

    // A settled 55% bottom-sheet snap point must leave a real, pointer-accessible
    // backdrop region inside the current viewport. If this fails, the diagnostic
    // includes the complete modal ancestor/transform chain.
    const dialogRect = geometry.dialog!.rect;
    const backdropRect = geometry.backdrop!.rect;
    const visibleBackdropAbovePanel = Math.max(
      0,
      Math.min(geometry.viewport.height, dialogRect.top) - Math.max(0, backdropRect.top),
    );
    expect(visibleBackdropAbovePanel, JSON.stringify(geometry)).toBeGreaterThan(8);

    const clickY = Math.max(4, Math.min(geometry.viewport.height - 4, dialogRect.top / 2));
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

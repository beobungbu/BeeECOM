import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test } from '@playwright/test';

const API = 'http://127.0.0.1:8787';
const STOREFRONT = 'http://127.0.0.1:5173';
const ADMIN = 'http://127.0.0.1:5174';
const RESET_TOKEN = 'qa-reset-token';

async function resetScenario(scenario: string) {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.post('/api/v1/demo/reset', {
    headers: { 'x-demo-reset-token': RESET_TOKEN },
    data: { scenario },
  });
  expect(response.ok()).toBeTruthy();
  await api.dispose();
}

async function resetHealthy() {
  await resetScenario('healthy');
}

test.describe('Worker + D1 integration', () => {
  test('protects reset and persists commerce/chat state', async () => {
    const api = await playwrightRequest.newContext({ baseURL: API });

    const health = await api.get('/health');
    expect(health.ok()).toBeTruthy();

    const forbiddenReset = await api.post('/api/v1/demo/reset', { data: { scenario: 'healthy' } });
    expect(forbiddenReset.status()).toBe(403);

    const reset = await api.post('/api/v1/demo/reset', {
      headers: { 'x-demo-reset-token': RESET_TOKEN },
      data: { scenario: 'healthy' },
    });
    expect(reset.ok()).toBeTruthy();

    const catalogResponse = await api.get('/api/v1/catalog/products?pageSize=24&sort=featured');
    expect(catalogResponse.ok()).toBeTruthy();
    const catalog = await catalogResponse.json() as {
      ok: true;
      data: { items: Array<{ id: string; variants: Array<{ id: string; inventoryQuantity: number }> }> };
    };
    const product = catalog.data.items.find((item) => item.variants.some((variant) => variant.inventoryQuantity > 0));
    const variant = product?.variants.find((item) => item.inventoryQuantity > 0);
    expect(product).toBeTruthy();
    expect(variant).toBeTruthy();

    const cartMutation = await api.post('/api/v1/cart/cart-ava/lines', {
      data: { variantId: variant!.id, quantity: 1 },
    });
    expect(cartMutation.ok()).toBeTruthy();

    const coupon = await api.patch('/api/v1/cart/cart-ava/coupon', { data: { code: 'WELCOME10' } });
    expect(coupon.ok()).toBeTruthy();

    const customerResponse = await api.get('/api/v1/customers/cust-ava');
    expect(customerResponse.ok()).toBeTruthy();
    const customer = await customerResponse.json() as {
      ok: true;
      data: { addresses: Array<{ id: string; isDefault?: boolean }> };
    };
    const address = customer.data.addresses.find((item) => item.isDefault) ?? customer.data.addresses[0];
    expect(address).toBeTruthy();

    const checkout = await api.post('/api/v1/checkout', {
      data: { cartId: 'cart-ava', addressId: address!.id },
    });
    expect(checkout.ok()).toBeTruthy();
    const createdOrder = await checkout.json() as { ok: true; data: { id: string; number: string } };

    const orders = await api.get('/api/v1/orders?customerId=cust-ava&pageSize=100');
    expect(orders.ok()).toBeTruthy();
    const orderPage = await orders.json() as { ok: true; data: { items: Array<{ id: string }> } };
    expect(orderPage.data.items.some((item) => item.id === createdOrder.data.id)).toBeTruthy();

    const clientMessageId = `qa-idempotency-${Date.now()}`;
    const messageBody = {
      threadId: 'thread-ava-1',
      senderId: 'cust-ava',
      senderRole: 'customer',
      body: 'QA idempotency message',
      clientMessageId,
    };
    const firstMessage = await api.post('/api/v1/chat/threads/thread-ava-1/messages', { data: messageBody });
    const duplicateMessage = await api.post('/api/v1/chat/threads/thread-ava-1/messages', { data: messageBody });
    expect(firstMessage.ok()).toBeTruthy();
    expect(duplicateMessage.ok()).toBeTruthy();
    const first = await firstMessage.json() as { ok: true; data: { id: string } };
    const duplicate = await duplicateMessage.json() as { ok: true; data: { id: string } };
    expect(duplicate.data.id).toBe(first.data.id);

    await api.dispose();
  });
});

test.describe('Deterministic release scenario matrix', () => {
  test('covers catalog, campaign, payment, operations and reconnect edge states', async ({ page }) => {
    const api = await playwrightRequest.newContext({ baseURL: API });

    async function reset(scenario: string) {
      const response = await api.post('/api/v1/demo/reset', {
        headers: { 'x-demo-reset-token': RESET_TOKEN },
        data: { scenario },
      });
      expect(response.ok(), `reset ${scenario}`).toBeTruthy();
    }

    await reset('empty-catalog');
    const emptyCatalogResponse = await api.get('/api/v1/catalog/products?pageSize=48');
    const emptyCatalog = await emptyCatalogResponse.json() as { ok: true; data: { items: unknown[]; total: number } };
    expect(emptyCatalog.data.total).toBe(0);
    expect(emptyCatalog.data.items).toHaveLength(0);
    await page.goto(STOREFRONT);
    await expect(page.getByText('No products', { exact: true })).toBeVisible();
    await page.goto('about:blank');

    await reset('large-catalog');
    const largeCatalogResponse = await api.get('/api/v1/catalog/products?pageSize=48&sort=featured');
    const largeCatalog = await largeCatalogResponse.json() as {
      ok: true;
      data: {
        items: Array<{ images: Array<{ url: string }> }>;
        total: number;
        hasNextPage: boolean;
      };
    };
    expect(largeCatalog.data.total).toBe(80);
    expect(largeCatalog.data.items).toHaveLength(48);
    expect(largeCatalog.data.hasNextPage).toBe(true);
    expect(largeCatalog.data.items.every((item) => item.images[0]?.url.startsWith('https://images.unsplash.com/photo-'))).toBe(true);

    await reset('low-stock');
    const lowStockResponse = await api.get('/api/v1/catalog/products?pageSize=48');
    const lowStock = await lowStockResponse.json() as {
      ok: true;
      data: { items: Array<{ variants: Array<{ inventoryState: string }> }> };
    };
    expect(lowStock.data.items.some((product) => product.variants.some((variant) => variant.inventoryState === 'low-stock'))).toBe(true);

    await reset('sale-campaign');
    const promotionsResponse = await api.get('/api/v1/promotions');
    const promotions = await promotionsResponse.json() as { ok: true; data: Array<{ code: string; active: boolean }> };
    expect(promotions.data.some((promotion) => promotion.code === 'TAKE15' && promotion.active)).toBe(true);

    await reset('payment-failed');
    const customerResponse = await api.get('/api/v1/customers/cust-ava');
    const customer = await customerResponse.json() as { ok: true; data: { addresses: Array<{ id: string; isDefault?: boolean }> } };
    const address = customer.data.addresses.find((item) => item.isDefault) ?? customer.data.addresses[0];
    expect(address).toBeTruthy();
    const failedCheckoutResponse = await api.post('/api/v1/checkout', { data: { cartId: 'cart-ava', addressId: address!.id } });
    const failedCheckout = await failedCheckoutResponse.json() as { ok: true; data: { paymentState: string } };
    expect(failedCheckout.data.paymentState).toBe('failed');
    const retainedCartResponse = await api.get('/api/v1/cart/cart-ava');
    const retainedCart = await retainedCartResponse.json() as { ok: true; data: { lines: unknown[] } };
    expect(retainedCart.data.lines.length).toBeGreaterThan(0);

    await reset('delayed-shipment');
    const delayedOrdersResponse = await api.get('/api/v1/orders?customerId=cust-ava&pageSize=20');
    const delayedOrders = await delayedOrdersResponse.json() as { ok: true; data: { items: Array<{ fulfillmentState: string }> } };
    expect(delayedOrders.data.items[0]?.fulfillmentState).toBe('processing');

    await reset('return-approved');
    const returnsResponse = await api.get('/api/v1/admin/returns');
    const returns = await returnsResponse.json() as { ok: true; data: Array<{ state: string }> };
    expect(returns.data.some((item) => item.state === 'approved')).toBe(true);

    await reset('vip-customer');
    const vipCartResponse = await api.get('/api/v1/cart/cart-ava');
    const vipCart = await vipCartResponse.json() as { ok: true; data: { customerId: string } };
    expect(vipCart.data.customerId).toBe('cust-minh');
    const vipCustomerResponse = await api.get('/api/v1/customers/cust-minh');
    const vipCustomer = await vipCustomerResponse.json() as { ok: true; data: { tier: string } };
    expect(vipCustomer.data.tier).toBe('vip');

    await reset('unread-chat');
    const unreadThreadsResponse = await api.get('/api/v1/chat/threads?customerId=cust-ava&pageSize=20');
    const unreadThreads = await unreadThreadsResponse.json() as { ok: true; data: { items: Array<{ unreadByCustomer: number }> } };
    expect(unreadThreads.data.items[0]?.unreadByCustomer).toBe(2);

    await reset('chat-reconnect');
    const reconnectMessagesResponse = await api.get('/api/v1/chat/threads/thread-ava-1/messages');
    const reconnectMessages = await reconnectMessagesResponse.json() as { ok: true; data: Array<{ body: string }> };
    expect(reconnectMessages.data.some((message) => message.body.includes('before the client reconnects'))).toBe(true);

    await reset('healthy');
    await api.dispose();
  });
});

test.describe('Golden customer → Admin → support journey', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('creates an order visible in Admin and exchanges realtime support messages', async ({ browser }) => {
    const context = await browser.newContext();
    const customerPage = await context.newPage();
    const adminPage = await context.newPage();

    await Promise.all([
      customerPage.goto(STOREFRONT),
      adminPage.goto(ADMIN),
    ]);

    await expect(customerPage.getByText('Catalog')).toBeVisible();
    await customerPage.getByLabel('View Cloud Tee').click();
    await expect(customerPage.getByText('Cloud Tee', { exact: true }).last()).toBeVisible();
    await customerPage.getByRole('button', { name: 'Add to cart' }).click();
    await expect(customerPage.getByText(/added to cart/i)).toBeVisible();
    await customerPage.getByRole('button', { name: 'Apply coupon' }).click();
    await expect(customerPage.getByText(/Coupon WELCOME10 applied/i)).toBeVisible();

    await customerPage.getByTestId('storefront-checkout').click();
    await expect(customerPage).toHaveURL(`${STOREFRONT}/conformance/checkout`);
    await customerPage.getByRole('checkbox', { name: 'I confirm my delivery, payment and order details' }).click();
    await customerPage.getByRole('button', { name: 'Place order' }).click();
    await expect(customerPage.getByTestId('checkout-success')).toBeVisible();

    const api = await playwrightRequest.newContext({ baseURL: API });
    const orders = await api.get('/api/v1/orders?customerId=cust-ava&pageSize=100');
    const payload = await orders.json() as { ok: true; data: { items: Array<{ number: string }> } };
    const latestOrderNumber = payload.data.items[0]?.number;
    expect(latestOrderNumber).toBeTruthy();

    await adminPage.getByRole('button', { name: 'Refresh dashboard' }).click();
    await expect(adminPage.getByLabel(`Active order ${latestOrderNumber!}`)).toBeVisible();

    await customerPage.goto(STOREFRONT);
    await expect(customerPage.getByTestId('storefront-latest-order')).toContainText(latestOrderNumber!);

    const customerMessage = `Realtime customer QA ${Date.now()}`;
    await customerPage.getByLabel('Support message').fill(customerMessage);
    await customerPage.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(adminPage.getByText(new RegExp(customerMessage))).toBeVisible({ timeout: 15_000 });

    const agentReply = `Realtime agent QA ${Date.now()}`;
    await adminPage.getByLabel('Agent reply').fill(agentReply);
    await adminPage.getByRole('button', { name: 'Reply', exact: true }).click();
    await expect(customerPage.getByText(new RegExp(agentReply))).toBeVisible({ timeout: 15_000 });

    await api.dispose();
    await context.close();
  });
});

test.describe('Keyboard, responsive and accessibility release smoke', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('storefront keyboard traversal reaches and activates the featured CTA', async ({ page }) => {
    await page.goto(STOREFRONT);
    await expect(page.getByText('Catalog')).toBeVisible();
    await expect(page.getByText(/^Theme preference:/)).toHaveCount(0);

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Shop collections' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'My account' })).toBeFocused();

    const featuredCta = page.getByRole('button', { name: 'Shop featured Cloud Tee' });
    let reachedFeatured = false;
    for (let index = 0; index < 16; index += 1) {
      await page.keyboard.press('Tab');
      if (await featuredCta.evaluate((element) => element === document.activeElement)) {
        reachedFeatured = true;
        break;
      }
    }
    expect(reachedFeatured, 'featured CTA should be keyboard reachable within the primary storefront controls').toBe(true);
    await expect(featuredCta).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Product variant')).toBeVisible();
  });

  test('Admin keyboard traversal reaches primary navigation and dashboard controls', async ({ page }) => {
    await page.goto(ADMIN);
    await expect(page.getByText('BeeECOM Admin')).toBeVisible();
    await expect(page.getByText(/^Theme preference:/)).toHaveCount(0);

    const brand = page.getByRole('link', { name: 'BeeECOM Admin' });
    const catalog = page.getByRole('navigation', { name: 'Admin primary navigation' })
      .getByRole('link', { name: /Catalog & inventory/ });
    const refresh = page.getByRole('button', { name: 'Refresh dashboard' });

    await page.keyboard.press('Tab');
    await expect(brand).toBeFocused();

    let reachedCatalog = false;
    for (let index = 0; index < 6; index += 1) {
      await page.keyboard.press('Tab');
      if (await catalog.evaluate((element) => element === document.activeElement)) {
        reachedCatalog = true;
        break;
      }
    }
    expect(reachedCatalog, 'catalog navigation should be keyboard reachable from the shell brand').toBe(true);
    await expect(catalog).toBeFocused();

    let reachedRefresh = false;
    for (let index = 0; index < 6; index += 1) {
      await page.keyboard.press('Tab');
      if (await refresh.evaluate((element) => element === document.activeElement)) {
        reachedRefresh = true;
        break;
      }
    }
    expect(reachedRefresh, 'dashboard refresh should remain keyboard reachable after primary navigation').toBe(true);
    await expect(refresh).toBeFocused();
  });

  test('storefront stays within a 360px phone viewport and has no serious/critical axe violations', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(STOREFRONT);
    await expect(page.getByText('Catalog')).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical');
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test('Admin contains narrow layouts and has no serious/critical axe violations', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(ADMIN);
    await expect(page.getByText('BeeECOM Admin')).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical');
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
});

import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test } from '@playwright/test';

const API = 'http://127.0.0.1:8787';
const STOREFRONT = 'http://127.0.0.1:5173';
const ADMIN = 'http://127.0.0.1:5174';
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
    await customerPage.getByRole('button', { name: 'Simulate checkout' }).click();
    await expect(customerPage.getByText(/Order .* placed\./)).toBeVisible();

    const api = await playwrightRequest.newContext({ baseURL: API });
    const orders = await api.get('/api/v1/orders?customerId=cust-ava&pageSize=100');
    const payload = await orders.json() as { ok: true; data: { items: Array<{ number: string }> } };
    const latestOrderNumber = payload.data.items[0]?.number;
    expect(latestOrderNumber).toBeTruthy();

    await adminPage.getByRole('button', { name: 'Refresh canonical state' }).click();
    await expect(adminPage.getByText(latestOrderNumber!, { exact: true })).toBeVisible();

    const customerMessage = `Realtime customer QA ${Date.now()}`;
    await customerPage.getByLabel('Support message').fill(customerMessage);
    await customerPage.getByRole('button', { name: 'Send message' }).click();
    await expect(adminPage.getByText(new RegExp(customerMessage))).toBeVisible({ timeout: 15_000 });

    const agentReply = `Realtime agent QA ${Date.now()}`;
    await adminPage.getByLabel('Agent reply').fill(agentReply);
    await adminPage.getByRole('button', { name: 'Reply' }).click();
    await expect(customerPage.getByText(new RegExp(agentReply))).toBeVisible({ timeout: 15_000 });

    await api.dispose();
    await context.close();
  });
});

test.describe('Responsive and accessibility smoke', () => {
  test.beforeEach(async () => {
    await resetHealthy();
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

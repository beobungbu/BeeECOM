import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test } from '@playwright/test';

const API = 'http://127.0.0.1:8787';
const ADMIN = 'http://127.0.0.1:5174';
const RESET_TOKEN = 'qa-reset-token';
const ORDER_ID = 'order-1001';

type OrderSnapshot = {
  id: string;
  number: string;
  state: string;
  paymentState: string;
  fulfillmentState: string;
};

async function resetHealthy() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.post('/api/v1/demo/reset', {
    headers: { 'x-demo-reset-token': RESET_TOKEN },
    data: { scenario: 'healthy' },
  });
  expect(response.ok()).toBeTruthy();
  await api.dispose();
}

async function orderSnapshot(): Promise<OrderSnapshot> {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.get(`/api/v1/orders/${ORDER_ID}`);
  expect(response.ok()).toBeTruthy();
  const body = await response.json() as { ok: true; data: OrderSnapshot };
  await api.dispose();
  return body.data;
}

test.describe('BeeUI order overlay contracts in a real admin order flow', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('DropdownMenu exposes menu-button semantics, keyboard focus and Escape restoration', async ({ page }) => {
    await page.goto(`${ADMIN}/conformance/order-overlays`);
    await expect(page.getByText('Order overlay acceptance')).toBeVisible();

    const trigger = page.getByRole('button', { name: 'Order actions' });
    await expect(trigger).toBeVisible();

    const hasPopup = await trigger.getAttribute('aria-haspopup');
    expect(['menu', 'true']).toContain(hasPopup);

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    const deliver = page.getByRole('menuitem', { name: 'Mark delivered' });
    await expect(deliver).toBeFocused();
    await expect(page.getByRole('menuitem', { name: 'Ship order' })).toBeDisabled();

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('DropdownMenu action persists the shipped-to-delivered transition through D1', async ({ page }) => {
    expect(await orderSnapshot()).toMatchObject({
      id: ORDER_ID,
      number: '#1001',
      state: 'placed',
      paymentState: 'paid',
      fulfillmentState: 'shipped',
    });

    await page.goto(`${ADMIN}/conformance/order-overlays`);
    await expect(page.getByTestId('order-fulfillment-state')).toHaveText('shipped');

    await page.getByRole('button', { name: 'Order actions' }).click();
    await page.getByRole('menuitem', { name: 'Mark delivered' }).click();

    await expect(page.getByTestId('order-overlay-notice')).toHaveText('Order delivery persisted.');
    await expect(page.getByTestId('order-fulfillment-state')).toHaveText('delivered');
    expect(await orderSnapshot()).toMatchObject({
      id: ORDER_ID,
      state: 'completed',
      paymentState: 'paid',
      fulfillmentState: 'delivered',
    });
  });

  test('Popover exposes controlled disclosure and labelled dialog semantics', async ({ page }) => {
    await page.goto(`${ADMIN}/conformance/order-overlays`);

    const trigger = page.getByRole('button', { name: 'Order cost breakdown' });
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const dialog = page.getByRole('dialog', { name: 'Order total breakdown' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Canonical persisted money values for #1001.');
    await expect(dialog).toContainText('$78.12');

    const controls = await trigger.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    await expect(dialog).toHaveAttribute('id', controls!);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('open overlays remain usable at 360px without serious or critical axe findings', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`${ADMIN}/conformance/order-overlays`);

    await page.getByRole('button', { name: 'Order cost breakdown' }).click();
    await expect(page.getByRole('dialog', { name: 'Order total breakdown' })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  });
});

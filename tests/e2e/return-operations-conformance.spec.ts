import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test } from '@playwright/test';

const API = 'http://127.0.0.1:8787';
const ADMIN = 'http://127.0.0.1:5174';
const RESET_TOKEN = 'qa-reset-token';

async function resetReturnApproved() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.post('/api/v1/demo/reset', {
    headers: { 'x-demo-reset-token': RESET_TOKEN },
    data: { scenario: 'return-approved' },
  });
  expect(response.ok()).toBeTruthy();
  await api.dispose();
}

async function persistedReturnState() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.get('/api/v1/admin/returns');
  expect(response.ok()).toBeTruthy();
  const body = await response.json() as {
    ok: true;
    data: Array<{ id: string; state: string }>;
  };
  await api.dispose();
  return body.data.find((item) => item.id === 'return-1001')?.state;
}

async function persistedOrderPaymentState() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.get('/api/v1/orders/order-1001');
  expect(response.ok()).toBeTruthy();
  const body = await response.json() as {
    ok: true;
    data: { paymentState: string };
  };
  await api.dispose();
  return body.data.paymentState;
}

test.describe('BeeUI return operations in a product-grade Admin flow', () => {
  test.beforeEach(async () => {
    await resetReturnApproved();
  });

  test('return summary, item list, metadata and timeline render canonical commerce data', async ({ page }) => {
    await page.goto(`${ADMIN}/conformance/return-operations`);

    const summary = page.getByTestId('return-summary');
    await expect(summary).toContainText('return-1001');
    await expect(summary).toContainText('#1001');
    await expect(summary).toContainText('Ava Nguyen');
    await expect(summary).toContainText('Size was not right');
    await expect(summary).toContainText('$78.12');

    const returnedItems = page.getByRole('list', { name: 'Returned items' });
    await expect(returnedItems).toBeVisible();
    await expect(returnedItems.getByRole('listitem')).toHaveCount(1);
    await expect(returnedItems).toContainText('Field Pack');
    await expect(returnedItems).toContainText('Default · Qty 1');
    await expect(returnedItems).toContainText('$64.00');

    const decision = page.getByTestId('return-decision-metadata');
    await expect(decision).toContainText('approved');
    await expect(decision).toContainText('paid');
    await expect(decision).toContainText('shipped');

    const timeline = page.getByTestId('return-timeline');
    await expect(timeline).toContainText('Return requested');
    await expect(timeline).toContainText('Return approved');
  });

  test('approved return can issue a real refund and persists both return and payment state', async ({ page }) => {
    await page.goto(`${ADMIN}/conformance/return-operations`);
    await expect(page.getByRole('button', { name: 'Issue refund' })).toBeVisible();
    expect(await persistedReturnState()).toBe('approved');
    expect(await persistedOrderPaymentState()).toBe('paid');

    await page.getByRole('button', { name: 'Issue refund' }).click();

    await expect(page.getByTestId('refund-complete')).toContainText('Refund complete');
    await expect(page.getByTestId('return-decision-metadata')).toContainText('refunded');
    await expect(page.getByTestId('return-timeline')).toContainText('Refund issued');
    expect(await persistedReturnState()).toBe('refunded');
    expect(await persistedOrderPaymentState()).toBe('refunded');
  });

  test('return operations remain readable at 360px without serious or critical axe findings', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`${ADMIN}/conformance/return-operations`);
    await expect(page.getByTestId('return-summary')).toContainText('#1001');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      violations.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')),
    ).toEqual([]);
  });
});

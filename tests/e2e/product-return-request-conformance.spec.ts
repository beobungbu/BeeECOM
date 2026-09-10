import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test, type Page, type TestInfo } from '@playwright/test';

const API = 'http://127.0.0.1:8787';
const STOREFRONT = 'http://127.0.0.1:5173';
const RESET_TOKEN = 'qa-reset-token';
const ORDER_ID = 'order-1001';
const CUSTOMER_ID = 'cust-ava';

async function resetHealthy() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.post('/api/v1/demo/reset', {
    headers: { 'x-demo-reset-token': RESET_TOKEN },
    data: { scenario: 'healthy' },
  });
  expect(response.ok()).toBeTruthy();
  await api.dispose();
}

async function deliverOrder() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.patch(`/api/v1/admin/orders/${ORDER_ID}`, {
    data: { action: 'deliver' },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json() as {
    ok: true;
    data: { fulfillmentState: string; state: string };
  };
  expect(body.data.fulfillmentState).toBe('delivered');
  expect(body.data.state).toBe('completed');
  await api.dispose();
}

async function adminReturns() {
  const api = await playwrightRequest.newContext({ baseURL: API });
  const response = await api.get('/api/v1/admin/returns');
  expect(response.ok()).toBeTruthy();
  const body = await response.json() as {
    ok: true;
    data: Array<{
      id: string;
      orderId: string;
      customerId: string;
      reason: string;
      state: string;
    }>;
  };
  await api.dispose();
  return body.data;
}

async function attachFullPage(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' }),
    contentType: 'image/png',
  });
}

test.describe('Customer return request lifecycle', () => {
  test.beforeEach(async () => {
    await resetHealthy();
  });

  test('delivered order exposes return entry, submits a persisted request and restores it after reload', async ({ page }, testInfo) => {
    await deliverOrder();
    await page.goto(`${STOREFRONT}/conformance/orders/${ORDER_ID}`);

    await expect(page.getByText('delivered', { exact: true })).toBeVisible();
    const returnButton = page.getByRole('button', { name: 'Start a return for order #1001' });
    await expect(returnButton).toBeVisible();
    await returnButton.click();

    await expect(page).toHaveURL(new RegExp(`/conformance/return-request\\?orderId=${ORDER_ID}$`));
    await expect(page.getByRole('heading', { name: 'Start a return' })).toBeVisible();
    await expect(page.getByTestId('return-order-summary')).toContainText('Order #1001');
    await expect(page.getByTestId('return-order-summary')).toContainText('$78.12');
    await expect(page.getByTestId('return-order-summary')).toContainText('Ava Nguyen');
    await expect(page.getByTestId('return-request-form')).toBeVisible();

    await page.getByRole('button', { name: 'Submit return request' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Select a return reason.' })).toBeVisible();

    const damaged = page.getByRole('radio', { name: 'Damaged or defective' });
    await damaged.click();
    await expect(damaged).toBeChecked();
    await page.getByRole('textbox', { name: 'Additional details' }).fill('Strap stitching came loose after one use.');
    await page.getByRole('button', { name: 'Submit return request' }).click();

    const submitted = page.getByTestId('submitted-return');
    await expect(submitted).toBeVisible();
    await expect(submitted).toContainText('Return request received');
    await expect(submitted).toContainText('requested');
    await expect(submitted).toContainText('Damaged or defective — Strap stitching came loose after one use.');

    const persisted = (await adminReturns()).find((item) => item.orderId === ORDER_ID && item.customerId === CUSTOMER_ID);
    expect(persisted).toMatchObject({
      orderId: ORDER_ID,
      customerId: CUSTOMER_ID,
      reason: 'Damaged or defective — Strap stitching came loose after one use.',
      state: 'requested',
    });

    await page.reload();
    await expect(page.getByTestId('submitted-return')).toContainText('Damaged or defective — Strap stitching came loose after one use.');
    await expect(page.getByTestId('return-request-form')).toHaveCount(0);
    await attachFullPage(page, testInfo, 'customer-return-submitted-desktop');
  });

  test('API rejects duplicate return requests for the same customer and order', async () => {
    await deliverOrder();
    const api = await playwrightRequest.newContext({ baseURL: API });
    const input = {
      orderId: ORDER_ID,
      customerId: CUSTOMER_ID,
      reason: 'Changed my mind',
    };

    const first = await api.post('/api/v1/returns', { data: input });
    expect(first.status()).toBe(201);

    const duplicate = await api.post('/api/v1/returns', { data: input });
    expect(duplicate.status()).toBe(409);
    const duplicateBody = await duplicate.json() as { ok: false; error: { code: string } };
    expect(duplicateBody.error.code).toBe('RETURN_ALREADY_EXISTS');
    await api.dispose();

    const persisted = (await adminReturns()).filter((item) => item.orderId === ORDER_ID && item.customerId === CUSTOMER_ID);
    expect(persisted).toHaveLength(1);
  });

  test('API rejects a customer who does not own the delivered order', async () => {
    await deliverOrder();
    const api = await playwrightRequest.newContext({ baseURL: API });
    const response = await api.post('/api/v1/returns', {
      data: {
        orderId: ORDER_ID,
        customerId: 'cust-minh',
        reason: 'Not as expected',
      },
    });
    expect(response.status()).toBe(403);
    const body = await response.json() as { ok: false; error: { code: string } };
    expect(body.error.code).toBe('RETURN_ORDER_OWNERSHIP_REQUIRED');
    await api.dispose();
    expect((await adminReturns()).filter((item) => item.orderId === ORDER_ID)).toHaveLength(0);
  });

  test('shipped order does not expose return CTA and the API rejects early return creation', async ({ page }) => {
    await page.goto(`${STOREFRONT}/conformance/orders/${ORDER_ID}`);
    await expect(page.getByText('shipped', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start a return for order #1001' })).toHaveCount(0);

    await page.goto(`${STOREFRONT}/conformance/return-request?orderId=${ORDER_ID}`);
    await expect(page.getByTestId('return-not-eligible')).toContainText('Returns can be requested after a paid order has been delivered.');

    const api = await playwrightRequest.newContext({ baseURL: API });
    const response = await api.post('/api/v1/returns', {
      data: {
        orderId: ORDER_ID,
        customerId: CUSTOMER_ID,
        reason: 'Changed my mind',
      },
    });
    expect(response.status()).toBe(409);
    const body = await response.json() as { ok: false; error: { code: string } };
    expect(body.error.code).toBe('RETURN_NOT_ELIGIBLE');
    await api.dispose();
  });

  test('return form reflows at 390px, passes serious/critical axe and produces mobile evidence', async ({ page }, testInfo) => {
    await deliverOrder();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${STOREFRONT}/conformance/return-request?orderId=${ORDER_ID}`);
    await expect(page.getByTestId('return-request-form')).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const violations = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
    await attachFullPage(page, testInfo, 'customer-return-form-mobile');
  });

  test('desktop return form produces product-quality visual evidence', async ({ page }, testInfo) => {
    await deliverOrder();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${STOREFRONT}/conformance/return-request?orderId=${ORDER_ID}`);
    await expect(page.getByTestId('return-request-form')).toBeVisible();
    await attachFullPage(page, testInfo, 'customer-return-form-desktop');
  });
});
